import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Doublemint",
  description:
    "A production-oriented .dlm to C++20 transpiler with TypeScript-style ergonomics and a curated native stdlib.",
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    languageAlias: {
      mint: "typescript",
      dlm: "typescript"
    }
  },
  head: [
    ["meta", { name: "theme-color", content: "#5cd3a8" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Doublemint" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "TypeScript-style ergonomics. Native C++20 binaries. One curated stdlib."
      }
    ]
  ],
  themeConfig: {
    siteTitle: "Doublemint",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Language", link: "/language/overview" },
      { text: "CLI", link: "/cli/commands" },
      { text: "Stdlib", link: "/language/stdlib" },
      { text: "Releases", link: "/releases/" },
      {
        text: "0.0.1-dev-31",
        items: [
          {
            text: "GitHub",
            link: "https://github.com/mysbryce/doublemint"
          },
          { text: "Changelog", link: "/releases/" }
        ]
      }
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Install", link: "/guide/install" },
            { text: "Project layout", link: "/guide/project-layout" },
            { text: "Editor", link: "/guide/editor" }
          ]
        }
      ],
      "/language/": [
        {
          text: "Language",
          items: [
            { text: "Overview", link: "/language/overview" },
            { text: "Syntax", link: "/language/syntax" },
            { text: "Types", link: "/language/types" },
            { text: "Operators", link: "/language/operators" },
            { text: "Pattern matching", link: "/language/match" },
            { text: "Async / Await", link: "/language/async" },
            { text: "Stdlib", link: "/language/stdlib" },
            { text: "Native interop", link: "/language/native-interop" }
          ]
        }
      ],
      "/cli/": [
        {
          text: "CLI",
          items: [
            { text: "Commands", link: "/cli/commands" },
            { text: "Configuration", link: "/cli/config" },
            { text: "Diagnostics", link: "/cli/diagnostics" }
          ]
        }
      ],
      "/releases/": [
        {
          text: "Releases",
          items: [{ text: "Patch notes", link: "/releases/" }]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/mysbryce/doublemint" }
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Doublemint contributors"
    },
    search: {
      provider: "local"
    },
    editLink: {
      pattern:
        "https://github.com/mysbryce/doublemint/edit/main/docs/:path",
      text: "Edit this page on GitHub"
    },
    outline: {
      level: [2, 3]
    }
  }
});
