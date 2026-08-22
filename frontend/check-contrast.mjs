// Ad-hoc WCAG 2.x contrast check for the theme tokens.
// Formula: WCAG 2.1 relative luminance + contrast ratio.
// https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Composite a translucent foreground over an opaque background.
const over = (fg, a, bg) => fg.map((c, i) => Math.round(a * c + (1 - a) * bg[i]));

const cases = [
  // [label, foreground, alpha, background, requiredRatio]
  ["dark  text      on bg",       hex("#e8e8e8"), 1.0, hex("#121212"), 4.5],
  ["dark  text-2    on elevated", hex("#ffffff"), 0.7, hex("#1e1e1e"), 4.5],
  ["dark  text-3    on elevated", hex("#ffffff"), 0.5, hex("#1e1e1e"), 4.5],
  ["dark  text-3    on surface",  hex("#ffffff"), 0.5, hex("#2a2a2a"), 4.5],
  ["light text      on bg",       hex("#1e2028"), 1.0, hex("#f8f9fb"), 4.5],
  ["light text-2    on elevated", hex("#1e2028"), 0.72, hex("#ffffff"), 4.5],
  ["light text-3    on elevated", hex("#1e2028"), 0.64, hex("#ffffff"), 4.5],
  ["light text-3    on surface",  hex("#1e2028"), 0.64, hex("#f0f1f4"), 4.5],
  ["light hot       on elevated", hex("#d4450c"), 1.0, hex("#ffffff"), 4.5],
  ["light forged    on elevated", hex("#15803d"), 1.0, hex("#ffffff"), 4.5],
  ["dark  hot       on elevated", hex("#ff6b45"), 1.0, hex("#1e1e1e"), 4.5],
  ["dark  forged    on elevated", hex("#4ade80"), 1.0, hex("#1e1e1e"), 4.5],

  // Graphical objects convey state (heat/tier), so WCAG SC 1.4.11 applies:
  // 3:1 against adjacent colour. The anvil sits on the page background.
  ["light anvil mid on bg",       hex("#616b78"), 1.0, hex("#f8f9fb"), 3.0],
  ["light anvil hi  on bg",       hex("#7d8794"), 1.0, hex("#f8f9fb"), 3.0],
  ["dark  anvil mid on bg",       hex("#847a72"), 1.0, hex("#121212"), 3.0],
  ["dark  anvil hi  on bg",       hex("#a49a90"), 1.0, hex("#121212"), 3.0],
];

let fails = 0;
for (const [label, fg, a, bg, need] of cases) {
  const r = ratio(over(fg, a, bg), bg);
  const ok = r >= need;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ${r.toFixed(2)}:1  (need ${need}:1)`);
}
console.log(fails === 0 ? "\nAll pass." : `\n${fails} failing.`);
process.exit(fails === 0 ? 0 : 1);
