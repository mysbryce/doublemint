import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 4173;
const baseUrl = `http://localhost:${port}/`;

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) { return; }
    } catch {
      // not yet
    }
    await sleep(200);
  }
  throw new Error(`docs preview did not start on ${baseUrl}`);
}

const server = spawn("node", [
  "node_modules/vitepress/bin/vitepress.js",
  "preview",
  "docs",
  "--port",
  String(port)
], { stdio: ["ignore", "pipe", "pipe"] });

server.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
server.stderr.on("data", (chunk) => process.stderr.write(`[preview!] ${chunk}`));

try {
  await waitForServer();
  console.log("docs preview is up.\n");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const pagesToCheck = [
    { url: baseUrl, label: "Home" },
    { url: baseUrl + "start/welcome", label: "Welcome" },
    { url: baseUrl + "start/quickstart", label: "Quickstart" },
    { url: baseUrl + "language/operators", label: "Operators" },
    { url: baseUrl + "stdlib/http", label: "mint:http" }
  ];

  for (const target of pagesToCheck) {
    await page.goto(target.url, { waitUntil: "networkidle" });

    // Home page specific checks
    if (target.label === "Home") {
      const getStartedHref = await page.evaluate(() => {
        const anchor = Array.from(document.querySelectorAll("a"))
          .find((a) => (a.textContent ?? "").trim().toLowerCase() === "get started");
        return anchor ? anchor.getAttribute("href") : null;
      });
      console.log(`--- Home (${target.url})`);
      console.log("  Get started href:", getStartedHref);
      if (!getStartedHref || getStartedHref === "/guide/getting-started") {
        console.warn("  WARNING: Get started link points at the old path");
      }
      console.log("");
      continue;
    }

    // Sidebar overlap check — confirm the first .level-0 header is
    // not covered by the navbar.
    const sidebarVisibility = await page.evaluate(() => {
      const firstHeader = document.querySelector(".VPSidebarItem.level-0 .text");
      const nav = document.querySelector(".VPNavBar");
      if (!firstHeader || !nav) { return null; }
      const navRect = nav.getBoundingClientRect();
      const headerRect = firstHeader.getBoundingClientRect();
      return {
        navBottom: Math.round(navRect.bottom),
        firstHeaderTop: Math.round(headerRect.top),
        headerText: firstHeader.textContent?.trim(),
        clear: headerRect.top >= navRect.bottom
      };
    });

    const codeFont = await page.evaluate(() => {
      const block = document.querySelector("div[class*='language-'] code");
      if (!block) { return null; }
      const style = window.getComputedStyle(block);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        background: style.backgroundColor,
        color: style.color
      };
    });

    const sidebarSections = await page.evaluate(() => {
      const headers = Array.from(
        document.querySelectorAll(".VPSidebarItem.level-0 .text")
      );
      return headers.map((h) => h.textContent?.trim() ?? "");
    });

    const icons = await page.evaluate(() => {
      const headers = Array.from(
        document.querySelectorAll(".VPSidebarItem .text[data-icon]")
      );
      return headers.map((h) => ({
        label: (h.textContent ?? "").trim(),
        icon: h.getAttribute("data-icon"),
        cssVar: getComputedStyle(h).getPropertyValue("--icon").trim().slice(0, 40)
      }));
    });

    const subCategoryLayout = await page.evaluate(() => {
      const sub = document.querySelector(
        ".VPSidebarItem.level-1 .text[data-icon]"
      );
      if (!sub) { return null; }
      const subStyle = getComputedStyle(sub);
      const before = getComputedStyle(sub, "::before");
      return {
        label: (sub.textContent ?? "").trim(),
        display: subStyle.display,
        gap: subStyle.gap || subStyle.columnGap,
        iconWidth: before.width,
        iconHeight: before.height
      };
    });

    console.log(`--- ${target.label} (${target.url})`);
    if (sidebarVisibility) {
      console.log(
        "  sidebar / navbar:",
        `nav bottom = ${sidebarVisibility.navBottom}px,`,
        `first header top = ${sidebarVisibility.firstHeaderTop}px,`,
        `header = "${sidebarVisibility.headerText}",`,
        sidebarVisibility.clear ? "clear of navbar" : "BEHIND NAVBAR"
      );
      if (!sidebarVisibility.clear) {
        console.warn("  WARNING: first sidebar header is hidden behind the navbar");
      }
    }
    console.log("  code font:", codeFont);
    console.log("  sidebar sections:", sidebarSections);
    console.log("  icons applied:", icons.length, "items");
    if (icons.length === 0) {
      console.warn("  WARNING: no icons were applied");
    }
    if (subCategoryLayout) {
      console.log(
        "  sub-category layout:",
        `label = "${subCategoryLayout.label}",`,
        `display = ${subCategoryLayout.display},`,
        `gap = ${subCategoryLayout.gap},`,
        `icon = ${subCategoryLayout.iconWidth} x ${subCategoryLayout.iconHeight}`
      );
      const okDisplay =
        subCategoryLayout.display === "inline-flex" ||
        subCategoryLayout.display === "flex";
      const okGap =
        subCategoryLayout.gap &&
        subCategoryLayout.gap !== "normal" &&
        subCategoryLayout.gap !== "0px";
      if (!okDisplay || !okGap) {
        console.warn(
          "  WARNING: sub-category icon row is missing flex / gap"
        );
      }
    }
    console.log("");
  }

  await browser.close();
  process.exit(0);
} catch (error) {
  console.error("docs style check failed:", error);
  process.exit(1);
} finally {
  server.kill();
}
