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

    // Check if GitHub is configured (for production deployment)
    const isGitHubConfigured = import.meta.env.GITHUB_TOKEN && 
                              import.meta.env.GITHUB_OWNER && 
                              import.meta.env.GITHUB_REPO

    if (isGitHubConfigured) {
      // Fetch post from GitHub
      try {
        console.log(`🔗 Fetching blog post "${slug}" from GitHub...`)
        
        const filePath = `src/content/blog/${slug}/index.md`
        
        const contentResponse = await fetch(
          `https://api.github.com/repos/${import.meta.env.GITHUB_OWNER}/${import.meta.env.GITHUB_REPO}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        )

        if (!contentResponse.ok) {
          if (contentResponse.status === 404) {
            return new Response(JSON.stringify({ error: 'Post not found' }), { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          throw new Error(`GitHub API error: ${contentResponse.status}`)
        }

        const contentData = await contentResponse.json()
        const content = Buffer.from(contentData.content, 'base64').toString('utf-8')
        const { data, content: body } = matter(content)
        
        console.log(`✅ Successfully fetched blog post "${slug}" from GitHub`)

        return new Response(JSON.stringify({
          frontmatter: data,
          body: body,
          source: 'github'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })

      } catch (githubError) {
        console.error('GitHub fetch error:', githubError)
        // Fall back to local filesystem if GitHub fails
      }
    }

    // Fallback: Use local filesystem (for development)
    console.log(`📁 Fetching blog post "${slug}" from local filesystem...`)
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
      body: content,
      source: 'local'
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
