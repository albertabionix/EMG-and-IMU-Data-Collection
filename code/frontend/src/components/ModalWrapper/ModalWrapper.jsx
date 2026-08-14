import { useEffect } from 'react'
import Terminal from "../Terminal/Terminal.jsx"
import './ModalWrapper.css'

function ModalWrapper({ isOpen, onClose, socket }) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="terminal-modal-overlay" onClick={onClose}>
            <div
                className="terminal-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="terminal-modal-header">
                    <span>Serial Terminal</span>
                    <button
                        type="button"
                        className="terminal-modal-close"
                        onClick={onClose}
                        aria-label="Close terminal"
                    >
                        ✕
                    </button>
                </div>
                <div className="terminal-modal-body">
                    <Terminal socket={socket} />
                </div>
            </div>
        </div>
    );
}

export default ModalWrapper;