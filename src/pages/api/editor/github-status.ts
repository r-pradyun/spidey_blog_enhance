import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  try {
    const githubConfigured = !!(
      import.meta.env.GITHUB_TOKEN && 
      import.meta.env.GITHUB_OWNER && 
      import.meta.env.GITHUB_REPO
    )
    
    return new Response(JSON.stringify({
      configured: githubConfigured,
      owner: githubConfigured ? import.meta.env.GITHUB_OWNER : null,
      repo: githubConfigured ? import.meta.env.GITHUB_REPO : null
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error checking GitHub status:', error)
    return new Response(JSON.stringify({ error: 'Failed to check GitHub status' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
