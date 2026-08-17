import React from 'react';
import './Checkbox.css'

const Checkbox = ({ checked, label, onChange }) => {
    return (
        <label className="checkbox">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <div className="checkmark">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1.5" y="1.5" width={21} height={21} rx={5} ry={5} strokeWidth={3} />
                        <polyline points="7 10 12 16 22 2" strokeWidth={4} />
                    </g>
                </svg>
                <span>{label}</span>
            </div>
        </label>
    );
}

export default Checkbox;