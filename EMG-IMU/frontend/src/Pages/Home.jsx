import { Link } from 'react-router-dom'
import { useState } from "react";

import '../CSS/home.css'

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

function Home() {
    const [showInputs, setShowInputs] = useState(false);
    const [name, setName] = useState("");
    const [port, setPort] = useState('COM4');
	const [ID, setID] = useState('');

    function handleStart() {
        setShowInputs(true);
    }

    return (
        <>
            <section className="main">
                <section className="title-block"> 
                    <h1 className="title">EMG and IMU Data Collector</h1>
                    <h2 className="subtitle">Alberta Bionix</h2>
                </section>
                <section className="work-block">
                    <section className='button-flex'>
                        <button onClick={handleStart} className="button">Start</button>
                        <Link className="button" to="/help">Help</Link>
                        <a className="button" href="https://drive.google.com" target="_blank" rel="noreferrer">Google Drive</a>
                    </section>

                    {/* appears below buttons when Start is clicked */}
                    {showInputs && (
                        <section id="start-section">
							<section className='input-section'>
								<p>Experiment</p>
								<input
									type="text"
									placeholder=""
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>	
							</section>
							<section className='input-section'>
								<p>ID Number</p>
								<input
									type="text"
									placeholder=""
									value={ID}
                                    onChange={(e) => setID(e.target.value)}
								/>	
							</section>
							<section className='input-section'>
                                <p>Port</p>
                                <select value={port} onChange={(e) => setPort(e.target.value)}>
                                    {PORT_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>	
							</section>
                            <Link
                                className="button"
                                to="/graphs"
                                state={{ name, port, ID }}
                            >
                                Submit
                            </Link>
                        </section>
                    )}

                </section>
            </section>
        </>
    );
}

export default Home