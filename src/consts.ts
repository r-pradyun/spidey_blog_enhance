import type { Site, Page, Links, Socials } from "@types"

// Global
export const SITE: Site = {
  TITLE: "Spidey @ NOVA",
  DESCRIPTION: "Exploring CTFs, exploits, and security research as part of Team NOVA. Hack. Learn. Share.",
  AUTHOR: "Spidey",
}

// Work Page
export const WORK: Page = {
  TITLE: "Work",
  DESCRIPTION: "Places I have worked.",
}

// Blog Page
export const BLOG: Page = {
  TITLE: "Blog",
  DESCRIPTION: "Writing on topics I am passionate about.",
}

// Projects Page 
export const PROJECTS: Page = {
  TITLE: "Projects",
  DESCRIPTION: "Recent projects I have worked on.",
}

// Search Page
export const SEARCH: Page = {
  TITLE: "Search",
  DESCRIPTION: "Search all posts and projects by keyword.",
}

// Links
export const LINKS: Links = [
  { 
    TEXT: "Home", 
    HREF: "/", 
  },
  { 
    TEXT: "Work", 
    HREF: "/work", 
  },
  { 
    TEXT: "Blog", 
    HREF: "/blog", 
  },
  // { 
  //   TEXT: "Editor", 
  //   HREF: "/editor", 
  // },
  // { 
  //   TEXT: "Projects", 
  //   HREF: "/projects", 
  // },
]

// Socials
export const SOCIALS: Socials = [
  { 
    NAME: "Email",
    ICON: "email", 
    TEXT: "itsmepradyun@proton.me",
    HREF: "mailto:itsmepradyun@proton.me",
  },
  // { 
  //   NAME: "Github",
  //   ICON: "github",
  //   TEXT: "markhorn-dev",
  //   HREF: "https://github.com/markhorn-dev/astro-sphere"
  // },
  { 
    NAME: "LinkedIn",
    ICON: "linkedin",
    TEXT: "Pradyun",
    HREF: "https://linkedin.com/in/pradyun-rengasamy/",
  },
  // { 
  //   NAME: "Twitter",
  //   ICON: "twitter-x",
  //   TEXT: "markhorn_dev",
  //   HREF: "https://twitter.com/markhorn_dev",
  // },
]

