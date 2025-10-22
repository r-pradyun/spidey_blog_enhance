import type { APIRoute } from 'astro'
import { requireAuth } from '../../../lib/auth'
import { GitHubAPI } from '../../../lib/github'

export const DELETE: APIRoute = async ({ request, url }) => {
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
      return new Response(JSON.stringify({ error: 'Slug parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if GitHub is configured
    if (!import.meta.env.GITHUB_TOKEN || !import.meta.env.GITHUB_OWNER || !import.meta.env.GITHUB_REPO) {
      return new Response(JSON.stringify({ 
        error: 'GitHub integration not configured. Cannot delete posts without GitHub access.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Initialize GitHub API
    const github = new GitHubAPI(
      import.meta.env.GITHUB_TOKEN,
      import.meta.env.GITHUB_OWNER,
      import.meta.env.GITHUB_REPO
    )
    
    try {
      console.log(`🗑️ Deleting blog post "${slug}" from GitHub...`)
      
      // Delete the blog post from GitHub
      const result = await github.deleteBlogPost(slug)
      
      console.log(`✅ Successfully deleted blog post "${slug}" from GitHub`)
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Blog post "${slug}" deleted successfully`,
        deletedFiles: result.deletedFiles,
        commit: result.commit
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (githubError) {
      console.error('GitHub delete error:', githubError)
      return new Response(JSON.stringify({ 
        error: 'Failed to delete blog post from GitHub',
        details: githubError instanceof Error ? githubError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Delete blog post error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
