import { useEffect, useRef, useState } from 'react'
import { createFlaskSocket } from '../../services'
import './terminal.css'

const MAX_LINES = 500;

function formatTimestamp() {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

// Pass an existing connected socket via the `socket` prop to avoid
// opening a second connection (e.g. reuse the one from Graphs.jsx).
// If no socket is passed, this component opens/owns its own.
function Terminal({ socket: externalSocket, maxLines = MAX_LINES }) {
    const [lines, setLines] = useState([]);
    const [connected, setConnected] = useState(false);
    const [paused, setPaused] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);

    const scrollRef = useRef(null);
    const pausedRef = useRef(false);
    const bufferRef = useRef([]);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        const socket = externalSocket || createFlaskSocket();
        const ownsSocket = !externalSocket;

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        const onSensorData = (packet) => {
            if (pausedRef.current) return;

            const raw = packet && packet.raw != null
                ? String(packet.raw)
                : JSON.stringify(packet);

            const entry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                time: formatTimestamp(),
                text: raw,
            };

            bufferRef.current.push(entry);
            if (bufferRef.current.length > maxLines) {
                bufferRef.current = bufferRef.current.slice(-maxLines);
            }
            setLines([...bufferRef.current]);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("sensor_data", onSensorData);

        if (ownsSocket) {
            socket.connect();
        } else if (socket.connected) {
            setConnected(true);
        }

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("sensor_data", onSensorData);
            if (ownsSocket) {
                socket.disconnect();
            }
        };
    }, [externalSocket, maxLines]);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines, autoScroll]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
        setAutoScroll(atBottom);
    };

    const handleClear = () => {
        bufferRef.current = [];
        setLines([]);
    };

    return (
        <section className="terminal-panel">
            <div className="terminal-toolbar">
                <span className={`terminal-status ${connected ? 'is-connected' : 'is-disconnected'}`}>
                    {connected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
                <span className="terminal-count">{lines.length} lines</span>
                <div className="terminal-actions">
                    <button type="button" onClick={() => setPaused((p) => !p)}>
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button type="button" onClick={handleClear}>Clear</button>
                </div>
            </div>
            <div className="terminal-body" ref={scrollRef} onScroll={handleScroll}>
                {lines.length === 0 && (
                    <div className="terminal-empty">Waiting for serial data...</div>
                )}
                {lines.map((line) => (
                    <div className="terminal-line" key={line.id}>
                        <span className="terminal-time">{line.time}</span>
                        <span className="terminal-text">{line.text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default Terminal;