// The editor never saves or restores code: every visit to a problem starts with an empty editor.
// Only the chosen language is remembered. Storage can be blocked (private mode), so every access
// is guarded and simply does nothing then.

// Earlier versions kept code under "draft:<learner>:<problem>:<language>" and filled the editor
// with it on the next visit. Those copies are removed so no old code is left in the browser.
export function forgetSavedCode() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('draft:')) localStorage.removeItem(k)
    }
  } catch {
    // nothing stored
  }
}

export function preferredLanguage() {
  try {
    return localStorage.getItem('language') || 'JAVA'
  } catch {
    return 'JAVA'
  }
}

export function setPreferredLanguage(language) {
  try {
    localStorage.setItem('language', language)
  } catch {
    // not remembered
  }
}
