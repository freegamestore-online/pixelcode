/** A 2D grid of pixel colors. null = empty/transparent. */
export type PixelGrid = (string | null)[][];

export interface Position {
  x: number;
  y: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  hint: string;
  targetGrid: PixelGrid;
  gridSize: number;
  availableCommands: string[];
}

export interface ExecutionSnapshot {
  grid: PixelGrid;
  lineNumber: number;
  error: string | null;
}

export const COMMAND_HELP: Record<string, { syntax: string; desc: string }> = {
  color: { syntax: 'color("red")', desc: "Set brush color (name or hex)" },
  dot: { syntax: "dot(x, y)", desc: "Paint a single pixel" },
  line: { syntax: "line(x1, y1, x2, y2)", desc: "Draw a line between two points" },
  rect: { syntax: "rect(x, y, w, h)", desc: "Draw a rectangle outline" },
  fill: { syntax: "fill(x, y, w, h)", desc: "Fill a solid rectangle" },
  circle: { syntax: "circle(x, y, r)", desc: "Draw a circle" },
  clear: { syntax: "clear()", desc: "Clear the entire canvas" },
  repeat: { syntax: "repeat(n) { ... }", desc: "Repeat n times (use i as counter)" },
};

export const NAMED_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  cyan: "#06b6d4",
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  brown: "#92400e",
  lime: "#84cc16",
  teal: "#14b8a6",
  indigo: "#6366f1",
  amber: "#f59e0b",
};
