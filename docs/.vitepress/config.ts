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
      { text: "Get Started", link: "/start/welcome" },
      { text: "Core", link: "/core/pipeline" },
      { text: "Language", link: "/language/overview" },
      { text: "Stdlib", link: "/stdlib/overview" },
      { text: "CLI", link: "/cli/commands" },
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
    sidebar: {
      "/start/": [
        {
          text: "1. Get Started",
          collapsed: false,
          items: [
            { text: "Welcome", link: "/start/welcome" },
            { text: "Install", link: "/start/install" },
            { text: "Quickstart", link: "/start/quickstart" },
            { text: "Project layout", link: "/start/project-layout" },
            { text: "Editor (VS Code)", link: "/start/editor" },
            { text: "Release workflow", link: "/start/release-workflow" }
          ]
        }
      ],
      "/core/": [
        {
          text: "2. Core & Transpiler",
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
        }
      ],
      "/language/": [
        {
          text: "3. Language",
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
        }
      ],
      "/cli/": [
        {
          text: "4. CLI",
          collapsed: false,
          items: [
            { text: "Commands", link: "/cli/commands" },
            { text: "build", link: "/cli/build" },
            { text: "check", link: "/cli/check" },
            { text: "fmt", link: "/cli/fmt" },
            { text: "repl", link: "/cli/repl" },
            { text: "init / info / version", link: "/cli/meta" }
          ]
        }
      ],
      "/stdlib/": [
        {
          text: "5. Standard Library",
          collapsed: false,
          items: [
            { text: "Overview", link: "/stdlib/overview" }
          ]
        },
        {
          text: "5.1 I/O & Console",
          collapsed: false,
          items: [{ text: "mint:io", link: "/stdlib/io" }]
        },
        {
          text: "5.2 Files & Modules",
          collapsed: false,
          items: [{ text: "mint:fs", link: "/stdlib/fs" }]
        },
        {
          text: "5.3 Strings & Collections",
          collapsed: false,
          items: [
            { text: "mint:string", link: "/stdlib/string" },
            { text: "mint:array", link: "/stdlib/array" },
            { text: "mint:collections", link: "/stdlib/collections" }
          ]
        },
        {
          text: "5.4 Math & Numerics",
          collapsed: false,
          items: [
            { text: "mint:math", link: "/stdlib/math" },
            { text: "mint:simd", link: "/stdlib/simd" }
          ]
        },
        {
          text: "5.5 Time & OS",
          collapsed: false,
          items: [
            { text: "mint:time", link: "/stdlib/time" },
            { text: "mint:os", link: "/stdlib/os" },
            { text: "mint:process", link: "/stdlib/process" }
          ]
        },
        {
          text: "5.6 HTTP Server",
          collapsed: false,
          items: [{ text: "mint:http", link: "/stdlib/http" }]
        },
        {
          text: "5.7 Networking & Sockets",
          collapsed: false,
          items: [{ text: "mint:net", link: "/stdlib/net" }]
        },
        {
          text: "5.8 JSON & Schema",
          collapsed: false,
          items: [
            { text: "mint:json", link: "/stdlib/json" },
            { text: "mint:schema", link: "/stdlib/schema" }
          ]
        },
        {
          text: "5.9 Crypto & Hashing",
          collapsed: false,
          items: [
            { text: "mint:crypto", link: "/stdlib/crypto" },
            { text: "mint:base64", link: "/stdlib/base64" }
          ]
        },
        {
          text: "5.10 Regex & Logging",
          collapsed: false,
          items: [
            { text: "mint:regex", link: "/stdlib/regex" },
            { text: "mint:log", link: "/stdlib/log" }
          ]
        },
        {
          text: "5.11 Database",
          collapsed: false,
          items: [
            { text: "mint:sql", link: "/stdlib/sql" },
            { text: "mint:db", link: "/stdlib/db" }
          ]
        },
        {
          text: "5.12 Async & Memory",
          collapsed: false,
          items: [
            { text: "mint:async", link: "/stdlib/async" },
            { text: "mint:memory", link: "/stdlib/memory" }
          ]
        },
        {
          text: "5.13 Terminal & Testing",
          collapsed: false,
          items: [
            { text: "mint:term", link: "/stdlib/term" },
            { text: "mint:test", link: "/stdlib/test" }
          ]
        }
      ],
      "/releases/": [
        {
          text: "6. Releases",
          collapsed: false,
          items: [{ text: "Changelog", link: "/releases/" }]
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
