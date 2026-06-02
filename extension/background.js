const RIVALIZE_URL = 'https://rivalize.gg'

// Restore auth state from storage on startup
let authState = { connected: false, access_token: null, user: null }
chrome.storage.local.get(['auth'], (result) => {
  if (result.auth) authState = result.auth
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_AUTH') {
    sendResponse(authState)
    return true
  }

  if (message.type === 'SET_AUTH') {
    authState = { connected: true, access_token: message.access_token, user: message.user }
    chrome.storage.local.set({ auth: authState })
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'CLEAR_AUTH') {
    authState = { connected: false, access_token: null, user: null }
    chrome.storage.local.remove('auth')
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'FETCH_TEAMS') {
    fetchTeams().then(sendResponse).catch(err => sendResponse({ error: err.message }))
    return true
  }

  if (message.type === 'IMPORT_DEMO') {
    importDemo(message.payload).then(sendResponse).catch(err => sendResponse({ error: err.message }))
    return true
  }
})

async function fetchTeams() {
  if (!authState.access_token) return { error: 'Not connected to Rivalize' }
  const res = await fetch(`${RIVALIZE_URL}/api/extension`, {
    headers: { Authorization: `Bearer ${authState.access_token}` },
  })
  return res.json()
}

async function importDemo(payload) {
  if (!authState.access_token) return { error: 'Not connected to Rivalize' }
  const res = await fetch(`${RIVALIZE_URL}/api/extension`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authState.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
