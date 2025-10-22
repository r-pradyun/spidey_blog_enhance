// Simple authentication system for the blog editor
// In production, you should use a proper authentication system like Auth0, Firebase Auth, etc.

export interface User {
  id: string
  username: string
  role: 'admin' | 'editor'
}

// Simple in-memory session storage (in production, use proper session management)
const sessions = new Map<string, { user: User; expires: number }>()

// Configuration - in production, these should be environment variables
const AUTH_CONFIG = {
  username: process.env.EDITOR_USERNAME || 'admin',
  password: process.env.EDITOR_PASSWORD || 'admin123',
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
}

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function createSession(user: User): string {
  const sessionId = generateSessionId()
  const expires = Date.now() + AUTH_CONFIG.sessionDuration
  
  sessions.set(sessionId, { user, expires })
  
  // Clean up expired sessions
  for (const [id, session] of sessions.entries()) {
    if (session.expires < Date.now()) {
      sessions.delete(id)
    }
  }
  
  return sessionId
}

export function getSession(sessionId: string): User | null {
  const session = sessions.get(sessionId)
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionId)
    return null
  }
  return session.user
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function authenticateUser(username: string, password: string): User | null {
  if (username === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
    return {
      id: '1',
      username: AUTH_CONFIG.username,
      role: 'admin'
    }
  }
  return null
}

export function requireAuth(request: Request): User | null {
  const cookieHeader = request.headers.get('cookie')
  console.log('Cookie header:', cookieHeader)
  
  if (!cookieHeader) {
    console.log('No cookie header found')
    return null
  }
  
  const sessionId = cookieHeader
    .split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1]

  console.log('Session ID:', sessionId)

  if (!sessionId) {
    console.log('No session ID found in cookies')
    return null
  }

  const user = getSession(sessionId)
  console.log('User from session:', user)
  return user
}

export function setSessionCookie(sessionId: string): string {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${AUTH_CONFIG.sessionDuration / 1000}; Path=/`
}

export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
}
