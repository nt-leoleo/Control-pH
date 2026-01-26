import { useState } from "react"

const NivelPh = () => {
    const [ph,setPh] = useState(7.4);

    const getStatus = () => {
        if (ph < 7.2) return {text: 'Bajo', color: 'red'}
        if (ph > 7.6) return {text: 'alto',  color: 'violet'}
        return { text: 'Óptimo', color: 'green' }
    }

    const status = getStatus();

    return(
        <div style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: '#1E293B',
            textAlign: 'center',
            color: status.color
        }}>
            <b>pH</b>
            <h2>{ph}</h2>
            <p>{status.text}</p>
        </div>

    );
}

export default NivelPh
