import { useEffect, useRef } from 'react'

import { MetronomeAudio } from '../../assets'

function Metronome({ enabled = false, isRecording = false, intervalMs = 1000 }) {
    const audioRef = useRef(null)
    const intervalRef = useRef(null)

    const stopMetronome = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
    }

    const playTick = () => {
        if (!audioRef.current) return

        audioRef.current.currentTime = 0
        audioRef.current.play().catch((err) => {
            console.error('Metronome playback failed:', err)
        })
    }

    useEffect(() => {
        const audio = new Audio(MetronomeAudio)
        audio.preload = 'auto'
        audio.volume = 0.9
        audioRef.current = audio

        return () => {
            stopMetronome()
            audioRef.current = null
        }
    }, [])

    useEffect(() => {
        if (!(enabled && isRecording)) {
            stopMetronome()
            return
        }

        playTick()
        intervalRef.current = setInterval(playTick, intervalMs)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [enabled, isRecording, intervalMs])

    return null
}

export default Metronome
