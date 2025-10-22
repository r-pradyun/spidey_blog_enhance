import type { MiddlewareHandler } from 'astro'
import { requireAuth } from './lib/auth'

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, url } = context
  
  // Only protect the editor route
  if (url.pathname.startsWith('/editor')) {
    const user = requireAuth(request)
    if (!user) {
      return Response.redirect(new URL('/login', url.origin))
    }
  }
  
  return next()
}
