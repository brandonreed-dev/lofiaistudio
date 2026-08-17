import type { LucideIcon } from 'lucide-react';
import type { View } from '@/stores';
import { Activity, Boxes, PlugIcon, Box, Receipt, Clock, Code, CreditCard, Database, FolderKanban, Globe, Image as ImageIcon, KeyRound, LayoutDashboard, Mail, MessageSquare, Music, Server, Settings, Users, Video, Workflow, Wrench, Building2, Shield } from 'lucide-react';

export type NavItem = {
  view: View;
  icon: LucideIcon;
  badge?: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { view: 'dashboard', icon: LayoutDashboard },
      { view: 'activity', icon: Activity },
      // { view: 'reports', icon: Receipt },
    ],
  },
  // {
  //   title: 'Socials',
  //   items: [
  //     { view: 'inbox', icon: Mail },
  //     { view: 'posts', icon: Mail },
  //     { view: 'issues', icon: Mail },
  //   ]
  // },
  {
    title: 'Tools',
    items: [
      { view: 'text', icon: MessageSquare },
      { view: 'image', icon: ImageIcon },
      { view: 'audio', icon: Music },
      { view: 'video', icon: Video },
      // { view: '3d', icon: Box },
      // { view: 'code', icon: Code},
    ],
  },
  {
    title: 'Manage',
    items: [
      { view: 'agents', icon: Users, badge: '0' },
      { view: 'workflows', icon: Workflow, badge: '0' },
      { view: 'skills', icon: Wrench, badge: '0' },
      { view: 'tasks', icon: Clock, badge: '0' },
      { view: 'projects', icon: FolderKanban },
      { view: 'servers', icon: Server },
      { view: 'models', icon: Boxes, },
      { view: 'storage', icon: Database, },
      { view: 'integrations', icon: KeyRound, },
      // { view: 'plugins', icon: PlugIcon},
    ],
  },
  {
    title: 'Admin',
    items: [
      { view: 'settings', icon: Settings },
      // { view: 'users', icon: Users },
      { view: 'license', icon: CreditCard },
    ],
  },
];

export function breadcrumbGroupFor(activeView: View): string {
  return ['dashboard', 'activity', 'reporting'].includes(activeView)
    ? 'Workspace'
    : ['text', 'image', 'audio', 'video', '3d', 'code',].includes(activeView)
    ? 'socials'
    : ['inbox', 'posts', 'reporting'].includes(activeView)
    ? 'Tools'
    : ['agents', 'workflows', 'skills', 'tasks', 'projects', 'servers', 'models', 'storage', 'integrations', 'plugins'].includes(activeView)
    ? 'Manage'
    : ['users', 'license', 'settings'].includes(activeView)
    ? 'Admin'
    : 'Admin';
}
