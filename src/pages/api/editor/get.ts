import type { APIRoute } from 'astro'
import matter from 'gray-matter'
import { requireAuth } from '../../../lib/auth'

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Check authentication
    const user = requireAuth(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const slug = url.searchParams.get('slug')
    
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Look for the post in the blog directory structure
    const blogDir = path.join(process.cwd(), 'src', 'content', 'blog')
    const postDir = path.join(blogDir, slug)
    const indexPath = path.join(postDir, 'index.md')
    
    let filePath: string
    try {
      await fs.access(indexPath)
      filePath = indexPath
    } catch {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const raw = await fs.readFile(filePath, 'utf-8')
    const { data, content } = matter(raw)
    
    return new Response(JSON.stringify({
      frontmatter: data,
      body: content
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching post:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch post' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
