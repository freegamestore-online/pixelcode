import { GameShell, GameTopbar, GameButton, useGameSounds } from "@freegamestore/games";
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
  [FREESTYLE_LEVEL_ID]: "// Freestyle! Draw whatever you want.\n",
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

function loadSavedCode(): Record<number, string> {
  try {
    const raw = localStorage.getItem("pixelcode_code");
    if (raw) return JSON.parse(raw) as Record<number, string>;
  } catch { /* ignore */ }
  return {};
}

function loadCode(levelId: number): string {
  return loadSavedCode()[levelId] ?? STARTER_CODE[levelId] ?? "";
}

function saveCode(levelId: number, code: string) {
  try {
    localStorage.setItem("pixelcode_code", JSON.stringify({ ...loadSavedCode(), [levelId]: code }));
    localStorage.setItem("pixelcode_level", String(levelId));
  } catch { /* ignore */ }
}

function loadLevel(): number {
  try {
    const id = Number(localStorage.getItem("pixelcode_level"));
    if (id === FREESTYLE_LEVEL_ID || levels.some((l) => l.id === id)) return id;
  } catch { /* ignore */ }
  return 1;
}

function GameContent() {
  const { playTick, playError, playScore, playLevelUp } = useGameSounds();
  const [levelId, setLevelId] = useState(loadLevel);
  const [code, setCode] = useState(() => loadCode(levelId));
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by the running animation so speed changes apply mid-run
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const level = useMemo(
    () =>
      levelId === FREESTYLE_LEVEL_ID
        ? createFreestyleLevel()
        : levels.find((l) => l.id === levelId) ?? levels[0]!,
    [levelId],
  );

  const isFreestyle = levelId === FREESTYLE_LEVEL_ID;

  useEffect(() => {
    saveCode(levelId, code);
  }, [levelId, code]);

  // Tick on every animated or manual step
  useEffect(() => {
    if (stepIndex > 0) playTick();
  }, [stepIndex]);

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
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearRunning = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
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
      setCode(loadCode(id));
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

  const markCompleted = useCallback((id: number) => {
    setCompletedLevels((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveCompleted(next);
      return next;
    });
  }, []);

  const finishExecution = useCallback(
    (execSnapshots: ExecutionSnapshot[]) => {
      const lastSnap = execSnapshots[execSnapshots.length - 1];
      if (!lastSnap) return;

      if (lastSnap.error) {
        setMessage(lastSnap.error);
        setIsError(true);
        setIsSuccess(false);
        playError();
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
        if (painted > 0) {
          markCompleted(FREESTYLE_LEVEL_ID);
          playScore();
        }
        return;
      }

      const result = checkWin(lastSnap.grid, level.targetGrid);
      setMessage(result.message);
      if (result.won) {
        setIsSuccess(true);
        setIsError(false);
        markCompleted(level.id);
        playLevelUp();
        setTimeout(() => setShowComplete(true), 400);
      } else {
        setIsError(true);
        setIsSuccess(false);
        playError();
      }
    },
    [level, isFreestyle, markCompleted, playError, playScore, playLevelUp],
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
      playError();
      return;
    }

    // Animate through steps
    setIsRunning(true);
    let idx = 0;
    setStepIndex(0);

    const tick = () => {
      idx++;
      if (idx >= execSnaps.length) {
        clearRunning();
        setStepIndex(execSnaps.length - 1);
        finishExecution(execSnaps);
        return;
      }
      setStepIndex(idx);
      timerRef.current = setTimeout(tick, speedRef.current);
    };
    timerRef.current = setTimeout(tick, speedRef.current);
  }, [code, level, handleReset, clearRunning, finishExecution, playError]);

  const handleStep = useCallback(() => {
    if (snapshots.length === 0) {
      // First step: execute and show step 0
      const { snapshots: execSnaps, error } = execute(code, level.gridSize);
      setSnapshots(execSnaps);
      setStepIndex(0);
      if (error && execSnaps.length <= 1) {
        setMessage(error);
        setIsError(true);
        playError();
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
  }, [snapshots, stepIndex, code, level, finishExecution, playError]);

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

  // After the last numbered level, "Next" opens Freestyle
  const nextLevelId = levels.some((l) => l.id === levelId + 1)
    ? levelId + 1
    : isFreestyle ? null : FREESTYLE_LEVEL_ID;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="shrink-0">
        <GameTopbar title="PixelCode" actions={<GameButton size="sm" variant="ghost" onClick={() => setShowLevels(true)}>Levels</GameButton>} />
      </div>

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
          flexWrap: "wrap",
          rowGap: 2,
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

      {/* Stacked on phones (stage on top), side by side from md up */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Pixel canvas — a size container so the grid scales to fit */}
        <div
          className="flex shrink-0 basis-[45%] items-center justify-center overflow-hidden p-3 [container-type:size] md:basis-[55%] md:p-4"
          style={{ background: "var(--paper)" }}
        >
          <PixelCanvas
            grid={displayGrid}
            targetGrid={isFreestyle ? null : level.targetGrid}
            gridSize={level.gridSize}
          />
        </div>

        {/* Editor + Controls */}
        <div
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-t border-[var(--line)] p-3 md:border-t-0 md:border-l"
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
          hasNextLevel={nextLevelId !== null}
          onNext={() => nextLevelId !== null && handleSelectLevel(nextLevelId)}
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

export default function App() {
  return <GameShell><GameContent /></GameShell>;
}
