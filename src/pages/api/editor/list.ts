import type { APIRoute } from 'astro'
import matter from 'gray-matter'
import { requireAuth } from '../../../lib/auth'

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const user = requireAuth(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const blogDir = path.join(process.cwd(), 'src', 'content', 'blog')
    
    // Get all blog files
    let blogFiles: string[] = []
    try {
      blogFiles = await fs.readdir(blogDir)
    } catch {
      blogFiles = []
    }
    
    const posts = await Promise.all(
      blogFiles
        .filter((f) => f.endsWith('.mdx') && !f.includes('drafts'))
        .map(async (f) => {
          try {
            const full = path.join(blogDir, f)
            const raw = await fs.readFile(full, 'utf-8')
            const { data } = matter(raw)
            
            const title = (data?.title as string) || f.replace(/\.mdx$/, '')
            const slug = f.replace(/\.mdx$/, '')
            
            return {
              title,
              slug
            }
          } catch (error) {
            console.error(`Error reading post ${f}:`, error)
            return null
          }
        })
    )
    
    const validPosts = posts.filter(p => p !== null)
    
    return new Response(JSON.stringify({ 
      posts: validPosts
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch posts' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
