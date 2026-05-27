import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ExecutionSnapshot } from "./types";
import { levels, FREESTYLE_LEVEL_ID, createFreestyleLevel } from "./engine/levels";
import { execute, checkWin } from "./engine/interpreter";
import PixelCanvas from "./components/PixelCanvas";
import CodeEditor from "./components/CodeEditor";
import GameControls from "./components/GameControls";
import LevelSelect from "./components/LevelSelect";
import LevelComplete from "./components/LevelComplete";

// Starter comments per level
const STARTER_CODE: Record<number, string> = {
  1: '// Set a color, then paint a pixel!\ncolor("red")\ndot(4, 4)\n',
  2: '// Paint three blue dots\ncolor("blue")\n',
  3: '// Draw a line across the top\ncolor("green")\n',
  4: '// Two lines make a cross\ncolor("red")\n',
  5: '// Draw a square outline\ncolor("blue")\n',
  6: '// Fill a solid rectangle\ncolor("orange")\n',
  7: '// Use repeat to make a pattern\ncolor("black")\n',
  8: "// Change color for each pixel!\n",
  9: '// A diagonal from corner to corner\ncolor("purple")\n',
  10: '// Draw a border around the grid\ncolor("red")\n',
  11: "// Compose shapes into a face!\n",
  12: "// Freestyle! Draw whatever you want.\n",
};

