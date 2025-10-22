import type { APIRoute } from 'astro'
import { requireAuth } from '../../../lib/auth'

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = requireAuth(request)
    
    if (!user) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ 
      authenticated: true,
      user: { id: user.id, username: user.username, role: user.role }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Auth verify error:', error)
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
