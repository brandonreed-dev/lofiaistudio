export function ResourceRow({ label, pct, fill }: { label: string; pct: number; fill: string }) {
  return (
    <div className="orch-resource-row">
      <span className="label">{label}</span>
      <div className="orch-bar">
        <div className={`fill ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="val">{pct}%</span>
    </div>
  );
}
