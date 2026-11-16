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
    const error = new Error(message || `HTTP ${res.status}`)
    error.status = res.status
    throw error
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
  submit: (userId, problemId, code, timeSpentSeconds, language) =>
    request('/submissions', post({ userId, problemId, code, timeSpentSeconds, language })), // 5.1
  submitJob: (userId, problemId, code, timeSpentSeconds, language) =>
    request('/submissions/jobs', post({ userId, problemId, code, timeSpentSeconds, language })), // 5.11
  job: (jobId) => request(`/submissions/jobs/${jobId}`),                             // 5.11
  run: (userId, problemId, code, language, input) =>
    request('/run', post({ userId, problemId, code, language, input })),             // 5.12
  languages: () => request('/languages'),                                            // 5.13
  history: (userId, problemId) => request(`/users/${userId}/problems/${problemId}/submissions`), // 5.14
  review: (userId, horizonDays = 3) => request(`/users/${userId}/review?horizonDays=${horizonDays}`), // 5.15
  activity: (userId, days = 182) => request(`/users/${userId}/activity?days=${days}`),  // 5.16
  problemStatus: (userId) => request(`/users/${userId}/problem-status`),             // 5.17
  studyPlans: (userId) => request(`/study-plans?userId=${userId}`),                  // 5.18
  model: () => request('/ml/model'),                                                 // 5.19
}

// Submits through the judge queue and polls until the verdict is ready.
// onProgress receives { status: 'QUEUED' | 'RUNNING', position, testsDone, testsTotal }.
export async function submitAndWait(userId, problemId, code, timeSpentSeconds, language, onProgress) {
  let job = await api.submitJob(userId, problemId, code, timeSpentSeconds, language)
  while (job.status === 'QUEUED' || job.status === 'RUNNING') {
    onProgress?.(job)
    await new Promise((r) => setTimeout(r, 350))
    job = await api.job(job.jobId)
  }
  if (job.status === 'FAILED') {
    const error = new Error(job.error?.message || 'Judging failed')
    error.status = job.error?.error === 'TOO_MANY_REQUESTS' ? 429 : 500
    throw error
  }
  return job.result
}
