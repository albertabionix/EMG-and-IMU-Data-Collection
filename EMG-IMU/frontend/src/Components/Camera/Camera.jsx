/* 
    Camera.jsx 
    This is the camera component needed for the CVKAS.
    The signals move from main.py → GraphDashboard.jsx → Camera.jsx
*/
import './Camera.css'

const Camera = ({ cameraImage }) => {
    return (
        <div className="camera-panel">
            <div className="camera-preview">
                {cameraImage ? (
                    <img src={cameraImage} alt="Camera Preview" />
                ) : (
                    <div className="camera-placeholder">No preview</div>
                )}
            </div>
        </div>
    )
}

export default Camera