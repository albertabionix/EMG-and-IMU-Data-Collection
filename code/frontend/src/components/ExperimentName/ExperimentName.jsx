/*
    ExperimentName.jsx
    This is used to confirm the experiment, ID, and port on the home page.
*/
import React from 'react';
import './ExperimentName.css'

const ExperimentName = ({ subtitle, title }) => {
    return (
        <section className="ExperimentName-section">
            <p className='subtitle'>{subtitle}</p>
            <p className='title'>{title}</p>
        </section>
    )
}

export default ExperimentName