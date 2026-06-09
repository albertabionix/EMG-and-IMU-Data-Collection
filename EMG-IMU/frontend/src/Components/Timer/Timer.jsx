import { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import './Timer.css'


const Timer = forwardRef((props, ref) => {
    const [timerDisplay, setTimerDisplay] = useState('0:00.00');

    const elapsed = useRef(0);
    const running = useRef(false);
    const intervalId = useRef(null);
    const startTime = useRef(null);

    function formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    useImperativeHandle(ref, () => ({
        start() {
            setTimerDisplay('0:00.00');
            if (running.current) return;
            running.current = true;
            startTime.current = Date.now() - elapsed.current;
            intervalId.current = setInterval(() => {
                elapsed.current = Date.now() - startTime.current;
                setTimerDisplay(formatTime(elapsed.current));
            }, 10);
        },
        stop() {
            running.current = false;
            clearInterval(intervalId.current);
            elapsed.current = 0;
        }
    }))

    return (
        <section className='timer-section'>
            <p className='timer'>{timerDisplay}</p>
        </section>
    )
})

export default Timer