function loadCompleted(): Set<number> {
  try {
    const raw = localStorage.getItem("pixelcode_completed");
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveCompleted(set: Set<number>) {
  localStorage.setItem("pixelcode_completed", JSON.stringify([...set]));
}

export default function App() {
  const [levelId, setLevelId] = useState(1);
  const [code, setCode] = useState(STARTER_CODE[1] ?? "");
  const [snapshots, setSnapshots] = useState<ExecutionSnapshot[]>([]);
  const [stepIndex, setStepIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completedLevels, setCompletedLevels] = useState(loadCompleted);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const level = useMemo(
    () =>
      levelId === FREESTYLE_LEVEL_ID
        ? createFreestyleLevel()
        : levels.find((l) => l.id === levelId) ?? levels[0]!,
    [levelId],
  );

  const isFreestyle = levelId === FREESTYLE_LEVEL_ID || levelId === 12;

  // Current display state
  const currentSnapshot = stepIndex >= 0 && stepIndex < snapshots.length ? snapshots[stepIndex] : null;
  const displayGrid = currentSnapshot
    ? currentSnapshot.grid
    : Array.from({ length: level.gridSize }, () =>
        Array.from({ length: level.gridSize }, () => null),
      );
  const activeLine = currentSnapshot ? currentSnapshot.lineNumber : 0;

  // Can we step forward?
  const canStep = snapshots.length > 0 && stepIndex < snapshots.length - 1;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const clearRunning = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    clearRunning();
    setSnapshots([]);
    setStepIndex(-1);
    setMessage("");
    setIsError(false);
    setIsSuccess(false);
    setShowComplete(false);
  }, [clearRunning]);

  const handleClearCanvas = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const handleSelectLevel = useCallback(
    (id: number) => {
      clearRunning();
      setLevelId(id);
      setCode(
        id === FREESTYLE_LEVEL_ID
          ? "// Freestyle! Draw whatever you want.\n"
          : STARTER_CODE[id] ?? "",
      );
      setSnapshots([]);
      setStepIndex(-1);
      setMessage("");
      setIsError(false);
      setIsSuccess(false);
      setShowComplete(false);
      setShowLevels(false);
    },
    [clearRunning],
  );

  const finishExecution = useCallback(
    (execSnapshots: ExecutionSnapshot[]) => {
      const lastSnap = execSnapshots[execSnapshots.length - 1];
      if (!lastSnap) return;

      if (lastSnap.error) {
        setMessage(lastSnap.error);
        setIsError(true);
        setIsSuccess(false);
        return;
      }

      if (isFreestyle) {
        // Count painted pixels for freestyle
        let painted = 0;
        for (const row of lastSnap.grid) {
          for (const cell of row) {
            if (cell !== null) painted++;
          }
        }
        setMessage(`Drew ${painted} pixels!`);
        setIsSuccess(painted > 0);
        return;
      }

      const result = checkWin(lastSnap.grid, level.targetGrid);
      setMessage(result.message);
      if (result.won) {
        setIsSuccess(true);
        setIsError(false);
        setCompletedLevels((prev) => {
          const next = new Set(prev);
          next.add(level.id);
          saveCompleted(next);
          return next;
        });
        setTimeout(() => setShowComplete(true), 400);
      } else {
        setIsError(true);
        setIsSuccess(false);
      }
    },
    [level, isFreestyle],
  );

  const handleRun = useCallback(() => {
    handleReset();

    const { snapshots: execSnaps, error } = execute(code, level.gridSize);
    setSnapshots(execSnaps);

    if (error && execSnaps.length <= 1) {
      // Parse error - show immediately
      setStepIndex(0);
      setMessage(error);
      setIsError(true);
      return;
    }

    // Animate through steps
    setIsRunning(true);
    let idx = 0;
    setStepIndex(0);

    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= execSnaps.length) {
        clearRunning();
        setStepIndex(execSnaps.length - 1);
        finishExecution(execSnaps);
        return;
      }
      setStepIndex(idx);
    }, speed);
  }, [code, level, speed, handleReset, clearRunning, finishExecution]);

  const handleStep = useCallback(() => {
    if (snapshots.length === 0) {
      // First step: execute and show step 0
      const { snapshots: execSnaps, error } = execute(code, level.gridSize);
      setSnapshots(execSnaps);
      setStepIndex(0);
      if (error && execSnaps.length <= 1) {
        setMessage(error);
        setIsError(true);
      }
      return;
    }

    if (stepIndex < snapshots.length - 1) {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      if (nextIdx === snapshots.length - 1) {
        finishExecution(snapshots);
      }
    }
  }, [snapshots, stepIndex, code, level, finishExecution]);

  // Count target pixels for win modal
  const targetPixelCount = useMemo(() => {
    let count = 0;
    for (const row of level.targetGrid) {
      for (const cell of row) {
        if (cell !== null) count++;
      }
    }
    return count;
  }, [level]);

  const hasNextLevel = levels.some((l) => l.id === levelId + 1);

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{"🎨"}</span>
          <span>PixelCode</span>
        </h1>

        <div style={{ flex: 1 }} />

        <a
          href="https://freegamestore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
            marginRight: 8,
          }}
        >
          FreeGameStore
        </a>

        <button
          onClick={() => setShowLevels(true)}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid var(--line-strong)",
            background: "var(--paper)",
            color: "var(--ink)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Levels
        </button>
      </header>

      {/* Level info bar */}
      <div
        style={{
          padding: "6px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>
          {isFreestyle ? "Freestyle" : `Level ${level.id}`}
        </span>
        <span style={{ fontWeight: 600 }}>{level.name}</span>
        <span style={{ color: "var(--muted)" }}>{level.description}</span>
        <span
          style={{
            marginLeft: "auto",
            color: "var(--muted)",
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          Hint: {level.hint}
        </span>
      </div>

      {/* Main split layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left: Pixel canvas (55%) */}
        <div
          style={{
            flex: "0 0 55%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflow: "auto",
            background: "var(--paper)",
          }}
        >
          <PixelCanvas
            grid={displayGrid}
            targetGrid={isFreestyle ? null : level.targetGrid}
            gridSize={level.gridSize}
          />
        </div>

        {/* Right: Editor + Controls (45%) */}
        <div
          style={{
            flex: "0 0 45%",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--line)",
            padding: 12,
            gap: 10,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <GameControls
            onRun={handleRun}
            onStep={handleStep}
            onReset={handleReset}
            onClear={handleClearCanvas}
            isRunning={isRunning}
            hasCode={code.trim().length > 0}
            canStep={canStep || snapshots.length === 0}
            speed={speed}
            onSpeedChange={setSpeed}
            message={message}
            isError={isError}
            isSuccess={isSuccess}
          />

          <CodeEditor
            code={code}
            onChange={setCode}
            activeLine={activeLine}
            availableCommands={level.availableCommands}
            disabled={isRunning}
            hasError={isError}
          />
        </div>
      </div>

      {/* Modals */}
      {showLevels && (
        <LevelSelect
          currentLevel={levelId}
          completedLevels={completedLevels}
          onSelect={handleSelectLevel}
          onClose={() => setShowLevels(false)}
        />
      )}

      {showComplete && (
        <LevelComplete
          levelName={level.name}
          pixelCount={targetPixelCount}
          hasNextLevel={hasNextLevel}
          onNext={() => handleSelectLevel(levelId + 1)}
          onRetry={() => {
            setShowComplete(false);
            handleReset();
          }}
          onLevels={() => {
            setShowComplete(false);
            setShowLevels(true);
          }}
        />
      )}
    </div>
  );
}
