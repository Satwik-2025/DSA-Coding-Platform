// Unsaved code is kept per learner, problem and language in localStorage, so leaving the page,
// refreshing or switching language never loses work. Storage can be blocked (private mode), so
// every access is guarded and simply does nothing then.

const key = (userId, problemId, language) => `draft:${userId}:${problemId}:${language}`

export function loadDraft(userId, problemId, language) {
  try {
    return localStorage.getItem(key(userId, problemId, language))
  } catch {
    return null
  }
}

export function saveDraft(userId, problemId, language, code) {
  try {
    localStorage.setItem(key(userId, problemId, language), code)
    return true
  } catch {
    return false
  }
}

export function clearDraft(userId, problemId, language) {
  try {
    localStorage.removeItem(key(userId, problemId, language))
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
