import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Renderer] uncaught error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: 24 }}>
          <h2 className="page-title">Error en la interfaz</h2>
          <p className="error-text">{this.state.error.message}</p>
          <p style={{ color: "#9aa3b2", fontSize: 14 }}>
            Revisa la consola de desarrollo (DevTools) para más detalle.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
