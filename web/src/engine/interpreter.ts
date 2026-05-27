import type { PixelGrid, ExecutionSnapshot } from "../types";
import { NAMED_COLORS } from "../types";

const MAX_STEPS = 2000;

// ---- Tokenizer ----

interface Token {
  type: "command" | "number" | "string" | "lparen" | "rparen" | "lbrace" | "rbrace" | "keyword" | "comma" | "ident" | "op";
  value: string;
  line: number;
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx]!;
    const lineNum = lineIdx + 1;
    // Strip comments
    line = line.replace(/\/\/.*$/, "").trim();
    let i = 0;
    while (i < line.length) {
      if (/\s/.test(line[i]!)) { i++; continue; }
      if (line[i] === "(") { tokens.push({ type: "lparen", value: "(", line: lineNum }); i++; continue; }
      if (line[i] === ")") { tokens.push({ type: "rparen", value: ")", line: lineNum }); i++; continue; }
      if (line[i] === "{") { tokens.push({ type: "lbrace", value: "{", line: lineNum }); i++; continue; }
      if (line[i] === "}") { tokens.push({ type: "rbrace", value: "}", line: lineNum }); i++; continue; }
      if (line[i] === ",") { tokens.push({ type: "comma", value: ",", line: lineNum }); i++; continue; }
      if (line[i] === "+" || line[i] === "-" || line[i] === "*") {
        tokens.push({ type: "op", value: line[i]!, line: lineNum }); i++; continue;
      }
      // String literal (single or double quotes)
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let str = "";
        i++; // skip opening quote
        while (i < line.length && line[i] !== quote) { str += line[i]; i++; }
        i++; // skip closing quote
        tokens.push({ type: "string", value: str, line: lineNum });
        continue;
      }
      // Numbers
      if (/\d/.test(line[i]!)) {
        let num = "";
        while (i < line.length && /\d/.test(line[i]!)) { num += line[i]; i++; }
        tokens.push({ type: "number", value: num, line: lineNum });
        continue;
      }
      // Words: commands, keywords, identifiers
      if (/[a-zA-Z_]/.test(line[i]!)) {
        let word = "";
        while (i < line.length && /[a-zA-Z_]/.test(line[i]!)) { word += line[i]; i++; }
        const keywords = ["repeat"];
        const commands = ["color", "dot", "line", "rect", "fill", "circle", "clear"];
        if (keywords.includes(word)) {
          tokens.push({ type: "keyword", value: word, line: lineNum });
        } else if (commands.includes(word)) {
          tokens.push({ type: "command", value: word, line: lineNum });
        } else {
          tokens.push({ type: "ident", value: word, line: lineNum });
        }
        continue;
      }
      // Skip unknown chars
      i++;
    }
  }
  return tokens;
}

// ---- AST ----

interface Expr {
  type: "number" | "ident" | "binop";
  value?: number;
  name?: string;
  op?: string;
  left?: Expr;
  right?: Expr;
}

interface ASTNode {
  type: "call" | "repeat";
  name?: string;
  args?: (Expr | string)[];
  count?: Expr;
  body?: ASTNode[];
  line: number;
}

// ---- Parser ----

