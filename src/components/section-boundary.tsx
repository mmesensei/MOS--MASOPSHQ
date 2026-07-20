// Class-based error boundary for isolating section crashes.
// Wraps risky sections (R3F, AI feeds, etc.) so a crash shows
// a local retry card instead of blanking the whole page.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Short label shown in the fallback card (e.g. "Executive Boardroom") */
  label?: string;
}

interface State {
  error: Error | null;
}

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionBoundary:${this.props.label ?? "section"}]`, error, info);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="my-4 flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <div>
            <div className="text-sm font-medium">
              {this.props.label ? `${this.props.label} offline` : "Section offline"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred"}
            </div>
          </div>
          <button
            onClick={this.retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
