import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Sentry, sentryEnabled } from '../lib/sentry';

type ErrorBoundaryProps = {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (sentryEnabled) {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } else {
      console.error('[error-boundary]', error, info.componentStack);
    }
  }

  private readonly reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    return this.state.error === null ? this.props.children : this.props.fallback(this.reset);
  }
}
