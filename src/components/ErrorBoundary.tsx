import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
    children: ReactNode;
};

type ErrorBoundaryState = {
    error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("UI error:", error, info.componentStack);
    }

    render(): ReactNode {
        if (this.state.error) {
            return (
                <div className="page error-text" style={{ padding: "24px" }}>
                    <h2>Application error</h2>
                    <p>{this.state.error.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}
