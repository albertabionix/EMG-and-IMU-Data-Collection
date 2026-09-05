/*
    PortsDropdown.jsx
    This is a dropdown of all the possible ports.
*/
import React from 'react';
import './CardImage.css'

const CardImage = ({ title, desc, img }) => {
    return (
        <section className='CardImage'>
            <h1 className='title'>{title}</h1>
            <p className='desc'>{desc}</p>
        </section>
    )
}

export default CardImage