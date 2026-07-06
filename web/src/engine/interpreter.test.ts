import { describe, it, expect } from "vitest";
import { execute, checkWin } from "./interpreter";
import type { PixelGrid } from "../types";
import { NAMED_COLORS } from "../types";

/** Helper: get the final grid from an execution. */
function finalGrid(code: string, gridSize = 8): PixelGrid {
  const { snapshots } = execute(code, gridSize);
  return snapshots[snapshots.length - 1]!.grid;
}

/** Helper: run code and return the error (or null). */
function execError(code: string, gridSize = 8): string | null {
  return execute(code, gridSize).error;
}

/** Helper: create an empty grid. */
function emptyGrid(size: number): PixelGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

// ========================================================================
//  1. color() sets brush color
// ========================================================================

describe("color()", () => {
  it("sets brush color with a named color", () => {
    const grid = finalGrid('color("red")\ndot(0, 0)', 4);
    expect(grid[0]![0]).toBe(NAMED_COLORS.red);
  });

  it("sets brush color with a hex value", () => {
    const grid = finalGrid('color("#abcdef")\ndot(0, 0)', 4);
    expect(grid[0]![0]).toBe("#abcdef");
  });

  it("resolves all named colors correctly", () => {
    for (const [name, hex] of Object.entries(NAMED_COLORS)) {
      const grid = finalGrid(`color("${name}")\ndot(0, 0)`, 4);
      expect(grid[0]![0]).toBe(hex);
    }
  });

  it("defaults to black when no color() is called", () => {
    const grid = finalGrid("dot(0, 0)", 4);
    expect(grid[0]![0]).toBe("#000000");
  });

  it("errors on unknown color name", () => {
    expect(execError('color("unicorn")\ndot(0, 0)')).toMatch(/Unknown color/);
  });

  it("errors when color() has no arguments", () => {
    expect(execError("color()")).toMatch(/color\(\) needs a color argument/);
  });
});

// ========================================================================
//  2. dot(x, y) paints a single pixel
// ========================================================================

describe("dot()", () => {
  it("paints a single pixel at given coordinates", () => {
    const grid = finalGrid("dot(2, 3)", 8);
    expect(grid[3]![2]).toBe("#000000");
    // Surrounding pixels should be null
    expect(grid[3]![1]).toBeNull();
    expect(grid[3]![3]).toBeNull();
    expect(grid[2]![2]).toBeNull();
  });

  it("paints multiple dots", () => {
    const grid = finalGrid("dot(0, 0)\ndot(1, 1)\ndot(2, 2)", 4);
    expect(grid[0]![0]).toBe("#000000");
    expect(grid[1]![1]).toBe("#000000");
    expect(grid[2]![2]).toBe("#000000");
  });

  it("uses current brush color", () => {
    const grid = finalGrid('color("red")\ndot(0, 0)\ncolor("blue")\ndot(1, 0)', 4);
    expect(grid[0]![0]).toBe(NAMED_COLORS.red);
    expect(grid[0]![1]).toBe(NAMED_COLORS.blue);
  });

  it("errors when dot() is missing arguments", () => {
    expect(execError("dot(1)")).toMatch(/dot\(\) needs x, y/);
  });
});

// ========================================================================
//  3. line() draws lines (Bresenham)
// ========================================================================

describe("line()", () => {
  it("draws a horizontal line", () => {
    const grid = finalGrid("line(0, 0, 4, 0)", 8);
    for (let x = 0; x <= 4; x++) {
      expect(grid[0]![x]).toBe("#000000");
    }
    // Row below should be empty
    for (let x = 0; x <= 4; x++) {
      expect(grid[1]![x]).toBeNull();
    }
  });

  it("draws a vertical line", () => {
    const grid = finalGrid("line(2, 0, 2, 5)", 8);
    for (let y = 0; y <= 5; y++) {
      expect(grid[y]![2]).toBe("#000000");
    }
    // Column next to it should be empty
    for (let y = 0; y <= 5; y++) {
      expect(grid[y]![3]).toBeNull();
    }
  });

  it("draws a diagonal line", () => {
    const grid = finalGrid("line(0, 0, 3, 3)", 8);
    for (let i = 0; i <= 3; i++) {
      expect(grid[i]![i]).toBe("#000000");
    }
  });

  it("draws a line from right to left", () => {
    const grid = finalGrid("line(4, 0, 0, 0)", 8);
    for (let x = 0; x <= 4; x++) {
      expect(grid[0]![x]).toBe("#000000");
    }
  });

  it("errors when missing arguments", () => {
    expect(execError("line(0, 0, 3)")).toMatch(/line\(\) needs/);
  });
});

// ========================================================================
//  4. rect() draws rectangle outline
// ========================================================================

