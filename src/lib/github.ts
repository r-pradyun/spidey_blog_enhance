interface GitHubFile {
  path: string
  mode: '100644' | '100755' | '040000' | '160000' | '120000'
  type: 'blob' | 'tree' | 'commit'
  content?: string
  sha?: string
}

interface GitHubCommit {
  message: string
  author: {
    name: string
    email: string
  }
  committer: {
    name: string
    email: string
  }
  tree: string
  parents: string[]
}

export class GitHubAPI {
  private token: string
  private owner: string
  private repo: string
  private baseURL = 'https://api.github.com'

  constructor(token: string, owner: string, repo: string) {
    this.token = token
    this.owner = owner
    this.repo = repo
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}/repos/${this.owner}/${this.repo}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`GitHub API Error Details:`, {
        status: response.status,
        statusText: response.statusText,
        url: url,
        error: errorText,
        contentLength: options.body ? (options.body as string).length : 0
      })
      throw new Error(`GitHub API error: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  async getRef(branch: string = 'main') {
    return this.request(`/git/ref/heads/${branch}`)
  }

  async getCommit(sha: string) {
    return this.request(`/git/commits/${sha}`)
  }

  async createTree(baseTree: string, files: GitHubFile[]) {
    return this.request('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTree,
        tree: files,
      }),
    })
  }

  async createCommit(commit: GitHubCommit) {
    return this.request('/git/commits', {
      method: 'POST',
      body: JSON.stringify(commit),
    })
  }

  async updateRef(branch: string, sha: string) {
    return this.request(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha }),
    })
  }

  async createOrUpdateFile(path: string, content: string, message: string, branch: string = 'main') {
    try {
      // Try to get existing file to get its SHA
      const existingFile = await this.request(`/contents/${path}?ref=${branch}`)
      const sha = existingFile.sha

      // Update existing file - content should be base64 encoded
      return this.request(`/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: content, // Should be base64 encoded
          sha,
          branch,
        }),
      })
    } catch (error: any) {
      if (error.message.includes('404')) {
        // File doesn't exist, create new one
        return this.request(`/contents/${path}`, {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: content, // Should be base64 encoded
            branch,
          }),
        })
      }
      throw error
    }
  }

  async deleteFile(path: string, message: string, branch: string = 'main') {
    try {
      // Get the file to get its SHA (required for deletion)
      const existingFile = await this.request(`/contents/${path}?ref=${branch}`)
      const sha = existingFile.sha

      // Delete the file
      return this.request(`/contents/${path}`, {
        method: 'DELETE',
        body: JSON.stringify({
          message,
          sha,
          branch,
        }),
      })
    } catch (error: any) {
      if (error.message.includes('404')) {
        // File doesn't exist, nothing to delete
        console.log(`File ${path} doesn't exist, nothing to delete`)
        return { deleted: false, reason: 'File not found' }
      }
      throw error
    }
  }

  async commitFiles(files: Array<{ path: string; content: string }>, message: string, branch: string = 'main') {
    try {
      // Get the latest commit SHA
      const ref = await this.getRef(branch)
      const latestCommit = await this.getCommit(ref.object.sha)

      // Create tree with new files
      const treeFiles: GitHubFile[] = files.map(file => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      }))

      const tree = await this.createTree(latestCommit.tree.sha, treeFiles)

      // Create commit
      const commit = await this.createCommit({
        message,
        author: {
          name: 'Blog Editor',
          email: 'editor@blog.com',
        },
        committer: {
          name: 'Blog Editor',
          email: 'editor@blog.com',
        },
        tree: tree.sha,
        parents: [latestCommit.sha],
      })

      // Update branch reference
      await this.updateRef(branch, commit.sha)

      return commit
    } catch (error) {
      console.error('Error committing files:', error)
      throw error
    }
  }

  async deleteBlogPost(slug: string, branch: string = 'main') {
    try {
      console.log(`🗑️ Starting deletion of blog post: ${slug}`)
      
      // First, get all files in the blog post directory
      const treeResponse = await this.request(`/git/trees/HEAD?recursive=1`)
      const blogPostFiles = treeResponse.tree.filter((file: any) => 
        file.path.startsWith(`src/content/blog/${slug}/`) && file.type === 'blob'
      )

      if (blogPostFiles.length === 0) {
        throw new Error(`Blog post "${slug}" not found`)
      }

      console.log(`📁 Found ${blogPostFiles.length} files to delete in blog post: ${slug}`)

      // Delete each file individually using the Contents API
      const deletedFiles: string[] = []
      const failedFiles: string[] = []

      for (const file of blogPostFiles) {
        try {
          console.log(`🗑️ Deleting file: ${file.path}`)
          
          // Get the file's SHA first
          const fileResponse = await this.request(`/contents/${file.path}?ref=${branch}`)
          const fileSha = fileResponse.sha

          // Delete the file
          await this.request(`/contents/${file.path}`, {
            method: 'DELETE',
            body: JSON.stringify({
              message: `Delete file from blog post: ${slug}`,
              sha: fileSha,
              branch: branch,
            }),
          })

          deletedFiles.push(file.path)
          console.log(`✅ Successfully deleted: ${file.path}`)
          
        } catch (fileError: any) {
          console.error(`❌ Failed to delete file ${file.path}:`, fileError.message)
          failedFiles.push(file.path)
        }
      }

      if (deletedFiles.length === 0) {
        throw new Error(`Failed to delete any files from blog post: ${slug}`)
      }

      console.log(`✅ Successfully deleted ${deletedFiles.length} files from blog post: ${slug}`)
      if (failedFiles.length > 0) {
        console.warn(`⚠️ Failed to delete ${failedFiles.length} files:`, failedFiles)
      }

      return {
        success: true,
        deletedFiles: deletedFiles.length,
        failedFiles: failedFiles.length,
        deletedFilePaths: deletedFiles,
        failedFilePaths: failedFiles
      }
    } catch (error) {
      console.error('Error deleting blog post:', error)
      throw error
    }
  }
}
