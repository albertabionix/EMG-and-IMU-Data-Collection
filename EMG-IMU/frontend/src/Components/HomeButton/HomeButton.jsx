import React from 'react';
import './HomeButton.css'

const HomeButton = ({ label, onClick }) => {
    return (
        <section className="homebutton-section">
            <button onClick={onClick} >{label}</button>
        </section>
    )
}

export default HomeButton