function parse(tokens: Token[]): ASTNode[] {
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function advance(): Token { return tokens[pos++]!; }
  function expect(type: string): Token {
    const t = peek();
    if (!t || t.type !== type) {
      const got = t ? `${t.type} "${t.value}"` : "end of input";
      throw new Error(`Expected ${type} at line ${t?.line ?? "?"}, got ${got}`);
    }
    return advance();
  }

  function parseExpr(): Expr {
    let left = parseAtom();
    while (peek()?.type === "op") {
      const op = advance().value;
      const right = parseAtom();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  function parseAtom(): Expr {
    const t = peek();
    if (!t) throw new Error("Unexpected end of input");
    if (t.type === "number") {
      advance();
      return { type: "number", value: parseInt(t.value, 10) };
    }
    if (t.type === "ident") {
      advance();
      return { type: "ident", name: t.value };
    }
    throw new Error(`Expected number or variable at line ${t.line}, got "${t.value}"`);
  }

  function parseArgs(): (Expr | string)[] {
    expect("lparen");
    const args: (Expr | string)[] = [];
    while (peek() && peek()!.type !== "rparen") {
      if (peek()!.type === "string") {
        args.push(advance().value);
      } else {
        args.push(parseExpr());
      }
      if (peek()?.type === "comma") advance();
    }
    expect("rparen");
    return args;
  }

  function parseBlock(): ASTNode[] {
    expect("lbrace");
    const nodes: ASTNode[] = [];
    while (peek() && peek()!.type !== "rbrace") {
      nodes.push(parseStatement());
    }
    expect("rbrace");
    return nodes;
  }

  function parseStatement(): ASTNode {
    const t = peek()!;
    if (t.type === "keyword" && t.value === "repeat") {
      advance();
      expect("lparen");
      const count = parseExpr();
      expect("rparen");
      const body = parseBlock();
      return { type: "repeat", count, body, line: t.line };
    }
    if (t.type === "command") {
      advance();
      const args = parseArgs();
      return { type: "call", name: t.value, args, line: t.line };
    }
    throw new Error(`Unexpected token "${t.value}" at line ${t.line}`);
  }

  const ast: ASTNode[] = [];
  while (pos < tokens.length) {
    ast.push(parseStatement());
  }
  return ast;
}

// ---- Evaluator ----

function evalExpr(expr: Expr, vars: Record<string, number>): number {
  switch (expr.type) {
    case "number":
      return expr.value!;
    case "ident": {
      const v = vars[expr.name!];
      if (v === undefined) throw new Error(`Unknown variable "${expr.name}"`);
      return v;
    }
    case "binop": {
      const l = evalExpr(expr.left!, vars);
      const r = evalExpr(expr.right!, vars);
      switch (expr.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        default: throw new Error(`Unknown operator "${expr.op}"`);
      }
    }
  }
}

function resolveColor(arg: Expr | string, _vars: Record<string, number>): string {
  if (typeof arg === "string") {
    const lower = arg.toLowerCase();
    if (NAMED_COLORS[lower]) return NAMED_COLORS[lower]!;
    if (arg.startsWith("#")) return arg;
    throw new Error(`Unknown color "${arg}". Use a color name or hex code.`);
  }
  throw new Error("color() expects a string argument like color(\"red\")");
}

function createGrid(size: number): PixelGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function cloneGrid(grid: PixelGrid): PixelGrid {
  return grid.map((row) => [...row]);
}

// Bresenham's line algorithm
function bresenhamLine(x1: number, y1: number, x2: number, y2: number): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1;
  let cy = y1;

  while (true) {
    points.push([cx, cy]);
    if (cx === x2 && cy === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return points;
}

// Midpoint circle algorithm
function midpointCircle(cx: number, cy: number, r: number): [number, number][] {
  const points: [number, number][] = [];
  let x = r;
  let y = 0;
  let d = 1 - r;

  function addOctants(px: number, py: number) {
    points.push([cx + px, cy + py]);
    points.push([cx - px, cy + py]);
    points.push([cx + px, cy - py]);
    points.push([cx - px, cy - py]);
    points.push([cx + py, cy + px]);
    points.push([cx - py, cy + px]);
    points.push([cx + py, cy - px]);
    points.push([cx - py, cy - px]);
  }

  while (x >= y) {
    addOctants(x, y);
    y++;
    if (d <= 0) {
      d += 2 * y + 1;
    } else {
      x--;
      d += 2 * (y - x) + 1;
    }
  }
  return points;
}

export function execute(
  code: string,
  gridSize: number,
): { snapshots: ExecutionSnapshot[]; error: string | null } {
  let tokens: Token[];
  let ast: ASTNode[];
  try {
    tokens = tokenize(code);
    ast = parse(tokens);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return {
      snapshots: [{ grid: createGrid(gridSize), lineNumber: 0, error: msg }],
      error: msg,
    };
  }

  // Suppress unused variable warning
  void tokens;

  const snapshots: ExecutionSnapshot[] = [];
  const grid = createGrid(gridSize);
  let brushColor = "#000000";
  let error: string | null = null;

  function snapshot(line: number) {
    snapshots.push({ grid: cloneGrid(grid), lineNumber: line, error: null });
  }

  function setPixel(x: number, y: number) {
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      grid[y]![x] = brushColor;
    }
  }

  // Initial state
  snapshot(0);

  function run(nodes: ASTNode[], vars: Record<string, number>): boolean {
    for (const node of nodes) {
      if (snapshots.length > MAX_STEPS || error) return false;

      switch (node.type) {
        case "call": {
          switch (node.name) {
            case "color": {
              if (!node.args || node.args.length < 1) {
                error = `color() needs a color argument at line ${node.line}`;
                return false;
              }
              try {
                brushColor = resolveColor(node.args[0]!, vars);
              } catch (e) {
                error = e instanceof Error ? e.message : "Invalid color";
                return false;
              }
              snapshot(node.line);
              break;
            }
            case "dot": {
              if (!node.args || node.args.length < 2) {
                error = `dot() needs x, y at line ${node.line}`;
                return false;
              }
              const x = evalExpr(node.args[0]! as Expr, vars);
              const y = evalExpr(node.args[1]! as Expr, vars);
              setPixel(x, y);
              snapshot(node.line);
              break;
            }
            case "line": {
              if (!node.args || node.args.length < 4) {
                error = `line() needs x1, y1, x2, y2 at line ${node.line}`;
                return false;
              }
              const x1 = evalExpr(node.args[0]! as Expr, vars);
              const y1 = evalExpr(node.args[1]! as Expr, vars);
              const x2 = evalExpr(node.args[2]! as Expr, vars);
              const y2 = evalExpr(node.args[3]! as Expr, vars);
              for (const [px, py] of bresenhamLine(x1, y1, x2, y2)) {
                setPixel(px, py);
              }
              snapshot(node.line);
              break;
            }
            case "rect": {
              if (!node.args || node.args.length < 4) {
                error = `rect() needs x, y, w, h at line ${node.line}`;
                return false;
              }
              const rx = evalExpr(node.args[0]! as Expr, vars);
              const ry = evalExpr(node.args[1]! as Expr, vars);
              const rw = evalExpr(node.args[2]! as Expr, vars);
              const rh = evalExpr(node.args[3]! as Expr, vars);
              // Top and bottom edges
              for (let dx = 0; dx < rw; dx++) {
                setPixel(rx + dx, ry);
                setPixel(rx + dx, ry + rh - 1);
              }
              // Left and right edges
              for (let dy = 0; dy < rh; dy++) {
                setPixel(rx, ry + dy);
                setPixel(rx + rw - 1, ry + dy);
              }
              snapshot(node.line);
              break;
            }
            case "fill": {
              if (!node.args || node.args.length < 4) {
                error = `fill() needs x, y, w, h at line ${node.line}`;
                return false;
              }
              const fx = evalExpr(node.args[0]! as Expr, vars);
              const fy = evalExpr(node.args[1]! as Expr, vars);
              const fw = evalExpr(node.args[2]! as Expr, vars);
              const fh = evalExpr(node.args[3]! as Expr, vars);
              for (let dy = 0; dy < fh; dy++) {
                for (let dx = 0; dx < fw; dx++) {
                  setPixel(fx + dx, fy + dy);
                }
              }
              snapshot(node.line);
              break;
            }
            case "circle": {
              if (!node.args || node.args.length < 3) {
                error = `circle() needs x, y, r at line ${node.line}`;
                return false;
              }
              const cx = evalExpr(node.args[0]! as Expr, vars);
              const cy = evalExpr(node.args[1]! as Expr, vars);
              const cr = evalExpr(node.args[2]! as Expr, vars);
              for (const [px, py] of midpointCircle(cx, cy, cr)) {
                setPixel(px, py);
              }
              snapshot(node.line);
              break;
            }
            case "clear": {
              for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                  grid[y]![x] = null;
                }
              }
              snapshot(node.line);
              break;
            }
            default:
              error = `Unknown command: ${node.name} at line ${node.line}`;
              return false;
          }
          break;
        }
        case "repeat": {
          const count = evalExpr(node.count!, vars);
          if (count < 0 || count > 1000) {
            error = `repeat count must be between 0 and 1000 at line ${node.line}`;
            return false;
          }
          for (let i = 0; i < count; i++) {
            if (!run(node.body ?? [], { ...vars, i })) return false;
          }
          break;
        }
      }
    }
    return true;
  }

  run(ast, {});

  return { snapshots, error };
}

/** Compare user grid to target grid. Only painted (non-null) target cells must match. */
export function checkWin(userGrid: PixelGrid, targetGrid: PixelGrid): { won: boolean; message: string } {
  let totalTarget = 0;
  let matched = 0;
  let mismatched = 0;

  for (let y = 0; y < targetGrid.length; y++) {
    const targetRow = targetGrid[y];
    if (!targetRow) continue;
    for (let x = 0; x < targetRow.length; x++) {
      const target = targetRow[x];
      if (target === null) continue;
      totalTarget++;
      const user = userGrid[y]?.[x];
      if (user === target) {
        matched++;
      } else {
        mismatched++;
      }
    }
  }

  if (totalTarget === 0) {
    return { won: true, message: "Canvas is clear!" };
  }

  if (mismatched === 0 && matched === totalTarget) {
    return { won: true, message: `Perfect match! ${matched} pixels correct.` };
  }

  return {
    won: false,
    message: `${matched}/${totalTarget} pixels correct, ${mismatched} wrong or missing.`,
  };
}
