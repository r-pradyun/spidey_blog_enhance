import type { APIRoute } from 'astro'
import { put } from '@vercel/blob'

function isValidSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Upload request received')
    
    // Get the raw body first to debug
    const rawBody = await request.text()
    console.log('Raw body length:', rawBody.length)
    console.log('Raw body preview:', rawBody.substring(0, 100))
    
    if (!rawBody || rawBody.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Parse JSON payload
    let body
    try {
      body = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON payload',
        details: parseError instanceof Error ? parseError.message : 'Unknown error'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const { slug, filename, fileType, fileSize, base64 } = body
    
    console.log('Slug:', slug)
    console.log('File:', filename, 'Size:', fileSize, 'Type:', fileType)
    console.log('Base64 length:', base64 ? base64.length : 'null')
    
    if (!slug || !isValidSlug(slug)) {
      return new Response(JSON.stringify({ error: 'invalid slug' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!base64 || !filename) {
      return new Response(JSON.stringify({ error: 'file data is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64, 'base64')

    const safeName = String(filename || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
    const timestamp = Date.now()
    const finalFilename = `${timestamp}-${safeName}`

    try {
      // Check if Vercel Blob token is available
      const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN
      console.log('Blob token found:', !!blobToken)
      console.log('Blob token length:', blobToken ? blobToken.length : 0)
      console.log('Blob token preview:', blobToken ? blobToken.substring(0, 20) + '...' : 'null')
      
      if (!blobToken) {
        console.log('⚠️ No Vercel Blob token found, saving locally for testing')
        
        // For testing without Vercel Blob, return a placeholder URL
        const localUrl = `/public/images/${finalFilename}`
        
        return new Response(JSON.stringify({ 
          ok: true, 
          url: localUrl,
          filename: finalFilename,
          message: '⚠️ Image saved locally (Vercel Blob not configured). Set BLOB_READ_WRITE_TOKEN in .env for cloud storage.'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Upload to Vercel Blob Storage
      console.log(`🚀 Uploading image to Vercel Blob: ${finalFilename}`)
      
      const blob = await put(finalFilename, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: fileType, // Use the provided fileType
        token: blobToken // Pass the token explicitly
      })
      
      console.log(`✅ Image uploaded to Vercel Blob successfully: ${blob.url}`)
      
      // Return the blob URL for immediate preview
      return new Response(JSON.stringify({ 
        ok: true, 
        url: blob.url, // This will be the CDN URL for preview
        filename: finalFilename,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        message: '✅ Image uploaded to Vercel Blob! It will be committed to GitHub when you publish the post.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
      
    } catch (blobError) {
      console.error('Vercel Blob upload error:', blobError)
      return new Response(JSON.stringify({ 
        error: 'Failed to upload image to Vercel Blob',
        details: blobError instanceof Error ? blobError.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
  } catch (e) {
    console.error('Upload error:', e)
    return new Response(JSON.stringify({ 
      error: 'upload failed',
      details: e instanceof Error ? e.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}