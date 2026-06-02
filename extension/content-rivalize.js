// Runs on every rivalize.gg page. Fetches the extension session token using
// the user's existing browser cookies (same-origin fetch includes them automatically).
const api = typeof browser !== 'undefined' ? browser : chrome
;(async () => {
  try {
    const res = await fetch('/api/extension/connect')
    if (!res.ok) {
      api.runtime.sendMessage({ type: 'CLEAR_AUTH' })
      return
    }
    const data = await res.json()
    if (data.connected && data.access_token) {
      api.runtime.sendMessage({
        type: 'SET_AUTH',
        access_token: data.access_token,
        user: data.user,
      })
    } else {
      api.runtime.sendMessage({ type: 'CLEAR_AUTH' })
    }
  } catch {
    // Extension may not be active — ignore
  }
})()