describe("rect()", () => {
  it("draws a rectangle outline", () => {
    const grid = finalGrid("rect(1, 1, 4, 3)", 8);
    // Top edge: y=1, x=1..4
    for (let x = 1; x <= 4; x++) {
      expect(grid[1]![x]).toBe("#000000");
    }
    // Bottom edge: y=3, x=1..4
    for (let x = 1; x <= 4; x++) {
      expect(grid[3]![x]).toBe("#000000");
    }
    // Left edge: x=1, y=1..3
    for (let y = 1; y <= 3; y++) {
      expect(grid[y]![1]).toBe("#000000");
    }
    // Right edge: x=4, y=1..3
    for (let y = 1; y <= 3; y++) {
      expect(grid[y]![4]).toBe("#000000");
    }
    // Interior should be empty
    expect(grid[2]![2]).toBeNull();
    expect(grid[2]![3]).toBeNull();
  });

  it("errors when missing arguments", () => {
    expect(execError("rect(0, 0, 3)")).toMatch(/rect\(\) needs/);
  });
});

// ========================================================================
//  5. fill() fills a solid rectangle
// ========================================================================

describe("fill()", () => {
  it("fills a solid rectangle", () => {
    const grid = finalGrid("fill(1, 1, 3, 2)", 8);
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(grid[y]![x]).toBe("#000000");
      }
    }
    // Outside should be empty
    expect(grid[0]![0]).toBeNull();
    expect(grid[0]![1]).toBeNull();
  });

  it("fills a 1x1 area (single pixel)", () => {
    const grid = finalGrid("fill(3, 3, 1, 1)", 8);
    expect(grid[3]![3]).toBe("#000000");
    expect(grid[3]![4]).toBeNull();
  });

  it("errors when missing arguments", () => {
    expect(execError("fill(0, 0)")).toMatch(/fill\(\) needs/);
  });
});

// ========================================================================
//  6. circle() draws a circle
// ========================================================================

describe("circle()", () => {
  it("draws a circle with radius > 0", () => {
    const grid = finalGrid("circle(4, 4, 3)", 8);
    // At least the cardinal extremes should be painted
    expect(grid[4]![7]).toBe("#000000"); // right (4+3, 4)
    expect(grid[4]![1]).toBe("#000000"); // left  (4-3, 4)
    expect(grid[1]![4]).toBe("#000000"); // top   (4, 4-3)
    expect(grid[7]![4]).toBe("#000000"); // bottom(4, 4+3)
    // Center should NOT be painted
    expect(grid[4]![4]).toBeNull();
  });

  it("draws a zero-radius circle (single point)", () => {
    const grid = finalGrid("circle(3, 3, 0)", 8);
    expect(grid[3]![3]).toBe("#000000");
  });

  it("errors when missing arguments", () => {
    expect(execError("circle(4, 4)")).toMatch(/circle\(\) needs/);
  });
});

// ========================================================================
//  7. clear() resets grid
// ========================================================================

describe("clear()", () => {
  it("clears all painted pixels", () => {
    const grid = finalGrid("fill(0, 0, 4, 4)\nclear()", 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(grid[y]![x]).toBeNull();
      }
    }
  });

  it("allows painting after clear", () => {
    const grid = finalGrid('fill(0, 0, 4, 4)\nclear()\ncolor("red")\ndot(1, 1)', 4);
    expect(grid[1]![1]).toBe(NAMED_COLORS.red);
    expect(grid[0]![0]).toBeNull();
  });
});

// ========================================================================
//  8. repeat(n) with loop variable i
// ========================================================================

describe("repeat()", () => {
  it("repeats body n times with loop variable i", () => {
    const grid = finalGrid("repeat(4) {\n  dot(i, 0)\n}", 8);
    for (let x = 0; x < 4; x++) {
      expect(grid[0]![x]).toBe("#000000");
    }
    expect(grid[0]![4]).toBeNull();
  });

  it("loop variable i increments from 0 to n-1", () => {
    const grid = finalGrid("repeat(8) {\n  dot(i, i)\n}", 8);
    for (let n = 0; n < 8; n++) {
      expect(grid[n]![n]).toBe("#000000");
    }
  });

  it("supports expressions using i", () => {
    // dot at (i*2, 0) for i = 0,1,2 => x=0,2,4
    const grid = finalGrid("repeat(3) {\n  dot(i * 2, 0)\n}", 8);
    expect(grid[0]![0]).toBe("#000000");
    expect(grid[0]![2]).toBe("#000000");
    expect(grid[0]![4]).toBe("#000000");
    expect(grid[0]![1]).toBeNull();
    expect(grid[0]![3]).toBeNull();
  });

  it("repeat(0) does nothing", () => {
    const grid = finalGrid("repeat(0) {\n  dot(0, 0)\n}", 4);
    expect(grid[0]![0]).toBeNull();
  });

  it("supports addition in expressions", () => {
    const grid = finalGrid("repeat(3) {\n  dot(i + 1, 0)\n}", 8);
    expect(grid[0]![0]).toBeNull();
    expect(grid[0]![1]).toBe("#000000");
    expect(grid[0]![2]).toBe("#000000");
    expect(grid[0]![3]).toBe("#000000");
  });

  it("supports subtraction in expressions", () => {
    const grid = finalGrid("repeat(3) {\n  dot(4 - i, 0)\n}", 8);
    expect(grid[0]![4]).toBe("#000000");
    expect(grid[0]![3]).toBe("#000000");
    expect(grid[0]![2]).toBe("#000000");
  });
});

