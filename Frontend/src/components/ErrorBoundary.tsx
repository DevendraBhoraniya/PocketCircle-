import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, log to telemetry or structured monitoring
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
  }


  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-paper-white font-sans text-ink-black">
          <div className="w-full max-w-md rounded-[28px] border border-sand bg-parchment p-8 shadow-sm space-y-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ember-orange/15 text-ember-orange border border-ember-orange/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="pc-badge pc-badge-dark text-xs uppercase font-mono tracking-wider">
                System Notice
              </span>
              <h1 className="text-2xl font-semibold text-ink-black">
                Something didn't balance
              </h1>
              <p className="text-sm text-steel leading-relaxed">
                An unexpected interface error occurred. Your financial records and circle balances are safely stored.
              </p>
            </div>

            {this.state.error && import.meta.env.DEV && (
              <div className="rounded-xl border border-sand bg-white/70 p-3 text-left overflow-auto max-h-32 text-xs font-mono text-steel">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="pc-btn pc-btn-primary w-full sm:w-auto text-xs py-2 px-5 font-bold"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="pc-btn pc-btn-secondary w-full sm:w-auto text-xs py-2 px-5 font-semibold"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
