import React from 'react';
import './HomeInput.css'

const HomeInput = ({ label, type = "text", name, placeholder, value, onChange }) => {
	return (
		<section className="input-section">
			<label className="label" htmlFor={name}>{label}</label>
			<input
				autoComplete="off"
				name={name}
				id={name}
				className="input"
				type={type}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				/>
		</section>
	)
}

export default HomeInput