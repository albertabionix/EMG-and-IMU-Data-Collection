import { requestFlask, requestFlaskJson } from './client.js'

export function startRecording(payload) {
	return requestFlaskJson('/record/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
}

export function stopRecording() {
	return requestFlask('/record/stop', { method: 'POST' })
}

export function exportRecording() {
	return requestFlaskJson('/export', { method: 'POST' })
}

export function discardRecording({ keepalive = false } = {}) {
	return requestFlaskJson('/record/discard', {
		method: 'POST',
		keepalive,
	})
}
