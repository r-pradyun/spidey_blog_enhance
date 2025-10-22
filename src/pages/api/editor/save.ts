import type { APIRoute } from 'astro'
import { GitHubAPI } from '../../../lib/github'
import { requireAuth } from '../../../lib/auth'

type RequestBody = {
  frontmatter: Record<string, unknown>
  body: string
  slug: string
}

function toArrayOrUndefined(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (Array.isArray(value)) return value.map(String)
  const s = String(value).trim()
  if (!s) return undefined
  return s
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

function buildFrontmatter(fm: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}
  
  // Only include fields that are defined in the blog collection schema
  if (fm.title) fields.title = String(fm.title)
  if (fm.date) fields.date = String(fm.date)
  if (fm.draft !== undefined) fields.draft = Boolean(fm.draft)
  const summary = String(fm.summary || '').trim()
  if (summary) fields.summary = summary
  const tags = toArrayOrUndefined(fm.tags)
  if (tags) fields.tags = tags
  
  return fields
}

function serializeFrontmatter(obj: Record<string, unknown>) {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      const arr = (value as unknown[]).map((v) => JSON.stringify(v)).join(', ')
      lines.push(`${key}: [${arr}]`)
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'string') {
      const needsQuote = /[:#>-]/.test(value)
      lines.push(`${key}: ${needsQuote ? JSON.stringify(value) : value}`)
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function getRequestAuthor(request: Request): string | null {
  const header = request.headers.get('x-editor-author')
  if (!header) return null
  return header.trim()
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const user = requireAuth(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = (await request.json()) as RequestBody
    const { frontmatter, body: mdxBody, slug } = body

    if (!frontmatter || !frontmatter.title || !frontmatter.date) {
      return new Response(JSON.stringify({ error: 'title and date are required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!slug || /[^a-z0-9-]/.test(slug)) {
      return new Response(JSON.stringify({ error: 'invalid slug' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create folder structure: slug/index.md
    const filename = `${slug}/index.md`
    const fm = buildFrontmatter(frontmatter)
    
    const fmText = serializeFrontmatter(fm)
    const content = `${fmText}\n\n${mdxBody || ''}\n`

    // Process Vercel Blob images before saving
    let processedContent = content
    let imageProcessingResult: any = null
    
    try {
      // Check if there are any Vercel Blob URLs in the content
      if (content.includes('blob.vercel-storage.com') || content.includes('vercel-storage.com')) {
        console.log('🔄 Processing Vercel Blob images...')
        
        // Check if GitHub is configured
        if (!import.meta.env.GITHUB_TOKEN || !import.meta.env.GITHUB_OWNER || !import.meta.env.GITHUB_REPO) {
          console.warn('⚠️ GitHub not configured - skipping blob image processing')
        } else {
          // Extract all image URLs from the MDX content
          const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
          const images: Array<{blobUrl: string, filename: string, localPath: string}> = []
          let match

          while ((match = imageRegex.exec(content)) !== null) {
            const [, , url] = match
            
            // Check if this is a Vercel Blob URL
            if (url.includes('blob.vercel-storage.com') || url.includes('vercel-storage.com')) {
              const filename = url.split('/').pop() || `image-${Date.now()}.png`
              const localPath = `public/static/images/${slug}/${filename}`
              
              images.push({
                blobUrl: url,
                filename,
                localPath
              })
            }
          }

          if (images.length > 0) {
            console.log(`🔍 Found ${images.length} Vercel Blob images to process`)

            // Create GitHub API instance
            const github = new GitHubAPI(
              import.meta.env.GITHUB_TOKEN,
              import.meta.env.GITHUB_OWNER,
              import.meta.env.GITHUB_REPO
            )

            const processedImages: string[] = []
            const failedImages: string[] = []

            // Process each image
            for (const image of images) {
              try {
                console.log(`📥 Processing image: ${image.filename}`)
                
                // Download image from Blob URL with timeout and retry
                let response
                let retries = 3
                
                while (retries > 0) {
                  try {
                    response = await fetch(image.blobUrl, {
                      headers: {
                        'User-Agent': 'Blog-Editor/1.0'
                      }
                    })
                    break
                  } catch (error) {
                    retries--
                    if (retries === 0) {
                      console.error(`Failed to download image after 3 attempts: ${error}`)
                      throw new Error(`Network timeout downloading image: ${error}`)
                    }
                    console.log(`Retry ${3 - retries} downloading image...`)
                    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
                  }
                }
                
                if (!response || !response.ok) {
                  throw new Error(`Failed to download image: ${response?.status} ${response?.statusText}`)
                }
                
                const imageBuffer = await response.arrayBuffer()
                const base64Content = Buffer.from(imageBuffer).toString('base64')
                
                console.log(`📊 Image size: ${imageBuffer.byteLength} bytes`)
                
                // Commit image to GitHub
                const commitMessage = `Add image for blog post: ${slug} - ${image.filename}`
                
                await github.createOrUpdateFile(
                  image.localPath,
                  base64Content,
                  commitMessage
                )
                
                console.log(`✅ Image committed to GitHub: ${image.localPath}`)
                
                // Replace ALL occurrences of this Blob URL with local path in MDX content
                const localUrl = `/static/images/${slug}/${image.filename}`
                processedContent = processedContent.replaceAll(image.blobUrl, localUrl)
                
                console.log(`🔄 Replaced Blob URL with local path: ${localUrl}`)
                
                processedImages.push(image.filename)
                
              } catch (error) {
                console.error(`❌ Failed to process image ${image.filename}:`, error)
                failedImages.push(image.filename)
              }
            }
            
            // Final verification: ensure no Blob URLs remain
            const remainingBlobUrls = processedContent.match(/blob\.vercel-storage\.com|vercel-storage\.com/g)
            if (remainingBlobUrls && remainingBlobUrls.length > 0) {
              console.warn(`⚠️ Warning: ${remainingBlobUrls.length} Blob URLs still remain in processed content`)
            } else {
              console.log('✅ All Blob URLs successfully replaced with local paths')
            }

            imageProcessingResult = {
              processed: processedImages,
              failed: failedImages,
              total: images.length
            }
          } else {
            console.log('ℹ️ No Vercel Blob images found in MDX content')
          }
        }
      }
    } catch (processError) {
      console.error('Image processing error:', processError)
      // Continue with original content if processing fails
    }

    // In production (Vercel), we can't write to the filesystem
    // So we only write to GitHub and rely on the build process
    let githubResult = null
    let localWriteSuccess = false

    // Try to write to GitHub first (this is the primary method)
    if (import.meta.env.GITHUB_TOKEN && import.meta.env.GITHUB_OWNER && import.meta.env.GITHUB_REPO) {
      try {
        console.log('🔗 Attempting GitHub integration...')
        const github = new GitHubAPI(
          import.meta.env.GITHUB_TOKEN,
          import.meta.env.GITHUB_OWNER,
          import.meta.env.GITHUB_REPO
        )
        
        const commitMessage = fm.draft ? `Add/Update draft post: ${frontmatter.title}` : `Publish post: ${frontmatter.title}`
        
        // Encode the MDX content as base64 for GitHub API
        const base64Content = Buffer.from(processedContent, 'utf-8').toString('base64')
        
        console.log(`📄 MDX Content length: ${processedContent.length} characters`)
        console.log(`📄 Base64 Content length: ${base64Content.length} characters`)
        console.log(`📄 Base64 validation: ${/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content) ? '✅ Valid' : '❌ Invalid'}`)
        
        // Determine the correct path based on draft status
        const targetPath = fm.draft ? `src/content/blog/drafts/${filename}` : `src/content/blog/${filename}`
        
        githubResult = await github.createOrUpdateFile(
          targetPath,
          base64Content, // Send base64 encoded content
          commitMessage
        )
        
        if (githubResult) {
          console.log('Successfully committed to GitHub:', filename)
        }
      } catch (error) {
        console.error('GitHub push error:', error)
        console.log('⚠️ GitHub integration failed, continuing with local save only')
        // If GitHub fails, we'll try local write as fallback
      }
    }

    // Fallback: Try to write locally (for development or if GitHub fails)
    if (!githubResult) {
      try {
        // For Astro, we'll write to the content directory
        const fs = await import('fs/promises')
        const path = await import('path')
        
        // Determine the correct directory based on draft status
        const baseDir = path.join(process.cwd(), 'src', 'content', 'blog', fm.draft ? 'drafts' : '')
        const filePath = path.join(baseDir, filename)
        
        // Create the directory structure (including the slug folder)
        const fileDir = path.dirname(filePath)
        try {
          await fs.access(fileDir)
        } catch {
          await fs.mkdir(fileDir, { recursive: true })
        }

        await fs.writeFile(filePath, processedContent, 'utf-8') // Use processedContent for local write (not base64)
        localWriteSuccess = true
        console.log('Successfully wrote locally:', filePath)
      } catch (localError) {
        console.error('Local write error:', localError)
        
        // If both GitHub and local write fail, return error
        if (!githubResult) {
          return new Response(JSON.stringify({ 
            error: 'Failed to save MDX file',
            details: localError instanceof Error ? localError.message : 'Unknown error'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }

    const targetPath = fm.draft ? `src/content/blog/drafts/${filename}` : `src/content/blog/${filename}`
    const statusText = fm.draft ? 'Draft saved' : 'Post published'
    
    return new Response(JSON.stringify({ 
      ok: true, 
      path: targetPath,
      github: githubResult ? { committed: true, sha: (githubResult as any).commit?.sha } : null,
      local: localWriteSuccess,
      images: imageProcessingResult,
      message: githubResult 
        ? imageProcessingResult && imageProcessingResult.processed && imageProcessingResult.processed.length > 0
          ? `${statusText} successfully! ${imageProcessingResult.processed.length} images processed.`
          : `${statusText} successfully!`
        : localWriteSuccess 
          ? `${statusText} locally (GitHub not configured)` 
          : statusText
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
