/*
    PortsDropdown.jsx
    This is a dropdown of all the possible ports.
*/
import React from 'react';
import './Dropdown.css'

const Dropdown = ({ label, value, onChange, options }) => {
    // Options may be plain strings (e.g. port names) or { label, value } pairs
    // (e.g. experiment names mapped to BionixDB's canonical Action tokens).
    return (
        <section className='input-section'>
            <p>{label}</p>
            <select value={value} onChange={onChange}>
                {options.map((option) => {
                    const optValue = typeof option === 'string' ? option : option.value
                    const optLabel = typeof option === 'string' ? option : option.label
                    return (
                        <option key={optValue} value={optValue}>
                            {optLabel}
                        </option>
                    )
                })}
            </select>
        </section>
    )
}

export default Dropdown