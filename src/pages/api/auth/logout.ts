import type { APIRoute } from 'astro'
import { destroySession, clearSessionCookie, requireAuth } from '../../../lib/auth'

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = requireAuth(request)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // No need to destroy session since we're using stateless JWT

    const cookie = clearSessionCookie()

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      }
    })
  } catch (error) {
    console.error('Logout error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
