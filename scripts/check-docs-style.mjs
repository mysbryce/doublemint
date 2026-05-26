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
    { url: baseUrl + "start/quickstart", label: "Quickstart" },
    { url: baseUrl + "language/operators", label: "Operators" },
    { url: baseUrl + "stdlib/http", label: "mint:http" }
  ];

  for (const target of pagesToCheck) {
    await page.goto(target.url, { waitUntil: "networkidle" });

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

    console.log(`--- ${target.label} (${target.url})`);
    console.log("  code font:", codeFont);
    console.log("  sidebar sections:", sidebarSections);
    console.log("  icons applied:", icons.length, "items");
    if (icons.length === 0) {
      console.warn("  WARNING: no icons were applied");
    } else {
      for (const i of icons) {
        console.log(`    - "${i.label}" -> ${i.icon}  (${i.cssVar}${i.cssVar.length > 0 ? '…' : ''})`);
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
