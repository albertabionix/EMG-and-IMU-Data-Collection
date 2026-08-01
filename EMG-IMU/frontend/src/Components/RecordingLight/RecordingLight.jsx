import React from 'react';
import './RecordingLight.css';

function RecordingLight({ isRecording = true }) {
  	if (!isRecording) return null;

	return (
		<div className="RecordingLight">
			<div className='recordingIndicator'>
				<div className='dotCore'></div>
				<div className='dotPulse'></div>
			</div>
			<span className='recordingText'>REC</span>
		</div>
	);
}

export default RecordingLight
