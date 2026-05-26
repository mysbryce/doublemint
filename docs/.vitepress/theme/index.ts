import DefaultTheme from "vitepress/theme";
import type { EnhanceAppContext } from "vitepress";
import "./style.css";

const ICON_MAP: Record<string, string> = {
  "Get Started": "rocket",
  "Core & Transpiler": "settings",
  "Language": "book",
  "CLI": "terminal",
  "Standard Library": "package",
  "Releases": "tag",

  // Standard Library sub-categories
  "I/O & Console": "monitor",
  "Files & Modules": "folder",
  "Strings & Collections": "type",
  "Math & Numerics": "calculator",
  "Time & OS": "clock",
  "HTTP Server": "globe",
  "Networking & Sockets": "plug",
  "JSON & Schema": "file-json",
  "Crypto & Hashing": "lock",
  "Regex & Logging": "search",
  "Database": "database",
  "Async & Memory": "zap",
  "Terminal & Testing": "flask"
};

function applyIcons(): void {
  const headers = document.querySelectorAll(
    ".VPSidebarItem.level-0 > .item .text, .VPSidebarItem.level-1 > .item .text"
  );
  for (const node of Array.from(headers)) {
    const label = (node.textContent ?? "").trim();
    const icon = ICON_MAP[label];
    const el = node as HTMLElement;
    if (icon) {
      if (el.getAttribute("data-icon") !== icon) {
        el.setAttribute("data-icon", icon);
      }
    } else if (el.hasAttribute("data-icon")) {
      el.removeAttribute("data-icon");
    }
  }
}

function installSidebarIconObserver(): void {
  if (typeof document === "undefined") { return; }
  // Apply once now (in case sidebar is already mounted) and again on
  // every mutation under <body> so SPA navigation and sidebar
  // expand/collapse both keep the icons in place.
  applyIcons();
  const root = document.body;
  const observer = new MutationObserver(() => applyIcons());
  observer.observe(root, { childList: true, subtree: true });
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router }: EnhanceAppContext) {
    if (typeof window === "undefined") { return; }
    // Wait for the first navigation to complete so the sidebar exists.
    router.onAfterRouteChange = () => {
      requestAnimationFrame(applyIcons);
    };
    // Initial install — after the app mounts.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installSidebarIconObserver);
    } else {
      installSidebarIconObserver();
    }
  }
};
