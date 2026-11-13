import { requestFlaskJson } from './client.js'

export function changePort(portName) {
	return requestFlaskJson('/change-port', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ value: portName }),
	})
}

// { ports: [{ device, description }], current, connected, suggested }
export function listPorts() {
	return requestFlaskJson('/ports')
}
