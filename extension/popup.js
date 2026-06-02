const api = typeof browser !== 'undefined' ? browser : chrome
api.runtime.sendMessage({ type: 'GET_AUTH' }, (auth) => {
  const dot      = document.getElementById('dot')
  const title    = document.getElementById('status-title')
  const sub      = document.getElementById('status-sub')
  const helpText = document.getElementById('help-text')

  if (auth?.connected && auth.user) {
    dot.classList.add('dot-green')
    title.textContent = 'Connected'
    sub.textContent = auth.user.email ?? ''
  } else {
    dot.classList.add('dot-gray')
    title.textContent = 'Not connected'
    sub.textContent = 'Log in to Rivalize to get started'
    helpText.style.display = 'block'
  }
})
