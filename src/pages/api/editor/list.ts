import type { APIRoute } from 'astro'
import matter from 'gray-matter'
import { requireAuth } from '../../../lib/auth'
import { GitHubAPI } from '../../../lib/github'

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

    // Check if GitHub is configured (for production deployment)
    const isGitHubConfigured = import.meta.env.GITHUB_TOKEN && 
                              import.meta.env.GITHUB_OWNER && 
                              import.meta.env.GITHUB_REPO

    if (isGitHubConfigured) {
      // Fetch posts from GitHub
      try {
        console.log('🔗 Fetching blog posts from GitHub...')
        const github = new GitHubAPI(
          import.meta.env.GITHUB_TOKEN,
          import.meta.env.GITHUB_OWNER,
          import.meta.env.GITHUB_REPO
        )

        // Get the latest commit to access the current tree
        const ref = await github.getRef('main')
        const latestCommit = await github.getCommit(ref.object.sha)
        
        // Get the tree recursively to find all blog posts
        const treeResponse = await fetch(
          `https://api.github.com/repos/${import.meta.env.GITHUB_OWNER}/${import.meta.env.GITHUB_REPO}/git/trees/${latestCommit.tree.sha}?recursive=1`,
          {
            headers: {
              'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        )

        if (!treeResponse.ok) {
          throw new Error(`GitHub API error: ${treeResponse.status}`)
        }

        const treeData = await treeResponse.json()
        
        // Filter for blog post directories (src/content/blog/*/index.md)
        const blogPostFiles = treeData.tree.filter((file: any) => 
          file.path.startsWith('src/content/blog/') && 
          file.path.endsWith('/index.md') &&
          file.type === 'blob' &&
          !file.path.includes('/drafts/')
        )

        console.log(`📝 Found ${blogPostFiles.length} blog posts in GitHub`)

        // Fetch each blog post content to get metadata
        const posts = await Promise.all(
          blogPostFiles.map(async (file: any) => {
            try {
              // Get the file content from GitHub
              const contentResponse = await fetch(
                `https://api.github.com/repos/${import.meta.env.GITHUB_OWNER}/${import.meta.env.GITHUB_REPO}/contents/${file.path}`,
                {
                  headers: {
                    'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                  }
                }
              )

              if (!contentResponse.ok) {
                console.error(`Failed to fetch content for ${file.path}`)
                return null
              }

              const contentData = await contentResponse.json()
              const content = Buffer.from(contentData.content, 'base64').toString('utf-8')
              const { data } = matter(content)
              
              // Extract slug from path (src/content/blog/slug/index.md)
              const slug = file.path.split('/')[3]
              
              return {
                title: (data?.title as string) || slug,
                slug,
                lastModified: data?.lastmod || data?.date || new Date().toISOString()
              }
            } catch (error) {
              console.error(`Error processing post ${file.path}:`, error)
              return null
            }
          })
        )

        const validPosts = posts.filter(p => p !== null)
        console.log(`✅ Successfully fetched ${validPosts.length} blog posts from GitHub`)

        return new Response(JSON.stringify({ 
          posts: validPosts,
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
    console.log('📁 Fetching blog posts from local filesystem...')
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
        .filter((f) => {
          // Filter for directories (blog post folders)
          const fullPath = path.join(blogDir, f)
          return !f.startsWith('.') && !f.includes('drafts')
        })
        .map(async (f) => {
          try {
            // Look for index.md in each blog directory
            const indexPath = path.join(blogDir, f, 'index.md')
            const raw = await fs.readFile(indexPath, 'utf-8')
            const { data } = matter(raw)
            
            const title = (data?.title as string) || f
            const slug = f
            
            return {
              title,
              slug,
              lastModified: data?.lastmod || data?.date || new Date().toISOString()
            }
          } catch (error) {
            console.error(`Error reading post ${f}:`, error)
            return null
          }
        })
    )
    
    const validPosts = posts.filter(p => p !== null)
    
    return new Response(JSON.stringify({ 
      posts: validPosts,
      source: 'local'
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
