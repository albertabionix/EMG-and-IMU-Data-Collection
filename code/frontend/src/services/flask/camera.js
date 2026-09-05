import { requestFlask } from './client.js'

export function startCamera() {
	return requestFlask('/camera/start', { method: 'POST' })
}

export function stopCamera() {
	return requestFlask('/camera/stop', { method: 'POST' })
}
