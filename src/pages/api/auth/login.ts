import type { APIRoute } from 'astro'
import { authenticateUser, createSession, setSessionCookie } from '../../../lib/auth'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const user = authenticateUser(username, password)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const sessionId = createSession(user)
    const cookie = setSessionCookie(sessionId)

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: user.id, username: user.username, role: user.role }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
