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

export function exportRecording({ local = false } = {}) {
	return requestFlaskJson('/export', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ local }),
	})
}

export function discardRecording({ keepalive = false } = {}) {
	return requestFlaskJson('/record/discard', {
		method: 'POST',
		keepalive,
	})
}
