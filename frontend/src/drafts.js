// The editor never saves or restores code: every visit to a problem starts with an empty editor.
// Only the chosen language (Python by default, or Java) is remembered. Storage can be blocked
// (private mode), so every access is guarded and simply does nothing then.

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
    const saved = localStorage.getItem('language')
    // Python is the default; C++ (no longer offered) falls back to it too.
    return saved === 'JAVA' || saved === 'PYTHON' ? saved : 'PYTHON'
  } catch {
    return 'PYTHON'
  }
}

export function setPreferredLanguage(language) {
  try {
    localStorage.setItem('language', language)
  } catch {
    // not remembered
  }
}
