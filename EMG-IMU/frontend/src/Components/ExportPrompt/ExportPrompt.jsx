/*
    ExportPrompt.jsx
    Shown after a recording is stopped — asks whether to upload it to
    BionixDB (Export) or discard the local CSV (Cancel).
*/
import React from 'react';
import './ExportPrompt.css'

const ExportPrompt = ({ onExport, onCancel, exporting }) => {
    return (
        <section className="export-prompt-overlay">
            <section className="export-prompt-box">
                <p>Upload this recording to BionixDB?</p>
                <section className="export-prompt-buttons">
                    <button onClick={onCancel} disabled={exporting}>Cancel</button>
                    <button onClick={onExport} disabled={exporting}>
                        {exporting ? 'Exporting...' : 'Export'}
                    </button>
                </section>
            </section>
        </section>
    )
}

export default ExportPrompt
