/*
    EMG-Graph.jsx
    Displays EMG channel data from the dashboard state as the backend emits it.
*/
import './EMG-Graph.css'

const ADC_MAX_COUNT = 4095 // 12-bit ADC (analogReadResolution(12) in firmware)
const AXIS_MIN_X = 6
const AXIS_MAX_X = 205
const AXIS_MIN_Y = 6
const AXIS_MAX_Y = 110
const AXIS_VIEWBOX_X = -12
const AXIS_VIEWBOX_Y = 0
const AXIS_VIEWBOX_WIDTH = 224
const AXIS_VIEWBOX_HEIGHT = 112
const AXIS_VIEWBOX = `${AXIS_VIEWBOX_X} ${AXIS_VIEWBOX_Y} ${AXIS_VIEWBOX_WIDTH} ${AXIS_VIEWBOX_HEIGHT}`

const toTopPercent = (svgY) =>
    ((svgY - AXIS_VIEWBOX_Y) / AXIS_VIEWBOX_HEIGHT) * 100

function buildPoints(values) {
    const safeValues = Array.isArray(values) ? values : []

    if (safeValues.length <= 1) {
        return `${AXIS_MIN_X},${(AXIS_MIN_Y + AXIS_MAX_Y) / 2}`
    }

    const scaled = safeValues.map((value) => {
        const count = Math.max(0, Math.min(Number(value) || 0, ADC_MAX_COUNT))
        return (count / ADC_MAX_COUNT) * (AXIS_MAX_Y - AXIS_MIN_Y)
    })

    return scaled
        .map((value, index) => {
            const x = AXIS_MIN_X + (index / (scaled.length - 1)) * (AXIS_MAX_X - AXIS_MIN_X)
            const y = AXIS_MAX_Y - value
            return `${x},${y}`
        })
        .join(' ')
}

function EMGChart({ values, channelIndex }) {
    const points = buildPoints(values)
    const TICK_INTERVAL = 1000

    const yTicks = []
    for (let i = 0; i <= ADC_MAX_COUNT; i += TICK_INTERVAL) {
        const yPercent = AXIS_MAX_Y - (i / ADC_MAX_COUNT) * (AXIS_MAX_Y - AXIS_MIN_Y)
        yTicks.push({ value: i, yPercent })
    }

    return (
        <div className="emg-chart-wrapper">
            <svg
                viewBox={AXIS_VIEWBOX}
                preserveAspectRatio="none"
                aria-label={`EMG ${channelIndex + 1} graph`}
                className="emg-chart"
            >
                {yTicks.map((tick, idx) => (
                    <line key={`grid-${idx}`} x1={AXIS_MIN_X} y1={tick.yPercent} x2={AXIS_MAX_X} y2={tick.yPercent} className="grid-line" />
                ))}
                <line x1={AXIS_MIN_X} y1={AXIS_MIN_Y} x2={AXIS_MIN_X} y2={AXIS_MAX_Y} className="axis" />
                <polyline points={points} className="emg-line" />
            </svg>

            <div className="emg-tick-labels">
                {yTicks.map((tick, idx) => (
                    <span
                        key={`ticklabel-${idx}`}
                        className="emg-tick-label"
                        style={{ top: `${toTopPercent(tick.yPercent)}%` }}
                    >
                        {tick.value}
                    </span>
                ))}
                <span className="emg-axis-label">counts</span>
            </div>
        </div>
    )
}

const EMGGraph = ({ series = [], isLive = false }) => {
    const channelCount = Math.max(series.length, 2)
    const hasData = series.some((channel) => Array.isArray(channel) && channel.length > 0)
    const liveStatus = isLive || hasData

    return (
        <section className="emggraph-section">
            {Array.from({ length: channelCount }).map((_, index) => (
                <section className="EMGPanel" key={`emg-${index}`}>
                    <div className="emg-panel-header">
                        <h3>{index === 0 ? 'Quad' : 'Hamstring'}</h3>
                        <span className={`imu-status ${liveStatus ? 'live' : 'offline'}`}>
                            {liveStatus ? 'LIVE' : 'NO DATA'}
                        </span>
                    </div>
                    <div className="emg-graph">
                        <EMGChart values={Array.isArray(series[index]) ? series[index] : []} channelIndex={index} />
                    </div>
                </section>
            ))}
        </section>
    )
}

export default EMGGraph