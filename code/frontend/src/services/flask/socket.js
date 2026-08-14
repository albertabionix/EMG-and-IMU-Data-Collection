import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000'

export function createFlaskSocket() {
	return io(SOCKET_URL, {
		transports: ['polling', 'websocket'],
		autoConnect: false,
	})
}
