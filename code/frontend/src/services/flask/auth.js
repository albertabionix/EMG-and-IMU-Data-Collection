import { requestFlaskJson } from './client.js'

export async function login(options = {}) {
    return requestFlaskJson('/auth/login', {
        method: 'POST',
        ...options,
    })
}