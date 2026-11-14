// In dev the Vite server (5173) talks to Flask on 5000. In a production build the
// app is served by Flask itself (packaged executable), so use the page's own origin.
const SOCKET_URL =
	import.meta.env.VITE_SOCKET_URL ||
	(import.meta.env.DEV ? 'http://127.0.0.1:5000' : window.location.origin)

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL

function buildUrl(path) {
	return `${API_BASE_URL}${path}`
}

export async function requestFlask(path, options = {}) {
	const response = await fetch(buildUrl(path), options)
	return response
}

export async function requestFlaskJson(path, options = {}) {
	const response = await requestFlask(path, options)
	const text = await response.text()

	let data = null
	if (text) {
		try {
			data = JSON.parse(text)
		} catch {
			data = text
		}
	}

	return { response, data }
}
