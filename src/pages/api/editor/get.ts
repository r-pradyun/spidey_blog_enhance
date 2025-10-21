import type { APIRoute } from 'astro'
import matter from 'gray-matter'

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('slug')
    
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Try to find the post in drafts first, then in published posts
    const draftPath = path.join(process.cwd(), 'src', 'content', 'blog', 'drafts', `${slug}.mdx`)
    const blogPath = path.join(process.cwd(), 'src', 'content', 'blog', `${slug}.mdx`)
    
    let filePath: string
    try {
      await fs.access(draftPath)
      filePath = draftPath
    } catch {
      try {
        await fs.access(blogPath)
        filePath = blogPath
      } catch {
        return new Response(JSON.stringify({ error: 'Post not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
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
