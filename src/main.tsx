import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign development-only Vite HMR websocket disconnection noise in AI Studio preview
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (reasonStr.includes('WebSocket closed without opened') || reasonStr.includes('failed to connect to websocket')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '40px auto', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#dc2626', marginTop: 0, fontSize: '20px', fontWeight: 700 }}>Application Exception</h2>
          <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5' }}>An error occurred during application initialization or rendering:</p>
          <pre style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', fontSize: '12px', overflowX: 'auto', color: '#1f2937', border: '1px solid #f3f4f6' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '16px', padding: '10px 20px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
