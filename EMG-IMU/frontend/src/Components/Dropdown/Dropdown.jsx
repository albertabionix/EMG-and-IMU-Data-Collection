/*
    PortsDropdown.jsx
    This is a dropdown of all the possible ports.
*/
import React from 'react';
import './Dropdown.css'

const Dropdown = ({ label, value, onChange, options }) => {
    return (
        <section className='input-section'>
            <p>{label}</p>
            <select value={value} onChange={onChange}>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>	
        </section>
    )
}

export default Dropdown