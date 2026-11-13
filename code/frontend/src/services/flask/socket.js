import { io } from 'socket.io-client'

// In dev the Vite server (5173) talks to Flask on 5000. In a production build the
// app is served by Flask itself (packaged executable), so use the page's own origin.
const SOCKET_URL =
	import.meta.env.VITE_SOCKET_URL ||
	(import.meta.env.DEV ? 'http://127.0.0.1:5000' : window.location.origin)

export function createFlaskSocket() {
	return io(SOCKET_URL, {
		transports: ['polling', 'websocket'],
		autoConnect: false,
	})
}
