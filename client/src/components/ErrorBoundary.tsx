import { Component, ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}
interface State {
  error: Error | null;
}

// Catches render/3D errors so a scene failure shows a clean message instead of a
// blank black screen. Logs the real error to the console for dev diagnosis.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error(`[${this.props.label || "app"}] render error:`, error, info);
  }
  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="panel p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-steel text-sm mb-4 break-words">{this.state.error.message}</p>
          <div className="flex items-center justify-center gap-2">
            <button className="btn btn-accent" onClick={() => location.reload()}>Reload</button>
            <Link to="/" className="btn">Home</Link>
          </div>
        </div>
      </div>
    );
  }
}
