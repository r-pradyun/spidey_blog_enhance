// Simple authentication system for the blog editor
// Using JWT tokens stored in cookies for serverless compatibility

export interface User {
  id: string
  username: string
  role: 'admin' | 'editor'
}

// Configuration - in production, these should be environment variables
const AUTH_CONFIG = {
  username: process.env.EDITOR_USERNAME || 'admin',
  password: process.env.EDITOR_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this',
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
}

// Simple JWT implementation for serverless compatibility
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  str += '='.repeat((4 - str.length % 4) % 4)
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  return atob(str)
}

function createJWT(payload: any): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  
  // Simple HMAC simulation (in production, use a proper crypto library)
  const signature = base64UrlEncode(`${encodedHeader}.${encodedPayload}.${AUTH_CONFIG.jwtSecret}`)
  
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function verifyJWT(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [header, payload, signature] = parts
    const expectedSignature = base64UrlEncode(`${header}.${payload}.${AUTH_CONFIG.jwtSecret}`)
    
    if (signature !== expectedSignature) return null
    
    const decodedPayload = JSON.parse(base64UrlDecode(payload))
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now()) {
      return null
    }
    
    return decodedPayload
  } catch (error) {
    return null
  }
}

export function createSession(user: User): string {
  const payload = {
    user,
    exp: Date.now() + AUTH_CONFIG.sessionDuration
  }
  return createJWT(payload)
}

export function getSession(token: string): User | null {
  const payload = verifyJWT(token)
  if (payload && payload.user) {
    return payload.user
  }
  return null
}

export function destroySession(): string {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function authenticateUser(username: string, password: string): User | null {
  if (username === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
    return { id: '1', username: AUTH_CONFIG.username, role: 'admin' }
  }
  return null
}

export function setSessionCookie(token: string): string {
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_CONFIG.sessionDuration / 1000}`
}

export function clearSessionCookie(): string {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function requireAuth(request: Request): User | null {
  const cookieHeader = request.headers.get('cookie')
  console.log('Cookie header:', cookieHeader)

  if (!cookieHeader) {
    console.log('No cookie header found')
    return null
  }

  const sessionToken = cookieHeader
    .split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1]

  console.log('Session token:', sessionToken)

  if (!sessionToken) {
    console.log('No session token found in cookies')
    return null
  }

  const user = getSession(sessionToken)
  console.log('User from session:', user)
  return user
}