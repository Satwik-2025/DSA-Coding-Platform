// Every backend call lives here, one line per endpoint, so this file can be checked
// line-by-line against CONTRACT.md section 5. Paths are relative: Vite proxies /api.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    // Contract error body is { error, message }; show the backend's own message, not a generic "failed".
    let message
    try {
      message = (await res.json()).message
    } catch {
      // No JSON body: the Vite proxy itself answered, which means Spring Boot is not reachable.
      message = `Could not reach the backend (HTTP ${res.status}). Is Spring Boot running?`
    }
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

const post = (body) => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  users: () => request('/users'),                                                    // 5.2
  retention: (userId) => request(`/users/${userId}/retention`),                      // 5.3
  recommendations: (userId, limit = 5) =>
    request(`/users/${userId}/recommendations?limit=${limit}`),                      // 5.4
  weakness: (userId) => request(`/users/${userId}/weakness`),                        // 5.5
  readiness: (userId) => request(`/users/${userId}/readiness`),                      // 5.6
  setSelfRating: (userId, topicId, rating) =>
    request(`/users/${userId}/self-rating`, post({ topicId, rating })),              // 5.7
  topicGraph: (userId) => request(`/topics/graph?userId=${userId}`),                 // 5.8
  problems: (filters = {}) => {                                                      // 5.9
    // Drop empty filters: the backend 400s on difficulty="" (invalid enum).
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
    return request(`/problems${query ? `?${query}` : ''}`)
  },
  problem: (id) => request(`/problems/${id}`),                                       // 5.10
  submit: (userId, problemId, code, timeSpentSeconds) =>
    request('/submissions', post({ userId, problemId, code, timeSpentSeconds })),    // 5.1
}
