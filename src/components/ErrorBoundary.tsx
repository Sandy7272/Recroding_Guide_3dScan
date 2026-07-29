import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any throw during a capture leaves the user on a white screen
 * with no indication of what happened or how to recover.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center text-foreground">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The app hit an unexpected error. Your last recording may not have been saved.
        </p>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="mt-2 h-12 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform active:scale-95"
        >
          Start over
        </button>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-40 max-w-full overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
