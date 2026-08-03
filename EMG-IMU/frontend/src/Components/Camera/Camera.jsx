/* 
    Camera.jsx 
    This is the camera component needed for the CVKAS.
    The signals move from main.py → GraphDashboard.jsx → Camera.jsx
*/
import { useEffect, useRef, useState } from 'react'
import './Camera.css'

// Detection space the backend sends marker positions in (must match the
// resize dimensions used in cameraHandler.py's camera_loop, currently 320x240).
const DETECTION_WIDTH = 320
const DETECTION_HEIGHT = 240

// hip(0) -> knee(1) -> ankle(2)
const SKELETON_LINKS = [[0, 1], [1, 2]]

const Camera = ({ cameraImage, cvStatus, markers = [], angles, onStart, onStop }) => {
    const containerRef = useRef(null)
    const imgRef = useRef(null)
    const canvasRef = useRef(null)

    // Holds the last known data for every marker id we've ever seen this session,
    // so markers stay visible (dimmed) even when the current frame doesn't detect them.
    const lastKnownRef = useRef({})
    const [mergedMarkers, setMergedMarkers] = useState([])

    // Merge incoming detections into the persistent cache whenever markers update.
    useEffect(() => {
        const currentIds = new Set(markers.map((m) => m.id))

        markers.forEach((m) => {
            if (m && typeof m.id === 'number') {
                lastKnownRef.current[m.id] = { ...m, stale: false }
            }
        })

        Object.keys(lastKnownRef.current).forEach((idKey) => {
            const id = Number(idKey)
            if (!currentIds.has(id)) {
                lastKnownRef.current[id] = { ...lastKnownRef.current[id], stale: true }
            }
        })

        setMergedMarkers(
            Object.values(lastKnownRef.current).sort((a, b) => a.id - b.id)
        )
    }, [markers])

    useEffect(() => {
        const canvas = canvasRef.current
        const img = imgRef.current
        if (!canvas || !img) return

        const displayWidth = img.clientWidth
        const displayHeight = img.clientHeight
        if (!displayWidth || !displayHeight) return

        canvas.width = displayWidth
        canvas.height = displayHeight

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, displayWidth, displayHeight)

        if (!mergedMarkers.length) return

        const scaleX = displayWidth / DETECTION_WIDTH
        const scaleY = displayHeight / DETECTION_HEIGHT

        // Look up by id rather than assuming array order/length.
        const byId = {}
        mergedMarkers.forEach((m) => {
            if (m && typeof m.id === 'number' && Array.isArray(m.position)) {
                byId[m.id] = m
            }
        })

        // Draw skeleton lines, skipping any segment where either endpoint is missing.
        // Stale segments (either endpoint not currently detected) are drawn dimmer.
        ctx.lineWidth = 3
        SKELETON_LINKS.forEach(([fromId, toId]) => {
            const from = byId[fromId]
            const to = byId[toId]
            if (!from || !to) return

            ctx.globalAlpha = (from.stale || to.stale) ? 0.35 : 1
            ctx.strokeStyle = '#14f195'
            ctx.beginPath()
            ctx.moveTo(from.position[0] * scaleX, from.position[1] * scaleY)
            ctx.lineTo(to.position[0] * scaleX, to.position[1] * scaleY)
            ctx.stroke()
        })

        // Draw a dot at each marker, last known position, dimmed if stale.
        Object.values(byId).forEach((m) => {
            ctx.globalAlpha = m.stale ? 0.35 : 1
            ctx.fillStyle = '#ff4d4d'
            ctx.beginPath()
            ctx.arc(m.position[0] * scaleX, m.position[1] * scaleY, 5, 0, Math.PI * 2)
            ctx.fill()
        })

        ctx.globalAlpha = 1
    }, [mergedMarkers])

    return (
        <div className="camera-panel">
            <div className="camera-preview" ref={containerRef} style={{ position: 'relative' }}>
                {cameraImage ? (
                    <>
                        <img
                            ref={imgRef}
                            src={cameraImage}
                            alt="Camera Preview"
                            onLoad={() => {
                                // Force a redraw once the image has real dimensions.
                                const canvas = canvasRef.current
                                if (canvas && imgRef.current) {
                                    canvas.width = imgRef.current.clientWidth
                                    canvas.height = imgRef.current.clientHeight
                                }
                            }}
                        />
                        <canvas
                            ref={canvasRef}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                        />
                    </>
                ) : (
                    <div className="camera-placeholder">No preview</div>
                )}
            </div>

            <div className="camera-kinematics">
                {angles ? (
                    <div className="camera-angles">
                        {angles.hip != null && <span>Hip: {angles.hip.toFixed(1)}°</span>}
                        {angles.knee != null && <span>Knee: {angles.knee.toFixed(1)}°</span>}
                    </div>
                ) : (
                    <div className="camera-angles">
                        <span>Hip: 0°</span>
                        <span>Knee: 0°</span>
                    </div>
                )}
                <div className="camera-markers-list">
                    {mergedMarkers.map((m) => (
                        <div
                            className={`camera-kinematics-row${m.stale ? ' stale' : ''}`}
                            key={m.id}
                        >
                            <span className="camera-kinematics-id">
                                Marker {m.id}{m.stale ? ' (last seen)' : ''}
                            </span>
                            <span>Vel: {m.velocity != null ? m.velocity.toFixed(2) : '—'} px/s</span>
                            <span>Accel: {m.acceleration != null ? m.acceleration.toFixed(2) : '—'} px/s²</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}

export default Camera