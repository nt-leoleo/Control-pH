import './ShowpH.css'
import { useContext } from 'react';
import { PHContext } from './PHContext';

const ShowpH = () => {
    const { ph } = useContext(PHContext);
    return (
        <div className='body'>
            <span className='ph'>pH</span>
            <b className='numpH'>{ph}</b>
            <span className='state'>Estado: OK</span>
        
        </div>
    );
};

export default ShowpH;