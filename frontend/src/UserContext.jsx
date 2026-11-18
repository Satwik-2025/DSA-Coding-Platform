import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import { useApi } from './useApi.js'

// No real login by design: a demo-user switcher. Every page reads the current learner from here.
const UserContext = createContext(null)

export function UserProvider({ children }) {
  const { data: users, error, reload } = useApi(api.users, [])
  // Remembered across refreshes so a demo doesn't jump back to the first user. Storage can be blocked
  // (private mode, strict settings); then the choice simply isn't remembered.
  const [userId, setUserId] = useState(() => {
    try {
      return Number(localStorage.getItem('userId')) || null
    } catch {
      return null
    }
  })

  useEffect(() => {
    // Fall back to the first seeded user if nothing is stored or the stored id no longer exists.
    if (users?.length && !users.some((u) => u.id === userId)) setUserId(users[0].id)
  }, [users, userId])

  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem('userId', userId)
    } catch {
      // not remembered
    }
  }, [userId])

  // Pages only see a learner that exists, so a stale stored id never sends requests for a missing user.
  const known = users?.some((u) => u.id === userId) ? userId : null

  return (
    <UserContext.Provider value={{ users, userId: known, setUserId, error, reload }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
