import { Component, type ReactNode } from 'react';

declare global {
  interface Window {
    __fuMounted?: boolean;
    __fuRescue?: (msg?: string) => void;
  }
}

/**
 * Si algo falla al pintar (p. ej. una partida guardada incompatible), en vez de
 * una pantalla en negro se muestra la pantalla de recuperación de index.html.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidMount() {
    // La app ya está montada: la pantalla de recuperación deja de vigilar.
    window.__fuMounted = true;
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
    window.__fuRescue?.(error instanceof Error ? error.message : String(error));
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