// ========================================================================
//  9. Nested repeat
// ========================================================================

describe("nested repeat", () => {
  it("fills a square with nested repeat loops", () => {
    // The outer loop uses i, the inner loop also sets i (overrides in scope)
    // Actually inner repeat creates { ...vars, i }, so the inner i shadows the outer
    // We need to use the variable within each scope correctly
    const code = `repeat(3) {
  dot(i, 0)
  repeat(3) {
    dot(i, 1)
  }
}`;
    const grid = finalGrid(code, 8);
    // Inner loop runs 3 times for each outer iteration, drawing at y=1 x=0,1,2 each time
    for (let x = 0; x < 3; x++) {
      expect(grid[0]![x]).toBe("#000000"); // outer: dot(i, 0)
      expect(grid[1]![x]).toBe("#000000"); // inner: dot(i, 1) where i=0,1,2
    }
  });

  it("inner i shadows outer i", () => {
    // After inner loop exits, outer i still works
    const code = `repeat(4) {
  dot(i, 0)
  repeat(2) {
    dot(i, 1)
  }
}`;
    const grid = finalGrid(code, 8);
    // Outer: dot(0,0), dot(1,0), dot(2,0), dot(3,0)
    for (let x = 0; x < 4; x++) {
      expect(grid[0]![x]).toBe("#000000");
    }
    // Inner always: dot(0,1), dot(1,1)
    expect(grid[1]![0]).toBe("#000000");
    expect(grid[1]![1]).toBe("#000000");
    expect(grid[1]![2]).toBeNull();
  });
});

// ========================================================================
// 10. Out-of-bounds dots are silently ignored
// ========================================================================

describe("out-of-bounds", () => {
  it("silently ignores dots outside grid (positive)", () => {
    const err = execError("dot(100, 100)", 8);
    expect(err).toBeNull();
    const grid = finalGrid("dot(100, 100)", 8);
    // All cells should be null
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(grid[y]![x]).toBeNull();
      }
    }
  });

  it("silently ignores negative coordinates", () => {
    // Negative coords: i-5 when i=0 => -5
    const err = execError("repeat(3) {\n  dot(i - 5, 0)\n}", 8);
    expect(err).toBeNull();
  });

  it("line partially off-grid only paints visible pixels", () => {
    const grid = finalGrid("line(0, 0, 10, 0)", 8);
    for (let x = 0; x < 8; x++) {
      expect(grid[0]![x]).toBe("#000000");
    }
    // Grid is 8x8, index 7 is last
    expect(grid[0]!.length).toBe(8);
  });
});

// ========================================================================
// 11. Comments are ignored
// ========================================================================

describe("comments", () => {
  it("ignores // comments", () => {
    const grid = finalGrid("// this is a comment\ndot(0, 0)", 4);
    expect(grid[0]![0]).toBe("#000000");
  });

  it("ignores inline comments after code", () => {
    const grid = finalGrid("dot(0, 0) // paint a pixel", 4);
    expect(grid[0]![0]).toBe("#000000");
  });

  it("handles comment-only lines", () => {
    const err = execError("// just a comment\n// another comment");
    expect(err).toBeNull();
  });
});

// ========================================================================
// 12. Parse errors
// ========================================================================

describe("parse errors", () => {
  it("returns error for unknown command", () => {
    expect(execError("splat(1, 2)")).toMatch(/Unexpected token/);
  });

  it("returns error for missing closing paren", () => {
    expect(execError("dot(1, 2")).not.toBeNull();
  });

  it("returns error for missing closing brace in repeat", () => {
    expect(execError("repeat(3) {\n  dot(0, 0)")).not.toBeNull();
  });

  it("returns error for unknown variable", () => {
    expect(execError("dot(x, 0)")).toMatch(/Unknown variable/);
  });

  it("still returns a snapshot array on error", () => {
    const result = execute("splat(1, 2)", 8);
    expect(result.snapshots.length).toBeGreaterThan(0);
    expect(result.error).not.toBeNull();
  });
});

