import React from 'react';
import { APP_VERSION_LABEL } from '../constants/version';

export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0a0f1e',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 12,
            padding: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 8 }}>{APP_VERSION_LABEL}</div>
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', lineHeight: 1.5, opacity: 0.85 }}>
            Your session data is saved locally. Reload to continue — you should not need to disconnect the call.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: '#0ea5e9',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0.5rem 1rem',
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
