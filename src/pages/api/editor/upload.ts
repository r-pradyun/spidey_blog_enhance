import type { APIRoute } from 'astro'
import { put } from '@vercel/blob'

function isValidSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const slug = String(form.get('slug') || '')
    const file = form.get('file') as File | null

    if (!slug || !isValidSlug(slug)) {
      return new Response(JSON.stringify({ error: 'invalid slug' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!file) {
      return new Response(JSON.stringify({ error: 'file is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const safeName = String(file.name || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
    const timestamp = Date.now()
    const filename = `${timestamp}-${safeName}`

    try {
      // Upload to Vercel Blob Storage
      console.log(`🚀 Uploading image to Vercel Blob: ${filename}`)
      
      const blob = await put(filename, buffer, {
        access: 'public',
        addRandomSuffix: false,
      })
      
      console.log(`✅ Image uploaded to Vercel Blob successfully: ${blob.url}`)
      
      // Return the blob URL for immediate preview
      return new Response(JSON.stringify({ 
        ok: true, 
        url: blob.url, // This will be the CDN URL for preview
        filename,
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
    return new Response(JSON.stringify({ error: 'upload failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
