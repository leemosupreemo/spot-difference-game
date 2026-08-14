import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-panel app-container"
          style={{
            margin: '40px auto',
            padding: '30px',
            textAlign: 'center',
            maxWidth: '500px',
            borderRadius: '20px'
          }}
        >
          <h2 style={{ color: 'var(--accent-pink)', marginBottom: '12px', fontSize: '1.4rem' }}>
            ⚠️ Display Error
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering issue occurred.'}
          </p>
          <button
            className="glass-btn glass-btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
              else window.location.reload();
            }}
            style={{ padding: '12px 24px', fontSize: '1rem', borderRadius: '12px' }}
          >
            🔄 Return to Main Menu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
