import { Component } from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null,
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error capturado por ErrorBoundary:', error, errorInfo);
        this.setState({
            error: error.toString(),
            errorInfo: errorInfo.componentStack
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
                        <h1>⚠️ Error en la Aplicación</h1>
                        <p className="errorMessage">{this.state.error}</p>
                        <details className="errorDetails">
                            <summary>Detalles técnicos</summary>
                            <pre>{this.state.errorInfo}</pre>
                        </details>
                        <button className="errorButton" onClick={this.resetError}>
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
