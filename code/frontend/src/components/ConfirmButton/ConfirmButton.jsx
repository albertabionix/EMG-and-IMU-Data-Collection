/*
    ConfirmButton.jsx
    This is used to confirm the experiment, ID, and port on the home page.
*/
import React from 'react';
import './ConfirmButton.css'

const ConfirmButton = ({ label, name, onClick }) => {
    return (
        <section className="confirmbutton-section">
            <button
                name='button'
                onClick={onClick}    
            >
                {label}
            </button>
        </section>
    )
}

export default ConfirmButton