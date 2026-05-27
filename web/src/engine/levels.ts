import type { Level, PixelGrid } from "../types";
import { NAMED_COLORS } from "../types";

// Shorthand helpers
const R = NAMED_COLORS.red!;
const G = NAMED_COLORS.green!;
const B = NAMED_COLORS.blue!;
const Y = NAMED_COLORS.yellow!;
const O = NAMED_COLORS.orange!;
const P = NAMED_COLORS.purple!;
const K = NAMED_COLORS.black!;
const C = NAMED_COLORS.cyan!;

function grid8(rows: (string | null)[][]): PixelGrid {
  const g: PixelGrid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  for (let y = 0; y < rows.length && y < 8; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length && x < 8; x++) {
      g[y]![x] = row[x] ?? null;
    }
  }
  return g;
}

function grid12(rows: (string | null)[][]): PixelGrid {
  const g: PixelGrid = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => null));
  for (let y = 0; y < rows.length && y < 12; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length && x < 12; x++) {
      g[y]![x] = row[x] ?? null;
    }
  }
  return g;
}

export const FREESTYLE_LEVEL_ID = 99;

export const levels: Level[] = [
  // Level 1: First Pixel
  {
    id: 1,
    name: "First Pixel",
    description: "Paint a single red pixel in the center!",
    hint: 'Use color("red") then dot(4, 4)',
    gridSize: 8,
    availableCommands: ["color", "dot"],
    targetGrid: (() => {
      const g = grid8([]);
      g[4]![4] = R;
      return g;
    })(),
  },

  // Level 2: Three Dots
  {
    id: 2,
    name: "Three Dots",
    description: "Paint three blue dots in a row.",
    hint: 'color("blue") then dot(2,3), dot(4,3), dot(6,3)',
    gridSize: 8,
    availableCommands: ["color", "dot"],
    targetGrid: (() => {
      const g = grid8([]);
      g[3]![2] = B;
      g[3]![4] = B;
      g[3]![6] = B;
      return g;
    })(),
  },

  // Level 3: Horizontal Line
  {
    id: 3,
    name: "Horizontal Line",
    description: "Draw a green line across the top.",
    hint: "line(0, 0, 7, 0) draws from left to right!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line"],
    targetGrid: (() => {
      const g = grid8([]);
      for (let x = 0; x < 8; x++) g[0]![x] = G;
      return g;
    })(),
  },

  // Level 4: Cross
  {
    id: 4,
    name: "Cross",
    description: "Draw a red cross through the center.",
    hint: "Two lines: one horizontal, one vertical, both through the middle.",
    gridSize: 8,
    availableCommands: ["color", "dot", "line"],
    targetGrid: (() => {
      const g = grid8([]);
      // Horizontal line at y=3
      for (let x = 0; x < 8; x++) g[3]![x] = R;
      // Vertical line at x=3
      for (let y = 0; y < 8; y++) g[y]![3] = R;
      return g;
    })(),
  },

  // Level 5: Square
  {
    id: 5,
    name: "Square",
    description: "Draw a blue square outline.",
    hint: "rect(1, 1, 6, 6) draws the outline!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line", "rect"],
    targetGrid: (() => {
      const g = grid8([]);
      // Top and bottom edges
      for (let x = 1; x < 7; x++) { g[1]![x] = B; g[6]![x] = B; }
      // Left and right edges
      for (let y = 1; y < 7; y++) { g[y]![1] = B; g[y]![6] = B; }
      return g;
    })(),
  },

  // Level 6: Filled Square
  {
    id: 6,
    name: "Filled Square",
    description: "Fill a solid orange square in the center.",
    hint: "fill(2, 2, 4, 4) fills a 4x4 block!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line", "rect", "fill"],
    targetGrid: (() => {
      const g = grid8([]);
      for (let y = 2; y < 6; y++) {
        for (let x = 2; x < 6; x++) g[y]![x] = O;
      }
      return g;
    })(),
  },

  // Level 7: Checkerboard
  {
    id: 7,
    name: "Checkerboard",
    description: "Make a 4x4 checkerboard pattern using repeat!",
    hint: "repeat(4) { dot(i*2, 0) } paints every other pixel. Combine rows!",
    gridSize: 8,
    availableCommands: ["color", "dot", "repeat"],
    targetGrid: (() => {
      const g = grid8([]);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if ((x + y) % 2 === 0) g[y]![x] = K;
        }
      }
      return g;
    })(),
  },

  // Level 8: Rainbow Row
  {
    id: 8,
    name: "Rainbow Row",
    description: "Paint a rainbow across a row, changing color each pixel!",
    hint: "Set a new color before each dot. 8 dots, 8 colors!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line"],
    targetGrid: (() => {
      const g = grid8([]);
      const colors = [R, O, Y, G, C, B, P, NAMED_COLORS.pink!];
      for (let x = 0; x < 8; x++) g[3]![x] = colors[x]!;
      return g;
    })(),
  },

  // Level 9: Diagonal
  {
    id: 9,
    name: "Diagonal",
    description: "Draw a purple diagonal from corner to corner.",
    hint: "line(0, 0, 7, 7) goes from top-left to bottom-right!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line"],
    targetGrid: (() => {
      const g = grid8([]);
      for (let d = 0; d < 8; d++) g[d]![d] = P;
      return g;
    })(),
  },

  // Level 10: Border
  {
    id: 10,
    name: "Border",
    description: "Draw a red border around the entire grid.",
    hint: "rect(0, 0, 8, 8) draws around the edge!",
    gridSize: 8,
    availableCommands: ["color", "dot", "line", "rect"],
    targetGrid: (() => {
      const g = grid8([]);
      for (let x = 0; x < 8; x++) { g[0]![x] = R; g[7]![x] = R; }
      for (let y = 0; y < 8; y++) { g[y]![0] = R; g[y]![7] = R; }
      return g;
    })(),
  },

  // Level 11: Smiley Face
  {
    id: 11,
    name: "Smiley Face",
    description: "Compose dots and lines into a smiley face!",
    hint: "Eyes at (3,3) and (8,3), mouth from (3,8) to (8,8) with corners up.",
    gridSize: 12,
    availableCommands: ["color", "dot", "line", "circle", "fill"],
    targetGrid: (() => {
      const g = grid12([]);
      // Face outline circle (approximate on a grid)
      const cx = 5, cy = 5, r = 5;
      // Simple circle points using midpoint
      let x = r, y = 0, d = 1 - r;
      function plot(px: number, py: number) {
        if (px >= 0 && px < 12 && py >= 0 && py < 12) g[py]![px] = Y;
      }
      function octants(px: number, py: number) {
        plot(cx + px, cy + py); plot(cx - px, cy + py);
        plot(cx + px, cy - py); plot(cx - px, cy - py);
        plot(cx + py, cy + px); plot(cx - py, cy + px);
        plot(cx + py, cy - px); plot(cx - py, cy - px);
      }
      while (x >= y) {
        octants(x, y);
        y++;
        if (d <= 0) { d += 2 * y + 1; } else { x--; d += 2 * (y - x) + 1; }
      }
      // Eyes
      g[4]![3] = K; g[4]![4] = K;
      g[4]![7] = K; g[4]![8] = K;
      // Mouth
      g[7]![3] = K; g[7]![8] = K;
      g[8]![4] = K; g[8]![5] = K; g[8]![6] = K; g[8]![7] = K;
      return g;
    })(),
  },

  // Level 12: Freestyle (sandbox)
  {
    id: 12,
    name: "Freestyle",
    description: "Your canvas! Draw anything you want.",
    hint: "No rules — experiment with all commands!",
    gridSize: 16,
    availableCommands: ["color", "dot", "line", "rect", "fill", "circle", "clear", "repeat"],
    targetGrid: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => null)),
  },
];

export function createFreestyleLevel(): Level {
  return {
    id: FREESTYLE_LEVEL_ID,
    name: "Freestyle",
    description: "Your canvas! Draw anything you want.",
    hint: "No rules — experiment with all commands!",
    gridSize: 16,
    availableCommands: ["color", "dot", "line", "rect", "fill", "circle", "clear", "repeat"],
    targetGrid: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => null)),
  };
}
