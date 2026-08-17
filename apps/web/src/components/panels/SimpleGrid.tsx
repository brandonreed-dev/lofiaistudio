import React from 'react';

export function SimpleGrid({
  items,
}: {
  items: { id: string; title: string; body: string; meta: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="orch-grid orch-grid-3">
      {items.map((item) => (
        <div className="orch-card" key={item.id}>
          <div className="orch-card-body" style={{ display: 'flex', gap: 12 }}>
            <div className="orch-row-icon">{item.icon}</div>
            <div>
              <div className="orch-row-title">{item.title}</div>
              <div className="orch-row-sub">{item.body}</div>
              <div style={{ marginTop: 10 }}>
                <span className="orch-chip blue">{item.meta}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}