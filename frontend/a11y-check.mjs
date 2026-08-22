#!/usr/bin/env node
// Lightweight accessibility audit using axe-core + jsdom.
// Runs against the built index.html — no browser needed.
// Usage: node a11y-check.mjs

import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import axe from "axe-core";

const html = readFileSync("dist/index.html", "utf-8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });

// Give scripts a moment to set up DOM (React won't hydrate without a server,
// but we can still check the static HTML structure)
await new Promise((r) => setTimeout(r, 500));

const results = await axe.run(dom.window.document.documentElement, {
  rules: {
    // WCAG 2.2 AA
    "color-contrast": { enabled: true },
    "html-has-lang": { enabled: true },
    "image-alt": { enabled: true },
    "label": { enabled: true },
    "link-name": { enabled: true },
    "button-name": { enabled: true },
    "document-title": { enabled: true },
    "meta-viewport": { enabled: true },
  },
});

const violations = results.violations;

if (violations.length === 0) {
  console.log("✅ axe-core: No accessibility violations found.");
  process.exit(0);
}

console.log(`\n❌ axe-core: ${violations.length} violation(s) found:\n`);
for (const v of violations) {
  console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
  console.log(`    ${v.helpUrl}`);
  for (const node of v.nodes.slice(0, 3)) {
    console.log(`    → ${node.html.slice(0, 120)}`);
  }
  console.log();
}

process.exit(1);
