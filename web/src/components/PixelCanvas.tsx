import { useMemo } from "react";
import type { PixelGrid } from "../types";

interface PixelCanvasProps {
  grid: PixelGrid;
  targetGrid: PixelGrid | null;
  gridSize: number;
}

export default function PixelCanvas({ grid, targetGrid, gridSize }: PixelCanvasProps) {
  // Cell size adapts to grid dimensions, shrinking further to fit the
  // stage (the parent is a size container) on small screens
  const maxCellSize = 48;
  const minCellSize = 24;
  const preferredCellSize = Math.max(minCellSize, Math.min(maxCellSize, Math.floor(480 / gridSize)));
  const fit = `(100cqmin - ${gridSize - 1}px) / ${gridSize}`;
  const cellSize = `min(${preferredCellSize}px, calc(${fit}))`;

  // Build a set of target-only cells for the overlay hint
  const targetHints = useMemo(() => {
    if (!targetGrid) return new Set<string>();
    const hints = new Set<string>();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const target = targetGrid[y]?.[x];
        const user = grid[y]?.[x];
        if (target && !user) {
          hints.add(`${x},${y}`);
        }
      }
    }
    return hints;
  }, [grid, targetGrid, gridSize]);

  // Build match/mismatch info
  const cellStatus = useMemo(() => {
    if (!targetGrid) return new Map<string, "match" | "wrong">();
    const status = new Map<string, "match" | "wrong">();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const target = targetGrid[y]?.[x];
        const user = grid[y]?.[x];
        if (target && user) {
          status.set(`${x},${y}`, user === target ? "match" : "wrong");
        }
      }
    }
    return status;
  }, [grid, targetGrid, gridSize]);

  return (
    <div
      style={{
        display: "inline-grid",
        gridTemplateRows: `repeat(${gridSize}, ${cellSize})`,
        gridTemplateColumns: `repeat(${gridSize}, ${cellSize})`,
        gap: "1px",
        background: "var(--line-strong)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}
    >
      {Array.from({ length: gridSize }, (_, y) =>
        Array.from({ length: gridSize }, (_, x) => {
          const color = grid[y]?.[x];
          const key = `${x},${y}`;
          const isTargetHint = targetHints.has(key);
          const status = cellStatus.get(key);
          const targetColor = targetGrid?.[y]?.[x];

          return (
            <div
              key={key}
              className="grid-cell"
              style={{
                width: cellSize,
                height: cellSize,
                background: color ?? "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                userSelect: "none",
              }}
            >
              {/* Target hint overlay — semi-transparent preview of what to draw */}
              {isTargetHint && targetColor && (
                <div
                  style={{
                    position: "absolute",
                    inset: 2,
                    background: targetColor,
                    opacity: 0.15,
                    borderRadius: 2,
                    border: "1px dashed rgba(0,0,0,0.2)",
                  }}
                />
              )}

              {/* Match indicator */}
              {status === "match" && (
                <span
                  style={{
                    fontSize: `calc(${cellSize} * 0.35)`,
                    color: "rgba(255,255,255,0.6)",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  {"✓"}
                </span>
              )}

              {/* Mismatch indicator */}
              {status === "wrong" && (
                <span
                  style={{
                    fontSize: `calc(${cellSize} * 0.35)`,
                    color: "rgba(255,255,255,0.8)",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  {"✗"}
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
