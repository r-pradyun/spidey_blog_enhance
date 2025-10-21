# Astro Blog with Editor Features

This is an enhanced version of the Astro blog with built-in editor and admin features, replicated from the Next.js blog.

## Features Added

### 🚀 Built-in MDX Editor (`/editor`)
- Real-time MDX preview with live rendering
- Drag & drop image uploads with instant preview
- Frontmatter management with validation
- Auto-save functionality with unsaved changes warning
- Load existing posts for editing

### 👨‍💼 Admin Dashboard (`/admin`)
- Admin authentication system
- Draft review and approval workflow
- Post approval/rejection with feedback
- Conflict detection for existing posts

### 🖼️ Image Workflow System
- Vercel Blob Storage integration for staging images
- Automatic image processing and GitHub commits
- CDN URLs for immediate preview
- Local path conversion for production

### 🔗 GitHub Integration
- Automatic commits to GitHub repository
- Real-time sync with repository
- Version control for all changes
- Webhook support for automatic updates

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# GitHub Integration (Required for auto-push)
GITHUB_TOKEN=your-github-personal-access-token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repository-name

# Admin Authentication
ADMIN_USERS=username1:password1:author1,username2:password2:author2

# Vercel Blob Storage (for image uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Revalidation Secret (for cache invalidation)
REVALIDATION_SECRET=your-super-secret-key-here-change-this

# GitHub Webhook (Optional)
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret-here
```

### 2. GitHub Setup

1. **Create Personal Access Token**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope
   - Copy the token

2. **Add Environment Variables**:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=your-username
   GITHUB_REPO=your-repo-name
   ```

### 3. Vercel Blob Setup

1. **Create Vercel Blob Store**:
   - Go to Vercel Dashboard → Storage → Blob
   - Create a new blob store
   - Copy the read/write token

2. **Add Environment Variable**:
   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_token_here
   ```

### 4. Admin Users Setup

Configure admin users in the `ADMIN_USERS` environment variable:

```bash
ADMIN_USERS=admin:password123:Admin User,editor:editorpass:Content Editor
```

Format: `username:password:display_name`

### 5. Installation

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 6. Development

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

## Usage

### Creating Posts

1. Navigate to `/editor`
2. Fill in the frontmatter fields
3. Write your MDX content
4. Upload images by dragging and dropping or pasting
5. Click "Save MDX" to save as draft

### Admin Workflow

1. Navigate to `/admin/login`
2. Sign in with admin credentials
3. Review pending drafts
4. Approve or reject posts with feedback
5. Approved posts are automatically published

### Image Workflow

1. **Upload**: Images are uploaded to Vercel Blob Storage for immediate preview
2. **Preview**: CDN URLs are inserted into MDX for instant rendering
3. **Publish**: When approved, images are downloaded and committed to GitHub
4. **Production**: MDX URLs are updated to use local paths for production

## API Routes

- `/api/editor/save` - Save MDX posts
- `/api/editor/upload` - Upload images to Vercel Blob
- `/api/admin/drafts` - Fetch draft posts
- `/api/admin/approve` - Approve/reject posts
- `/api/editor/list` - List existing posts
- `/api/editor/get` - Get specific post for editing
- `/api/editor/github-status` - Check GitHub configuration

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy!

The editor will automatically handle the read-only filesystem in Vercel by committing to GitHub.

### Other Platforms

For other deployment platforms, ensure:
- GitHub integration is configured
- Vercel Blob storage is accessible
- Environment variables are set

## Troubleshooting

### Common Issues

**"GitHub not configured" Error**
- Ensure `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` are set correctly
- Verify the token has `repo` scope permissions

**Images Not Persisting**
- Check `BLOB_READ_WRITE_TOKEN` is set correctly
- Ensure Vercel Blob store is accessible

**Admin Login Issues**
- Verify `ADMIN_USERS` format is correct
- Check username and password are properly encoded

**API Route Errors**
- Ensure all required environment variables are set
- Check file permissions for local development

## Architecture

### Component Structure

```
src/
├── pages/
│   ├── api/
│   │   ├── editor/
│   │   │   ├── save.ts
│   │   │   ├── upload.ts
│   │   │   ├── list.ts
│   │   │   ├── get.ts
│   │   │   └── github-status.ts
│   │   └── admin/
│   │       ├── drafts.ts
│   │       └── approve.ts
│   ├── editor.astro
│   ├── admin.astro
│   └── admin/
│       └── login.astro
├── lib/
│   └── github.ts
└── content/
    └── blog/
        └── drafts/
```

### Data Flow

1. **Editor**: User creates/edits posts → API saves to drafts
2. **Admin**: Reviews drafts → Approves/rejects posts
3. **GitHub**: Approved posts are committed to repository
4. **Images**: Uploaded to Blob → Processed on approval → Committed to GitHub
5. **Production**: Static generation with final content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
