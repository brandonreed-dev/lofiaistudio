import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useOrchestrationStore } from '@/stores/orchestration';

export 
function CommandPalette() {
  const { commandOpen, setCommandOpen, openDrawer, runWorkflow, workflows } = useOrchestrationStore();
  const { setActiveView } = useAppStore();
  const [query, setQuery] = useState('');
  const commands = [
    { group: 'Navigate', label: 'Go to Dashboard', action: () => setActiveView('dashboard') },
    { group: 'Navigate', label: 'Go to Agents', action: () => setActiveView('agents') },
    { group: 'Navigate', label: 'Go to Workflows', action: () => setActiveView('workflows') },
    { group: 'Navigate', label: 'Go to Models', action: () => setActiveView('models') },
    { group: 'Navigate', label: 'Go to Audio', action: () => setActiveView('audio') },
    { group: 'Create', label: 'Add New Agent', action: () => openDrawer('agent') },
    { group: 'Create', label: 'New workflow', action: () => openDrawer('workflow') },
    { group: 'Create', label: 'Install skill', action: () => openDrawer('skill') },
    ...workflows.map((workflow) => ({
      group: 'Run',
      label: `Run ${workflow.name}`,
      action: () => void runWorkflow(workflow.id),
    })),
  ];
  const visible = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));

  if (!commandOpen) return null;

  return (
    <div className="orch-modal-overlay" onClick={() => setCommandOpen(false)}>
      <div className="orch-cmdk" onClick={(event) => event.stopPropagation()}>
        <div className="orch-cmdk-head">
          <Search />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands..." />
          <button className="orch-icon-btn" onClick={() => setCommandOpen(false)}>
            <X />
          </button>
        </div>
        <div className="orch-cmdk-list">
          {visible.map((command) => (
            <button
              className="orch-cmdk-item"
              key={`${command.group}:${command.label}`}
              onClick={() => {
                setCommandOpen(false);
                command.action();
              }}
            >
              <span>{command.label}</span>
              <small>{command.group}</small>
            </button>
          ))}
          {visible.length === 0 && <div className="orch-empty">No commands found.</div>}
        </div>
      </div>
    </div>
  );
}
