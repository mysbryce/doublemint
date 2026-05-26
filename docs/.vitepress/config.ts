import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Doublemint",
  description:
    "A production-oriented .dlm to C++20 transpiler with TypeScript-style ergonomics and a curated native stdlib.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  markdown: {
    languageAlias: {
      mint: "typescript",
      dlm: "typescript"
    }
  },
  head: [
    ["meta", { name: "theme-color", content: "#14d195" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Doublemint" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "TypeScript-style ergonomics. Native C++20 binaries. One curated stdlib."
      }
    ],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.googleapis.com" }
    ],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: ""
      }
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      }
    ]
  ],
  themeConfig: {
    siteTitle: "Doublemint",
    nav: [
      { text: "Docs", link: "/start/welcome" },
      { text: "Releases", link: "/releases/" },
      {
        text: "0.0.1-dev-32",
        items: [
          {
            text: "GitHub",
            link: "https://github.com/mysbryce/doublemint"
          },
          { text: "Changelog", link: "/releases/" }
        ]
      }
    ],
    sidebar: [
      {
        text: "Get Started",
        collapsed: false,
        items: [
          { text: "Welcome", link: "/start/welcome" },
          { text: "Install", link: "/start/install" },
          { text: "Quickstart", link: "/start/quickstart" },
          { text: "Project layout", link: "/start/project-layout" },
          { text: "Editor (VS Code)", link: "/start/editor" },
          { text: "Release workflow", link: "/start/release-workflow" }
        ]
      },
      {
        text: "Core & Transpiler",
        collapsed: false,
        items: [
          { text: "Pipeline", link: "/core/pipeline" },
          { text: "Type system", link: "/core/types" },
          { text: "Module resolver", link: "/core/modules" },
          { text: "Semantic checker", link: "/core/checker" },
          { text: "Emitter", link: "/core/emitter" },
          { text: "Native compiler", link: "/core/native-compiler" },
          { text: "Diagnostics", link: "/core/diagnostics" },
          { text: "Configuration", link: "/core/config" }
        ]
      },
      {
        text: "Language",
        collapsed: false,
        items: [
          { text: "Overview", link: "/language/overview" },
          { text: "Syntax", link: "/language/syntax" },
          { text: "Operators", link: "/language/operators" },
          { text: "Pattern matching", link: "/language/match" },
          { text: "Async / Await", link: "/language/async" },
          { text: "Lambdas & Generics", link: "/language/lambdas-generics" },
          { text: "Structs & Enums", link: "/language/structs-enums" },
          { text: "Native interop", link: "/language/native-interop" }
        ]
      },
      {
        text: "CLI",
        collapsed: false,
        items: [
          { text: "Commands", link: "/cli/commands" },
          { text: "build", link: "/cli/build" },
          { text: "check", link: "/cli/check" },
          { text: "fmt", link: "/cli/fmt" },
          { text: "repl", link: "/cli/repl" },
          { text: "init / info / version", link: "/cli/meta" }
        ]
      },
      {
        text: "Standard Library",
        collapsed: false,
        items: [
          { text: "Overview", link: "/stdlib/overview" },
          {
            text: "I/O & Console",
            collapsed: true,
            items: [{ text: "mint:io", link: "/stdlib/io" }]
          },
          {
            text: "Files & Modules",
            collapsed: true,
            items: [{ text: "mint:fs", link: "/stdlib/fs" }]
          },
          {
            text: "Strings & Collections",
            collapsed: true,
            items: [
              { text: "mint:string", link: "/stdlib/string" },
              { text: "mint:array", link: "/stdlib/array" },
              { text: "mint:collections", link: "/stdlib/collections" }
            ]
          },
          {
            text: "Math & Numerics",
            collapsed: true,
            items: [
              { text: "mint:math", link: "/stdlib/math" },
              { text: "mint:simd", link: "/stdlib/simd" },
              { text: "mint:fmt", link: "/stdlib/fmt" }
            ]
          },
          {
            text: "Time & OS",
            collapsed: true,
            items: [
              { text: "mint:time", link: "/stdlib/time" },
              { text: "mint:os", link: "/stdlib/os" },
              { text: "mint:process", link: "/stdlib/process" }
            ]
          },
          {
            text: "HTTP Server",
            collapsed: true,
            items: [{ text: "mint:http", link: "/stdlib/http" }]
          },
          {
            text: "Networking & Sockets",
            collapsed: true,
            items: [{ text: "mint:net", link: "/stdlib/net" }]
          },
          {
            text: "JSON & Schema",
            collapsed: true,
            items: [
              { text: "mint:json", link: "/stdlib/json" },
              { text: "mint:schema", link: "/stdlib/schema" }
            ]
          },
          {
            text: "Crypto & Hashing",
            collapsed: true,
            items: [
              { text: "mint:crypto", link: "/stdlib/crypto" },
              { text: "mint:base64", link: "/stdlib/base64" }
            ]
          },
          {
            text: "Regex & Logging",
            collapsed: true,
            items: [
              { text: "mint:regex", link: "/stdlib/regex" },
              { text: "mint:log", link: "/stdlib/log" }
            ]
          },
          {
            text: "Database",
            collapsed: true,
            items: [
              { text: "mint:sql", link: "/stdlib/sql" },
              { text: "mint:db", link: "/stdlib/db" }
            ]
          },
          {
            text: "Async & Memory",
            collapsed: true,
            items: [
              { text: "mint:async", link: "/stdlib/async" },
              { text: "mint:memory", link: "/stdlib/memory" }
            ]
          },
          {
            text: "Terminal & Testing",
            collapsed: true,
            items: [
              { text: "mint:term", link: "/stdlib/term" },
              { text: "mint:test", link: "/stdlib/test" }
            ]
          }
        ]
      },
      {
        text: "Releases",
        collapsed: false,
        items: [{ text: "Changelog", link: "/releases/" }]
      }
    ],
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
