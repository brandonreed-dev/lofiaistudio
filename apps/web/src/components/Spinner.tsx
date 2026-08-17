export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      className="orch-spinner"
      style={{
        width: size,
        height: size,
        border: `2px solid var(--border-c)`,
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    />
  );
}