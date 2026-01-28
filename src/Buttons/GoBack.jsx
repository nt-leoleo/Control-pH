import './GoBack.css'

export const ChevronLeft = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="1em" 
        height="1em" 
        viewBox="0 0 24 24" 
        {...props}
    >
        <path fill="currentColor" d="M15.41 7.41L14 6l-6 6l6 6l1.41-1.41L10.83 12l4.58-4.59z"></path>
    </svg>
);
const GoBack = () => {
    return (
        <button className="goBack">
            <ChevronLeft className="icon" />
        </button>
    );
};

export default GoBack;