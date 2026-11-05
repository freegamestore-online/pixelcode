import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

function click(label: string) {
  act(() => button(label).click());
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Run level 1's starter code (a solution) and stop the moment it is won. */
function runToWin() {
  click("Run");
  for (let i = 0; i < 50 && !container.textContent?.includes("Perfect match"); i++) {
    advance(50);
  }
  expect(container.textContent).toContain("Perfect match");
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("success modal timer", () => {
  it("appears 400ms after a win", () => {
    runToWin();
    advance(400);
    expect(container.textContent).toContain("Level Complete!");
    expect(localStorage.getItem("pixelcode_completed")).toBe("[1]");
    expect(container.textContent).toContain("1 pixels painted perfectly!");
  });

  it("does not appear when Reset is pressed right after a win", () => {
    runToWin();
    click("Reset");
    advance(500);
    expect(container.textContent).not.toContain("Level Complete!");
  });

  it("does not appear when the level changes right after a win", () => {
    runToWin();
    click("Levels");
    click("Three Dots");
    advance(500);
    expect(container.textContent).not.toContain("Level Complete!");
  });
});

describe("freestyle", () => {
  it("counts the painted pixels", () => {
    act(() => root.unmount());
    localStorage.setItem("pixelcode_level", "99");
    localStorage.setItem("pixelcode_code", JSON.stringify({ 99: 'color("red")\nfill(0, 0, 2, 3)' }));
    root = createRoot(container);
    act(() => root.render(<App />));
    click("Run");
    advance(2000);
    expect(container.textContent).toContain("Drew 6 pixels!");
  });
});
