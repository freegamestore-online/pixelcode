import { describe, it, expect } from "vitest";
import { highlightCode } from "./CodeEditor";

/** The text a user sees: highlighted HTML with tags stripped and entities decoded. */
function visibleText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

describe("highlightCode", () => {
  const programs = [
    'color("red")',
    "dot(4, 4)",
    "repeat(8) { rect(i, 2, 3, 3) }",
    "fill('blue')\nline(0, 0, 15, 15) // circle(1)",
  ];

  for (const code of programs) {
    it(`shows exactly the source text: ${JSON.stringify(code)}`, () => {
      expect(visibleText(highlightCode(code))).toBe(code);
    });
  }

  it("colours each token once", () => {
    expect(highlightCode('color("red")')).toBe(
      '<span style="color:#f97316">color</span>(<span style="color:#98c379">&quot;red&quot;</span>)',
    );
  });
});
