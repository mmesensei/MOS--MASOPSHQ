/**
 * SectionBoundary — a lightweight React error boundary for individual HQ
 * sections. A crash in one section (e.g. Boardroom WebGL failure) is caught
 * here and shows a neutral fallback panel instead of propagating to the root
 * ErrorComponent and blacking out the entire headquarters experience.
 */
import { Component, type ReactNode } from "react";

interface Props {
  /** Short label shown in the fallback — e.g. "Boardroom" */
  label: string;
  children: ReactNode;
}

interface State {
  crashed: boolean;
  error: Error | null;
}

export class SectionBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[MOS] ${this.props.label} section crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div
          className="flex items-center justify-center rounded-xl border border-border/40 bg-surface/40 px-6 py-8 text-center"
          role="alert"
        >
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-destructive/70">
              Section unavailable
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {this.props.label} could not be loaded.
            </p>
            <button
              onClick={() => this.setState({ crashed: false, error: null })}
              className="mt-4 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
