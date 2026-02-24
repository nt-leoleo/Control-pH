import { Component } from 'react';
import './ErrorBoundary.css';

const isDevelopment = import.meta.env.DEV;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    this.setState({
      error: error?.toString?.() || 'Error desconocido',
      errorInfo: errorInfo?.componentStack || ''
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="errorBoundaryContainer">
          <div className="errorBoundaryContent">
            <h1>Error en la aplicacion</h1>
            <p className="errorMessage">
              Ocurrio un problema inesperado. Reintenta y, si persiste, recarga la pagina.
            </p>
            {isDevelopment && (
              <details className="errorDetails">
                <summary>Detalles tecnicos (solo desarrollo)</summary>
                <pre>{this.state.error}</pre>
                <pre>{this.state.errorInfo}</pre>
              </details>
            )}
            <div className="errorActions">
              <button className="errorButton" onClick={this.resetError}>
                Reintentar
              </button>
              <button className="errorButton errorButtonSecondary" onClick={() => window.location.reload()}>
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
