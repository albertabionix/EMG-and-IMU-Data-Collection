import React from 'react'
import './CountdownOverlay.css'

function CountdownOverlay({ value }) {
    if (value == null) return null

    return (
        <section className="countdown-overlay" aria-live="polite" aria-atomic="true">
            <section className="countdown-circle">
                <span>{value}</span>
            </section>
        </section>
    )
}

export default CountdownOverlay
