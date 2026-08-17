import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Building2, Shield, UserPlus } from 'lucide-react';
import { useOrchestrationStore } from '@/stores/orchestration';
import type { User, Organization, OrganizationMember } from '@lofiaistudio/shared';
import { api } from '@/lib/api';

type Tab = 'members' | 'workers' | 'settings';

export function UsersPanel() {
  const { loadCollection } = useOrchestrationStore();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('members');
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<User['role']>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<User['role']>('member');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadOrganizations();
  }, [loadCollection]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api<User[]>('/api/users');
      setUsers(data);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const data = await api<Organization[]>('/api/organizations');
      setOrganizations(data);
    } catch {
      // ignore
    }
  };

  const loadMembers = async (orgId: string) => {
    try {
      const data = await api<OrganizationMember[]>(`/api/organizations/${orgId}/members`);
      setMembers(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (selectedOrgId) {
      loadMembers(selectedOrgId);
    }
  }, [selectedOrgId]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) ?? null;

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    await api(`/api/users/${editingUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
    });
    setEditingUser(null);
    await loadUsers();
  };

  const inviteUser = async () => {
    if (!inviteEmail) return;
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, name: inviteEmail.split('@')[0], role: inviteRole, status: 'invited', provider: 'local' }),
    });
    setInviteEmail('');
    setInviteRole('member');
    setInviting(false);
    await loadUsers();
  };

  const createOrganization = async () => {
    const name = prompt('Organization name:');
    if (!name) return;
    await api('/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), createdBy: 'current-user', memberCount: 0, status: 'active' }),
    });
    await loadOrganizations();
  };

  const addMember = async () => {
    if (!selectedOrgId) return;
    const email = prompt('User email:');
    if (!email) return;
    const role = prompt('Role (owner/admin/member/viewer):') as OrganizationMember['role'] || 'member';
    await api(`/api/organizations/${selectedOrgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId: 'pending', role, invitedBy: 'current-user' }),
    });
    await loadMembers(selectedOrgId);
  };

  const filtered = useMemo(() => {
    let list = selectedOrgId ? users.filter((u) => u.organizationId === selectedOrgId) : users;
    const q = filter.toLowerCase();
    if (q) {
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((u) => u.status === statusFilter);
    }
    return list;
  }, [users, selectedOrgId, filter, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    invited: users.filter((u) => u.status === 'invited').length,
    disabled: users.filter((u) => u.status === 'disabled').length,
    orgs: organizations.length,
  }), [users, organizations]);

  return (
    <div className="orch-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold">Organization</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={createOrganization} className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700">
            <Building2 className="w-4 h-4" />
          </button>
          <button onClick={() => setInviting(true)} className="px-3 py-1.5 rounded-md bg-indigo-500 text-sm text-white hover:bg-indigo-600">
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* Sidebar */}
        <div className="lg:col-span-3 p-3 space-y-4">
          <div>
            <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Organizations</div>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedOrgId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                  selectedOrgId === null ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> All Users</span>
                <span className="text-xs text-zinc-400">{users.length}</span>
              </button>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                    selectedOrgId === org.id ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {org.name}
                  </span>
                  <span className="text-xs text-zinc-400">{org.memberCount}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stats</div>
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-800">
                <div className="text-xs text-zinc-500">Total users</div>
                <div className="text-lg font-semibold text-zinc-200">{stats.total}</div>
              </div>
              <div className="px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-800">
                <div className="text-xs text-zinc-500">Active</div>
                <div className="text-lg font-semibold text-green-400">{stats.active}</div>
              </div>
              <div className="px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-800">
                <div className="text-xs text-zinc-500">Organizations</div>
                <div className="text-lg font-semibold text-indigo-400">{stats.orgs}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-9 p-4">
          {selectedOrg && (
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setTab('members')} className={`px-3 py-1.5 rounded-md text-sm ${tab === 'members' ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}>Members</button>
              <button onClick={() => setTab('workers')} className={`px-3 py-1.5 rounded-md text-sm ${tab === 'workers' ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}>Workers</button>
              <button onClick={() => setTab('settings')} className={`px-3 py-1.5 rounded-md text-sm ${tab === 'settings' ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}>Settings</button>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">{selectedOrg ? `${selectedOrg.name} members` : 'All users'}</h3>
                <button onClick={addMember} disabled={!selectedOrgId} className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              <div className="orch-filter" style={{ padding: '8px 16px', marginBottom: 8 }}>
                <input className="orch-input" placeholder="Search users..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
                <select className="orch-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <select className="orch-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="orch-list">
                {filtered.map((user) => (
                  <div key={user.id} className="orch-row">
                    <div className="orch-row-icon">
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 600 }}>
                        {(user.name || user.email).slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="orch-row-main">
                      <div className="orch-row-title">
                        {user.name}
                        <span className={`orch-chip ${user.role === 'owner' ? 'amber' : user.role === 'admin' ? 'blue' : ''}`} style={{ marginLeft: 8 }}>{user.role}</span>
                        <span className={`orch-chip ${user.status === 'active' ? 'green' : user.status === 'invited' ? '' : ''}`} style={{ marginLeft: 6 }}>{user.status}</span>
                      </div>
                      <div className="orch-row-sub">{user.email}</div>
                      <div className="orch-row-sub">{user.provider ? `Provider: ${user.provider}` : 'Internal account'}</div>
                    </div>
                    <div className="orch-row-actions" style={{ display: 'flex', gap: '6px' }}>
                      <button className="orch-btn xs" onClick={() => openEdit(user)}>Edit</button>
                      <button className="orch-btn xs" style={{ color: 'var(--red)' }} onClick={async () => { if (confirm('Remove this user?')) { await api(`/api/users/${user.id}`, { method: 'DELETE' }); await loadUsers(); } }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'workers' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Workers</h3>
              <div className="text-sm text-zinc-500">Monitor worker assignments, active workflows, and skill usage.</div>
            </div>
          )}

          {tab === 'settings' && selectedOrg && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Organization Settings</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-500">Name</label>
                  <input className="orch-input" defaultValue={selectedOrg.name} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Slug</label>
                  <input className="orch-input" defaultValue={selectedOrg.slug} />
                </div>
              </div>
            </div>
          )}

          {(editingUser || inviting) && (
            <div className="orch-card" style={{ marginTop: 16, padding: 16 }}>
              <div className="orch-card-header" style={{ marginBottom: 12 }}>
                <div className="orch-card-title">{editingUser ? 'Edit User' : 'Invite User'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {editingUser ? (
                  <>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Name</label>
                      <input className="orch-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Email</label>
                      <input className="orch-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Email</label>
                      <input className="orch-input" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Role</label>
                      <select className="orch-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as User['role'])}>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Role</label>
                  <select className="orch-select" value={editingUser ? editRole : inviteRole} onChange={(e) => editingUser ? setEditRole(e.target.value as User['role']) : setInviteRole(e.target.value as User['role'])}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="orch-btn xs ghost" onClick={() => { setEditingUser(null); setInviting(false); }}>Cancel</button>
                <button className="orch-btn primary" onClick={editingUser ? saveEdit : inviteUser}>
                  {editingUser ? 'Save changes' : 'Send invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}