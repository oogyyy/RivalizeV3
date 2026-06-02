// Inject Rivalize import UI on FACEIT CS2 match room pages.
// Handles SPA navigation by observing URL changes.
const api = typeof browser !== 'undefined' ? browser : chrome

let currentMatchId = null

function getMatchId() {
  const m = window.location.pathname.match(/\/cs2\/room\/([a-zA-Z0-9-]+)/)
  return m ? m[1] : null
}

function removePanel() {
  document.getElementById('rvz-root')?.remove()
  document.getElementById('rvz-btn')?.remove()
}

function injectButton(matchId) {
  if (document.getElementById('rvz-btn')) return

  const btn = document.createElement('button')
  btn.id = 'rvz-btn'
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Import to Rivalize</span>
  `
  btn.onclick = () => openPanel(matchId)
  document.body.appendChild(btn)
}

function openPanel(matchId) {
  if (document.getElementById('rvz-root')) return

  const root = document.createElement('div')
  root.id = 'rvz-root'
  root.innerHTML = `
    <div id="rvz-panel">
      <div id="rvz-header">
        <span id="rvz-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Rivalize
        </span>
        <button id="rvz-close">✕</button>
      </div>
      <div id="rvz-body">
        <div id="rvz-loading" class="rvz-center">
          <div class="rvz-spinner"></div>
          <span>Checking connection…</span>
        </div>
        <div id="rvz-not-connected" class="rvz-hidden">
          <p class="rvz-hint">You're not logged in to Rivalize.</p>
          <a href="https://rivalize.pro" target="_blank" class="rvz-link-btn">Open Rivalize ↗</a>
        </div>
        <div id="rvz-form" class="rvz-hidden">
          <div class="rvz-field">
            <label class="rvz-label">Destination</label>
            <div class="rvz-radio-group">
              <label class="rvz-radio"><input type="radio" name="rvz-dest" value="personal" checked> Personal library</label>
              <label class="rvz-radio"><input type="radio" name="rvz-dest" value="team"> My team</label>
              <label class="rvz-radio"><input type="radio" name="rvz-dest" value="opponent"> Opponents</label>
            </div>
          </div>

          <div id="rvz-team-field" class="rvz-field rvz-hidden">
            <label class="rvz-label">Team</label>
            <select id="rvz-team-select" class="rvz-select"></select>
          </div>

          <div id="rvz-opponent-field" class="rvz-field rvz-hidden">
            <label class="rvz-label">Opponent name</label>
            <input id="rvz-opponent-input" class="rvz-input" type="text" placeholder="e.g. Astralis" maxlength="100">
            <label class="rvz-label" style="margin-top:8px">Team</label>
            <select id="rvz-opponent-team-select" class="rvz-select"></select>
          </div>

          <div class="rvz-field">
            <label class="rvz-label">Your faction</label>
            <div class="rvz-radio-group">
              <label class="rvz-radio"><input type="radio" name="rvz-faction" value="faction1" checked> Faction 1</label>
              <label class="rvz-radio"><input type="radio" name="rvz-faction" value="faction2"> Faction 2</label>
            </div>
          </div>

          <button id="rvz-import-btn" class="rvz-primary-btn">Import demo</button>
          <p id="rvz-status" class="rvz-status rvz-hidden"></p>
        </div>
      </div>
    </div>
    <div id="rvz-backdrop"></div>
  `
  document.body.appendChild(root)

  document.getElementById('rvz-close').onclick = () => root.remove()
  document.getElementById('rvz-backdrop').onclick = () => root.remove()

  const destRadios = root.querySelectorAll('input[name="rvz-dest"]')
  destRadios.forEach(r => r.addEventListener('change', onDestChange))

  document.getElementById('rvz-import-btn').onclick = () => doImport(matchId)

  // Load auth + teams
  api.runtime.sendMessage({ type: 'GET_AUTH' }, (auth) => {
    document.getElementById('rvz-loading').classList.add('rvz-hidden')
    if (!auth?.connected) {
      document.getElementById('rvz-not-connected').classList.remove('rvz-hidden')
      return
    }
    document.getElementById('rvz-form').classList.remove('rvz-hidden')

    api.runtime.sendMessage({ type: 'FETCH_TEAMS' }, (data) => {
      if (data?.error) {
        showStatus('Failed to load teams: ' + data.error, 'error')
        return
      }
      populateTeamSelects(data)
    })
  })
}

function onDestChange() {
  const val = document.querySelector('input[name="rvz-dest"]:checked')?.value
  document.getElementById('rvz-team-field').classList.toggle('rvz-hidden', val !== 'team')
  document.getElementById('rvz-opponent-field').classList.toggle('rvz-hidden', val !== 'opponent')
}

function populateTeamSelects(data) {
  const teams = data?.teams ?? []
  const selects = ['rvz-team-select', 'rvz-opponent-team-select']
  selects.forEach(id => {
    const el = document.getElementById(id)
    el.innerHTML = teams.length
      ? teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')
      : '<option value="" disabled>No teams found</option>'
  })
}

async function doImport(matchId) {
  const dest = document.querySelector('input[name="rvz-dest"]:checked')?.value ?? 'personal'
  const faction = document.querySelector('input[name="rvz-faction"]:checked')?.value ?? 'faction1'
  const teamSelect = document.getElementById('rvz-team-select')
  const oppTeamSelect = document.getElementById('rvz-opponent-team-select')
  const oppInput = document.getElementById('rvz-opponent-input')

  if (dest === 'team' && !teamSelect.value) {
    showStatus('Please select a team.', 'error'); return
  }
  if (dest === 'opponent') {
    if (!oppInput.value.trim()) {
      showStatus('Please enter the opponent name.', 'error'); return
    }
    if (!oppTeamSelect.value) {
      showStatus('Please select a team.', 'error'); return
    }
  }

  const btn = document.getElementById('rvz-import-btn')
  btn.disabled = true
  btn.textContent = 'Importing…'
  showStatus('', 'hidden')

  const payload = {
    match_id: matchId,
    destination: dest,
    player_faction: faction,
    ...(dest === 'team' && { team_id: teamSelect.value }),
    ...(dest === 'opponent' && {
      team_id: oppTeamSelect.value,
      opponent_name: oppInput.value.trim(),
    }),
  }

  api.runtime.sendMessage({ type: 'IMPORT_DEMO', payload }, (res) => {
    btn.disabled = false
    btn.textContent = 'Import demo'
    if (res?.ok) {
      showStatus('✓ Demo imported successfully!', 'success')
    } else {
      showStatus(res?.error ?? 'Import failed. Try again.', 'error')
    }
  })
}

function showStatus(msg, type) {
  const el = document.getElementById('rvz-status')
  el.textContent = msg
  el.className = 'rvz-status ' + (type === 'hidden' ? 'rvz-hidden' : type === 'success' ? 'rvz-success' : 'rvz-error')
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── SPA navigation observer ──────────────────────────────────────────────────

function checkPage() {
  const matchId = getMatchId()
  if (matchId !== currentMatchId) {
    currentMatchId = matchId
    removePanel()
    if (matchId) {
      // Small delay to let FACEIT's SPA render
      setTimeout(() => injectButton(matchId), 800)
    }
  }
}

// Patch history API to detect SPA navigation
const _push = history.pushState.bind(history)
const _replace = history.replaceState.bind(history)
history.pushState = (...args) => { _push(...args); checkPage() }
history.replaceState = (...args) => { _replace(...args); checkPage() }
window.addEventListener('popstate', checkPage)

// Initial check
checkPage()
