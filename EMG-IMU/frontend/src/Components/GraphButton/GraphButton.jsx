/*
    GraphButton.jsx
    This is used for the buttons on the sidebar on the graph page.
*/
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