// ========================================================================
// 13. Step limit protection
// ========================================================================

describe("step limit", () => {
  it("stops execution after MAX_STEPS snapshots", () => {
    // repeat(1001) would try to create >2000 snapshots when combined with initial
    const code = "repeat(1000) {\n  dot(0, 0)\n  dot(1, 1)\n  dot(2, 2)\n}";
    const result = execute(code, 8);
    // Should stop before completing all iterations
    expect(result.snapshots.length).toBeLessThanOrEqual(2001);
  });

  it("rejects repeat count > 1000", () => {
    expect(execError("repeat(1001) {\n  dot(0, 0)\n}")).toMatch(/repeat count must be between/);
  });

  it("rejects negative repeat count", () => {
    expect(execError("repeat(-1) {\n  dot(0, 0)\n}")).not.toBeNull();
  });
});

// ========================================================================
// 14. checkWin
// ========================================================================

describe("checkWin()", () => {
  it("returns won=true for exact pixel match", () => {
    const target = emptyGrid(4);
    target[0]![0] = "#000000";
    target[1]![1] = "#000000";

    const user = emptyGrid(4);
    user[0]![0] = "#000000";
    user[1]![1] = "#000000";

    const result = checkWin(user, target);
    expect(result.won).toBe(true);
    expect(result.message).toMatch(/Perfect match/);
  });

  it("returns won=false when pixels are wrong", () => {
    const target = emptyGrid(4);
    target[0]![0] = "#000000";
    target[1]![1] = "#ff0000";

    const user = emptyGrid(4);
    user[0]![0] = "#000000";
    user[1]![1] = "#0000ff"; // wrong color

    const result = checkWin(user, target);
    expect(result.won).toBe(false);
    expect(result.message).toMatch(/1\/2 pixels correct/);
  });

  it("returns won=false when target pixels are missing in user grid", () => {
    const target = emptyGrid(4);
    target[0]![0] = "#000000";
    target[0]![1] = "#000000";

    const user = emptyGrid(4);
    user[0]![0] = "#000000";
    // Missing (0,1)

    const result = checkWin(user, target);
    expect(result.won).toBe(false);
    expect(result.message).toMatch(/1\/2 pixels correct/);
  });

  it("ignores extra user pixels not in target", () => {
    const target = emptyGrid(4);
    target[0]![0] = "#000000";

    const user = emptyGrid(4);
    user[0]![0] = "#000000";
    user[2]![2] = "#ff0000"; // extra pixel, not in target

    const result = checkWin(user, target);
    expect(result.won).toBe(true);
  });

  it("returns won=true for empty target grids", () => {
    const target = emptyGrid(4);
    const user = emptyGrid(4);

    const result = checkWin(user, target);
    expect(result.won).toBe(true);
    expect(result.message).toMatch(/Canvas is clear/);
  });

  it("partial match reports correct counts", () => {
    const target = emptyGrid(4);
    target[0]![0] = "#000000";
    target[0]![1] = "#000000";
    target[0]![2] = "#000000";

    const user = emptyGrid(4);
    user[0]![0] = "#000000";
    user[0]![1] = "#ff0000"; // wrong
    // Missing (0,2)

    const result = checkWin(user, target);
    expect(result.won).toBe(false);
    expect(result.message).toMatch(/1\/3 pixels correct, 2 wrong/);
  });
});

// ========================================================================
// Additional edge cases
// ========================================================================

describe("snapshots", () => {
  it("includes initial empty grid snapshot", () => {
    const result = execute("dot(0, 0)", 4);
    // First snapshot is the initial state (before any command)
    expect(result.snapshots[0]!.grid[0]![0]).toBeNull();
    expect(result.snapshots[0]!.lineNumber).toBe(0);
  });

  it("each command produces a new snapshot", () => {
    const result = execute("dot(0, 0)\ndot(1, 1)", 4);
    // initial + 2 commands = 3 snapshots
    expect(result.snapshots.length).toBe(3);
  });
});

describe("single-quoted strings", () => {
  it("accepts single-quoted color names", () => {
    const grid = finalGrid("color('blue')\ndot(0, 0)", 4);
    expect(grid[0]![0]).toBe(NAMED_COLORS.blue);
  });
});

describe("empty code", () => {
  it("returns initial snapshot for empty code", () => {
    const result = execute("", 4);
    expect(result.snapshots.length).toBe(1);
    expect(result.error).toBeNull();
  });

  it("returns initial snapshot for whitespace-only code", () => {
    const result = execute("   \n  \n  ", 4);
    expect(result.snapshots.length).toBe(1);
    expect(result.error).toBeNull();
  });
});
