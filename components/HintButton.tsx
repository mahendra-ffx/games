"use client";

/**
 * HintButton
 *
 * Displays hint token balance and lets the user spend tokens.
 * Shows a popover with available hints for the current game.
 */

import { useEffect, useState, useRef } from "react";
import { useHint as spendHintToken, getAvailableHints } from "@/lib/hints";
import type { GameType, HintConfig } from "@/lib/hints";
import type { UserType } from "@/lib/analytics";

interface HintButtonProps {
  gameType: GameType;
  userType: UserType;
  round?: number;
  timeIntoGame?: number;
  onHintGranted: (tier: 1 | 2) => void;
}

export function HintButton({
  gameType,
  userType,
  round = 1,
  timeIntoGame = 0,
  onHintGranted,
}: HintButtonProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [hints, setHints] = useState<HintConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [usedTiers, setUsedTiers] = useState<Set<number>>(new Set());
  const [isSpending, setIsSpending] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAvailableHints(gameType, userType).then(({ configs, balance: b }) => {
      setHints(configs);
      setBalance(b);
    });
  }, [gameType, userType]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleUseHint = async (tier: 1 | 2) => {
    if (isSpending) return;
    setIsSpending(true);

    const result = await spendHintToken({
      gameType,
      hintTier: tier,
      round,
      timeIntoGame,
      userType,
    });

    if (result.success) {
      setBalance(result.remainingTokens);
      setUsedTiers((prev) => new Set(prev).add(tier));
      onHintGranted(tier);
      setIsOpen(false);
    }

    setIsSpending(false);
  };

  if (balance === null) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Hints — ${balance} tokens remaining`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md type-label"
        style={{
          border: `1px solid var(--border)`,
          color: balance > 0 ? "var(--text-primary)" : "var(--text-muted)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        💡 {balance}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-lg p-3 z-30"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: `1px solid var(--border)`,
            boxShadow: "var(--shadow-base)",
          }}
        >
          <p className="type-label mb-3" style={{ color: "var(--text-secondary)" }}>
            {balance} hint token{balance !== 1 ? "s" : ""} remaining today
          </p>

          <div className="flex flex-col gap-2">
            {hints.map((hint) => {
              const isUsed = usedTiers.has(hint.tier);
              const canAfford = balance >= hint.cost;

              return (
                <button
                  key={hint.tier}
                  role="menuitem"
                  disabled={isUsed || !canAfford || isSpending}
                  onClick={() => handleUseHint(hint.tier)}
                  className="flex items-start gap-2 p-2 rounded-md text-left disabled:opacity-40"
                  style={{
                    backgroundColor: isUsed
                      ? "var(--bg-surface-hover)"
                      : "transparent",
                  }}
                >
                  <span className="mt-0.5 text-base">
                    {isUsed ? "✓" : hint.cost === 0 ? "🆓" : `🎫×${hint.cost}`}
                  </span>
                  <div>
                    <p className="type-label" style={{ color: "var(--text-primary)" }}>
                      {hint.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {hint.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {balance === 0 && (
            <p className="type-label mt-3 text-center" style={{ color: "var(--text-muted)" }}>
              Tokens reset at midnight AEDT
            </p>
          )}
        </div>
      )}
    </div>
  );
}
