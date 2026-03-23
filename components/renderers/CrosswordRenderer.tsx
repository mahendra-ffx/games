"use client";

/**
 * CrosswordRenderer — Daily Mini Crossword (5×5)
 *
 * Fixes applied (2026-03-22):
 *  P0-1  Black cells corrected to [1,1],[1,3],[3,1],[3,3] — matching the prototype
 *  P0-2  Completion auto-triggers server validation when all cells are filled
 *  P1-1  Shake animation on incorrect cells (CSS keyframe)
 *  P1-2  Sticky bottom clue bar (position:fixed) — matches prototype UX on mobile
 *  P1-3  Win confetti + celebration overlay on completion
 *  P1-4  Smart direction auto-select on cell click
 *
 * Solutions NEVER sent to client. Each cell guess is validated via
 * POST /api/validate (server-side check against CMS answer).
 *
 * Keyboard navigation:
 * - Arrow keys: move between cells
 * - Tab / Shift+Tab: toggle direction
 * - Backspace: clear cell + move back
 * - Letter keys: fill cell + advance
 *
 * Hints:
 * - Check cell (free): highlight correct/incorrect state
 * - Reveal letter (1 token): server returns correct letter for active cell
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
} from "react";
import confetti from "canvas-confetti";
import { announceToScreenReader } from "@/components/GameShell";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrosswordRendererProps {
  gameId: string;
  size: number;
  clues: { across: Record<string, string>; down: Record<string, string> };
  onComplete: (score: number) => void;
  hintTier?: 1 | 2;
}

type Direction = "across" | "down";
type CellState = "empty" | "correct" | "incorrect" | "revealed";

interface Cell {
  value: string;
  state: CellState;
  isBlack: boolean;
  clueNumber?: number;
}

// ── P0-1: Correct black cell layout — matches prototype ────────────────────────
// Prototype grid:
//   H E A R T   row 0  (1-Across: HEART)
//   E ■ R ■ E   row 1
//   A R E N A   row 2  (4-Across: ARENA)
//   P ■ A ■ M   row 3
//   S T A R S   row 4  (5-Across: STARS)
//
// Down words: 1=HEAPS  2=AREAA*  3=TEAMS
// (*2-Down has a content inconsistency in the prototype — editor to resolve)
const BLACK_CELLS_5x5: [number, number][] = [
  [1, 1], [1, 3],
  [3, 1], [3, 3],
];

function isBlack(row: number, col: number): boolean {
  return BLACK_CELLS_5x5.some(([r, c]) => r === row && c === col);
}

// ── Clue numbering — standard crossword rules ──────────────────────────────────

function buildClueNumbers(size: number): Record<string, number> {
  const nums: Record<string, number> = {};
  let n = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isBlack(r, c)) continue;
      const startsAcross =
        (c === 0 || isBlack(r, c - 1)) && c + 1 < size && !isBlack(r, c + 1);
      const startsDown =
        (r === 0 || isBlack(r - 1, c)) && r + 1 < size && !isBlack(r + 1, c);
      if (startsAcross || startsDown) {
        nums[`${r},${c}`] = n++;
      }
    }
  }
  return nums;
}

// ── Inline word helper (pure, used in render & click handler) ─────────────────

function getWordCells(
  row: number,
  col: number,
  dir: Direction,
  size: number
): [number, number][] {
  let sr = row, sc = col;
  if (dir === "across") {
    while (sc > 0 && !isBlack(sr, sc - 1)) sc--;
  } else {
    while (sr > 0 && !isBlack(sr - 1, sc)) sr--;
  }
  const result: [number, number][] = [];
  if (dir === "across") {
    for (let c = sc; c < size && !isBlack(sr, c); c++) result.push([sr, c]);
  } else {
    for (let r = sr; r < size && !isBlack(r, sc); r++) result.push([r, sc]);
  }
  return result;
}

function getWordStart(row: number, col: number, dir: Direction): [number, number] {
  let sr = row, sc = col;
  if (dir === "across") {
    while (sc > 0 && !isBlack(sr, sc - 1)) sc--;
  } else {
    while (sr > 0 && !isBlack(sr - 1, sc)) sr--;
  }
  return [sr, sc];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CrosswordRenderer({
  gameId,
  size,
  clues,
  onComplete,
  hintTier,
}: CrosswordRendererProps) {
  const cellRefs = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: size }, () => Array(size).fill(null))
  );

  const [cells, setCells] = useState<Cell[][]>(() =>
    Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({
        value: "",
        state: "empty" as CellState,
        isBlack: isBlack(r, c),
      }))
    )
  );

  const [direction, setDirection] = useState<Direction>("across");
  const [activeCell, setActiveCell] = useState<[number, number]>([0, 0]);
  const [completed, setCompleted] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const autoCheckInProgressRef = useRef(false);

  const clueNumbers = buildClueNumbers(size);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const moveTo = useCallback(
    (row: number, col: number) => {
      if (row < 0 || row >= size || col < 0 || col >= size) return;
      if (isBlack(row, col)) return;
      setActiveCell([row, col]);
      cellRefs.current[row]?.[col]?.focus();
    },
    [size]
  );

  const advance = useCallback(
    (row: number, col: number, dir: Direction) => {
      if (dir === "across") {
        for (let c = col + 1; c < size; c++) {
          if (!isBlack(row, c)) { moveTo(row, c); return; }
        }
      } else {
        for (let r = row + 1; r < size; r++) {
          if (!isBlack(r, col)) { moveTo(r, col); return; }
        }
      }
    },
    [size, moveTo]
  );

  const retreat = useCallback(
    (row: number, col: number, dir: Direction) => {
      if (dir === "across") {
        for (let c = col - 1; c >= 0; c--) {
          if (!isBlack(row, c)) { moveTo(row, c); return; }
        }
      } else {
        for (let r = row - 1; r >= 0; r--) {
          if (!isBlack(r, col)) { moveTo(r, col); return; }
        }
      }
    },
    [moveTo]
  );

  // ── Key handling ─────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
      const key = e.key;

      if (key === "ArrowRight") { e.preventDefault(); moveTo(row, col + 1); return; }
      if (key === "ArrowLeft")  { e.preventDefault(); moveTo(row, col - 1); return; }
      if (key === "ArrowDown")  { e.preventDefault(); moveTo(row + 1, col); return; }
      if (key === "ArrowUp")    { e.preventDefault(); moveTo(row - 1, col); return; }

      if (key === "Tab") {
        e.preventDefault();
        setDirection((d) => (d === "across" ? "down" : "across"));
        return;
      }

      if (key === "Backspace") {
        e.preventDefault();
        setCells((prev) => {
          const next = prev.map((r) => r.map((c) => ({ ...c })));
          if (next[row][col].value) {
            next[row][col].value = "";
            next[row][col].state = "empty";
          } else {
            retreat(row, col, direction);
          }
          return next;
        });
        return;
      }

      if (key.length === 1 && /[a-zA-Z]/.test(key)) {
        e.preventDefault();
        const letter = key.toUpperCase();
        setCells((prev) => {
          const next = prev.map((r) => r.map((c) => ({ ...c })));
          next[row][col].value = letter;
          next[row][col].state = "empty";
          return next;
        });
        advance(row, col, direction);
      }
    },
    [direction, moveTo, advance, retreat]
  );

  // ── Server validation ─────────────────────────────────────────────────────────

  const validateCell = useCallback(
    async (row: number, col: number, letterOverride?: string) => {
      const letter = letterOverride ?? cells[row][col].value;
      if (!letter) return;

      try {
        const res = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "crossword",
            gameId,
            guess: { row, col, letter },
          }),
        });
        const { correct } = await res.json();
        setCells((prev) => {
          const next = prev.map((r) => r.map((c) => ({ ...c })));
          next[row][col].state = correct ? "correct" : "incorrect";
          return next;
        });
        announceToScreenReader(correct ? "Correct!" : "Incorrect.");
      } catch {
        // Network error — leave state as-is
      }
    },
    [cells, gameId]
  );

  /** Check all filled unchecked cells sequentially */
  const checkAll = useCallback(async () => {
    setIsValidating(true);
    const toCheck: [number, number][] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!cells[r][c].isBlack && cells[r][c].value && cells[r][c].state === "empty") {
          toCheck.push([r, c]);
        }
      }
    }
    for (const [r, c] of toCheck) {
      await validateCell(r, c);
    }
    setIsValidating(false);
  }, [cells, size, validateCell]);

  // ── Hint handling ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hintTier) return;
    const [row, col] = activeCell;

    if (hintTier === 1) {
      validateCell(row, col);
    }

    if (hintTier === 2) {
      fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "crossword",
          gameId,
          guess: { row, col, letter: null, reveal: true },
        }),
      })
        .then((r) => r.json())
        .then(({ letter }: { letter?: string }) => {
          if (!letter) return;
          setCells((prev) => {
            const next = prev.map((r2) => r2.map((c) => ({ ...c })));
            next[row][col].value = letter;
            next[row][col].state = "revealed";
            return next;
          });
        })
        .catch(() => null);
    }
  }, [hintTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── P0-2: Completion — auto-validate when all cells filled ────────────────────

  useEffect(() => {
    if (completed) return;

    const allFilled = cells.every((row) =>
      row.every((cell) => cell.isBlack || cell.value !== "")
    );
    if (!allFilled) return;

    const unchecked = cells.flatMap((row, r) =>
      row.flatMap((cell, c) =>
        !cell.isBlack && cell.value && cell.state === "empty" ? [[r, c]] : []
      )
    );

    if (unchecked.length === 0) {
      // All cells validated — check result
      const allCorrect = cells
        .flat()
        .filter((c) => !c.isBlack)
        .every((c) => c.state === "correct" || c.state === "revealed");

      if (allCorrect) {
        const correctCount = cells.flat().filter(
          (c) => !c.isBlack && (c.state === "correct" || c.state === "revealed")
        ).length;
        const totalCells = cells.flat().filter((c) => !c.isBlack).length;
        const score = Math.round((correctCount / totalCells) * 1000);

        setCompleted(true);
        setShowWin(true);
        announceToScreenReader("Congratulations! Crossword complete!");
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.4 },
          colors: ["#00558c", "#22c55e", "#f59e0b", "#ec4899"],
        });
        onComplete(score);
      }
    } else if (!autoCheckInProgressRef.current) {
      // Grid just became fully filled — auto-validate all unchecked cells
      autoCheckInProgressRef.current = true;
      checkAll().finally(() => {
        autoCheckInProgressRef.current = false;
      });
    }
  }, [cells, completed, onComplete, checkAll]);

  // ── Render ─────────────────────────────────────────────────────────────────────

  const [ar, ac] = activeCell;
  const wordCells = getWordCells(ar, ac, direction, size);
  const [wsr, wsc] = getWordStart(ar, ac, direction);
  const startClueNum = clueNumbers[`${wsr},${wsc}`];
  const currentClueNum = startClueNum !== undefined ? String(startClueNum) : null;
  const currentClue =
    currentClueNum && direction === "across"
      ? clues.across[currentClueNum]
      : currentClueNum
      ? clues.down[currentClueNum]
      : null;

  const gridPx = Math.min(
    340,
    typeof window !== "undefined" ? window.innerWidth - 32 : 340
  );
  const cellSize = Math.floor(gridPx / size);

  return (
    <>
      {/* P1-1: Shake keyframe injected once */}
      <style>{`
        @keyframes crossword-shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-5px); }
          40%  { transform: translateX(5px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* P1-3: Win overlay */}
      {showWin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-80 rounded-2xl p-8 text-center shadow-2xl"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <p className="text-5xl mb-3">🎉</p>
            <h2
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: "var(--font-playfair)", color: "var(--color-ct-blue)" }}
            >
              Puzzle Solved!
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              You completed today&rsquo;s Daily Mini Crossword.
            </p>
            <button
              onClick={() => setShowWin(false)}
              className="w-full py-3 rounded-lg font-semibold text-white type-button"
              style={{ backgroundColor: "var(--color-ct-blue)" }}
            >
              SEE RESULTS
            </button>
          </div>
        </div>
      )}

      {/* Main content — pb-28 so sticky bar never obscures the grid */}
      <div className="pb-28">
        {/* Grid */}
        <div
          className="grid mx-auto mb-4 select-none"
          style={{
            gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
            gap: "2px",
            width: `${size * cellSize + (size - 1) * 2}px`,
            border: "3px solid var(--color-gray-900)",
            backgroundColor: "var(--color-gray-900)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          }}
          role="grid"
          aria-label="Crossword grid"
        >
          {cells.flatMap((row, r) =>
            row.map((cell, c) => {
              const isActive = r === ar && c === ac;
              const isWordCell = wordCells.some(([wr, wc]) => wr === r && wc === c);
              const clueNum = clueNumbers[`${r},${c}`];

              const bgColor = cell.isBlack
                ? "var(--color-gray-900)"
                : cell.state === "correct" || cell.state === "revealed"
                ? "var(--game-correct-bg)"
                : cell.state === "incorrect"
                ? "var(--game-wrong-bg)"
                : isActive
                ? "var(--game-active-bg)"
                : isWordCell
                ? "var(--game-word-bg)"
                : "var(--bg-surface)";

              const textColor =
                cell.state === "revealed"
                  ? "var(--game-revealed-text)"
                  : cell.state === "correct"
                  ? "var(--game-correct-text)"
                  : cell.state === "incorrect"
                  ? "var(--game-wrong-text)"
                  : "var(--text-primary)";

              return (
                <div
                  key={`${r}-${c}`}
                  className="relative"
                  style={{ width: cellSize, height: cellSize }}
                  role="gridcell"
                >
                  {cell.isBlack ? (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: "var(--color-gray-900)" }}
                      aria-hidden="true"
                    />
                  ) : (
                    <>
                      {clueNum !== undefined && (
                        <span
                          className="absolute top-0.5 left-0.5 leading-none pointer-events-none"
                          style={{ fontSize: "9px", color: "var(--text-secondary)", zIndex: 1 }}
                          aria-hidden="true"
                        >
                          {clueNum}
                        </span>
                      )}
                      <input
                        ref={(el) => { cellRefs.current[r][c] = el; }}
                        type="text"
                        inputMode="text"
                        maxLength={1}
                        value={cell.value}
                        readOnly
                        onFocus={() => setActiveCell([r, c])}
                        onClick={() => {
                          if (r === ar && c === ac) {
                            // Toggle direction on re-click of same cell
                            setDirection((d) => (d === "across" ? "down" : "across"));
                          } else {
                            // P1-4: Smart direction — stay in current direction only if
                            // it forms a valid word (≥ 2 cells) at this cell
                            const sameDirCells = getWordCells(r, c, direction, size);
                            if (sameDirCells.length < 2) {
                              setDirection((d) => (d === "across" ? "down" : "across"));
                            }
                            setActiveCell([r, c]);
                          }
                          cellRefs.current[r][c]?.focus();
                        }}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        className="w-full h-full text-center font-bold uppercase border-0 outline-none cursor-pointer"
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          fontSize: Math.max(14, cellSize * 0.42),
                          caretColor: "transparent",
                          border: isActive
                            ? "2px solid var(--color-ct-blue)"
                            : "1px solid var(--color-gray-300)",
                          // P1-1: Shake animation on incorrect
                          animation:
                            cell.state === "incorrect"
                              ? "crossword-shake 0.4s ease"
                              : "none",
                          transition: "background-color 0.15s",
                        }}
                        aria-label={`Row ${r + 1}, Column ${c + 1}${
                          clueNum !== undefined ? `, clue ${clueNum}` : ""
                        }${cell.value ? `, ${cell.value}` : ", empty"}`}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Clue lists — 2-col below grid */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {(["across", "down"] as Direction[]).map((dir) => (
            <div key={dir}>
              <p
                className="type-label uppercase mb-2"
                style={{ color: "var(--color-ct-blue)" }}
              >
                {dir}
              </p>
              <ol className="space-y-1">
                {Object.entries(clues[dir]).map(([num, clue]) => {
                  const isActiveClue = currentClueNum === num && direction === dir;
                  return (
                    <li
                      key={num}
                      className="text-sm cursor-pointer px-1 rounded"
                      style={{
                        color: isActiveClue
                          ? "var(--color-ct-blue)"
                          : "var(--text-secondary)",
                        backgroundColor: isActiveClue
                          ? "var(--game-clue-active-bg)"
                          : "transparent",
                        fontWeight: isActiveClue ? 600 : 400,
                      }}
                      onClick={() => {
                        // Clicking a clue jumps to the first empty cell in that word
                        setDirection(dir);
                        // Find the start cell for this clue number
                        const startKey = Object.entries(clueNumbers).find(
                          ([, n]) => String(n) === num
                        )?.[0];
                        if (startKey) {
                          const [sr, sc] = startKey.split(",").map(Number);
                          const wordCellsForClue = getWordCells(sr, sc, dir, size);
                          const firstEmpty = wordCellsForClue.find(
                            ([r, c]) => !cells[r][c].value
                          ) ?? wordCellsForClue[0];
                          if (firstEmpty) moveTo(firstEmpty[0], firstEmpty[1]);
                        }
                      }}
                    >
                      <span className="font-semibold">{num}.</span> {clue}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* P1-2: Sticky bottom clue bar — always visible, matches prototype */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderTop: "4px solid var(--color-ct-blue)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
          padding: "12px 16px",
        }}
      >
        <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {currentClueNum && currentClue ? (
              <>
                <p
                  className="type-label uppercase mb-0.5"
                  style={{ color: "var(--color-ct-blue)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em" }}
                >
                  {currentClueNum} {direction.charAt(0).toUpperCase() + direction.slice(1)}
                </p>
                <p
                  className="text-sm leading-snug truncate"
                  style={{ color: "var(--text-primary)", fontWeight: 500 }}
                  aria-live="polite"
                >
                  {currentClue}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Tap a square to start
              </p>
            )}
          </div>

          <button
            onClick={checkAll}
            disabled={isValidating || completed}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50 transition-opacity"
            style={{
              backgroundColor: "var(--color-ct-blue)",
              color: "#ffffff",
              fontSize: "13px",
            }}
          >
            {isValidating ? "Checking…" : completed ? "Done ✓" : "Check Grid"}
          </button>
        </div>
      </div>
    </>
  );
}
