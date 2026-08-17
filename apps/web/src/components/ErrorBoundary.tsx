import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="orch-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-0)' }}>Something went wrong</h3>
          <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-2)' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="orch-btn primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}