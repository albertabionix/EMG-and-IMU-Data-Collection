import React from 'react';
import './GraphButton.css'

const GraphButton = ({ label, name, onClick }) => {
    return (
        <section className="graphbutton-section">
            <button
                name='button'
                onClick={onClick}    
            >
                {label}
            </button>
        </section>
    )
}

export default GraphButton