export function LicensePanel() {
  return (
    <div className="orch-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* ─── COMMUNITY ─────────────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Community
          </div>
          <span className="orch-chip green">Free</span>
        </div>
        <div className="orch-card-body">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-1)', marginBottom: 16 }}>
            LoFi AI Studio is licensed under the{' '}
            <strong>MIT</strong> License.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-1)', marginBottom: 16 }}>
            The full license text is available in the project's{' '}
            <code style={{ fontSize: 13, background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>LICENSE</code>{' '}
            file at the root of the repository.
          </p>

          <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              Support the project
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
              If you find LoFi AI Studio valuable, consider donating to support
              ongoing development:
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://www.patreon.com/cw/BrandonReed_Dev"
                target="_blank"
                rel="noopener noreferrer"
                className="orch-btn primary"
                style={{ textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                  <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6Z" />
                </svg>
                Patreon
              </a>
              {/* <a
                href="https://buymeacoffee.com/brandonreeg"
                target="_blank"
                rel="noopener noreferrer"
                className="orch-btn"
                style={{ textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                  <path d="M2 21.5h20l-1.5-12H3.5L2 21.5ZM5.5 7.5h13l-.5-4h-12l-.5 4Z" />
                  <path d="M8 7.5V5c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2.5" />
                </svg>
                Buy Me a Coffee
              </a> */}
              <a
                href="https://www.paypal.me/brandonreeddev"
                target="_blank"
                rel="noopener noreferrer"
                className="orch-btn primary"
                style={{ textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#003087">
                  <path d="M5.9,16C8.06,14.34 9.68,12.33 9.68,10C9.68,7.68 8.06,5.68 5.9,4H6V16M5.9,13l-2.89,1L4.84,10L2.93,9"></path>
                  <path d="M12 17c-.45 0 .9-1 1.35-1s0 0 0 0h6v-4H11C9 12 5 18 5 18v8l8-7z"></path>
                  <path d="M17,6c-.45,0 .9-1 1.35-1s0 0 0 0h6V2H17C16.55,2 17,6 17,6Z"></path>
                </svg>

                Paypal
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ENTERPRISE ───────────────────────────── */}
      <div className="orch-card">
        <div className="orch-card-header">
          <div className="orch-card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Enterprise
          </div>
          <span className="orch-chip blue">Commercial</span>
        </div>
        <div className="orch-card-body">

          <div style={{ paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              Contact for Business Purposes
            </div>
            <a
              href="mailto:brandonreed.dev@gmail.com"
              className="orch-btn primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              brandonreed.dev@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}