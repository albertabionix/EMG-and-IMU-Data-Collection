/*
    PortsDropdown.jsx
    This is a dropdown of all the possible ports.
*/
import React from 'react';
import './PortsDropdown.css'

const PORT_OPTIONS = [
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'COM10',
];

const PortsDropdown = ({ label, value, onChange }) => {
    return (
        <section className='input-section'>
            <p>{label}</p>
            <select value={value} onChange={onChange}>
                {PORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>	
        </section>
    )
}

export default PortsDropdown