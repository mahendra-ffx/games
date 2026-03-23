/**
 * IndexedDB storage via idb-keyval
 *
 * All client-side persistence lives here:
 * - Game streaks (per game type)
 * - Today's progress (per game + date, so refresh doesn't lose state)
 * - Hint token balance (resets at midnight AEDT)
 * - User preferences (theme, accessibility settings)
 * - Offline event queue (flushed when back online)
 */

import { get, set, createStore } from "idb-keyval";

// Separate stores to avoid key collisions
const streakStore = createStore("games-streaks", "streaks");
const progressStore = createStore("games-progress", "progress");
const prefsStore = createStore("games-prefs", "prefs");
const queueStore = createStore("games-queue", "queue");

// ── Streak management ──────────────────────────────────────────────────────

export interface StreakData {
  current: number;
  longest: number;
  lastPlayedDate: string; // YYYY-MM-DD in AEDT
}

export async function getStreak(gameType: string): Promise<StreakData> {
  const stored = await get<StreakData>(gameType, streakStore);
  return stored ?? { current: 0, longest: 0, lastPlayedDate: "" };
}

export async function updateStreak(
  gameType: string,
  todayAEDT: string
): Promise<StreakData> {
  const streak = await getStreak(gameType);

  if (streak.lastPlayedDate === todayAEDT) {
    // Already played today — no change
    return streak;
  }

  const yesterday = getPreviousDay(todayAEDT);
  const isConsecutive = streak.lastPlayedDate === yesterday;

  const updated: StreakData = {
    current: isConsecutive ? streak.current + 1 : 1,
    longest: Math.max(streak.longest, isConsecutive ? streak.current + 1 : 1),
    lastPlayedDate: todayAEDT,
  };

  await set(gameType, updated, streakStore);
  return updated;
}

// ── Game progress ──────────────────────────────────────────────────────────

export interface GameProgress {
  gameType: string;
  date: string; // YYYY-MM-DD
  state: Record<string, unknown>; // game-specific state
  completed: boolean;
  score?: number;
}

export async function saveProgress(progress: GameProgress): Promise<void> {
  const key = `${progress.gameType}:${progress.date}`;
  await set(key, progress, progressStore);
}

export async function getProgress(
  gameType: string,
  date: string
): Promise<GameProgress | undefined> {
  return get<GameProgress>(`${gameType}:${date}`, progressStore);
}

// ── Hint tokens ────────────────────────────────────────────────────────────

interface HintTokenData {
  balance: number;
  resetDate: string; // YYYY-MM-DD AEDT — reset when date changes
}

export async function getHintBalance(
  tier: "anonymous" | "basic" | "premium",
  todayAEDT: string
): Promise<number> {
  const maxTokens = tier === "premium" ? 5 : 3;
  const stored = await get<HintTokenData>("hint-tokens", prefsStore);

  if (!stored || stored.resetDate !== todayAEDT) {
    // New day — reset tokens
    await set("hint-tokens", { balance: maxTokens, resetDate: todayAEDT }, prefsStore);
    return maxTokens;
  }

  return stored.balance;
}

export async function spendHintToken(cost: number): Promise<boolean> {
  const stored = await get<HintTokenData>("hint-tokens", prefsStore);
  if (!stored || stored.balance < cost) return false;

  await set(
    "hint-tokens",
    { ...stored, balance: stored.balance - cost },
    prefsStore
  );
  return true;
}

// ── Preferences ────────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  colourBlindMode: boolean;
  extendedTime: boolean; // 2x timer for timed games
  pushNotificationsEnabled: boolean;
  pushOptInSeen: boolean;
  fcmToken?: string;
}

const DEFAULT_PREFS: UserPreferences = {
  theme: "system",
  colourBlindMode: false,
  extendedTime: false,
  pushNotificationsEnabled: false,
  pushOptInSeen: false,
};

export async function getPreferences(): Promise<UserPreferences> {
  const stored = await get<UserPreferences>("prefs", prefsStore);
  return { ...DEFAULT_PREFS, ...stored };
}

export async function getPreference<K extends keyof UserPreferences>(
  key: K
): Promise<UserPreferences[K]> {
  const prefs = await getPreferences();
  return prefs[key];
}

export async function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): Promise<void> {
  const current = await getPreferences();
  await set("prefs", { ...current, [key]: value }, prefsStore);
}

// ── Offline event queue ────────────────────────────────────────────────────

export interface QueuedEvent {
  id: string;
  endpoint: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export async function enqueueEvent(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<void> {
  const existing = (await get<QueuedEvent[]>("offline-queue", queueStore)) ?? [];
  const event: QueuedEvent = {
    id: crypto.randomUUID(),
    endpoint,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };
  await set("offline-queue", [...existing, event], queueStore);
}

export async function flushEventQueue(): Promise<void> {
  const queue = (await get<QueuedEvent[]>("offline-queue", queueStore)) ?? [];
  if (queue.length === 0) return;

  const failed: QueuedEvent[] = [];

  await Promise.all(
    queue.map(async (event) => {
      try {
        const res = await fetch(event.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.payload),
        });
        if (!res.ok) throw new Error(`${res.status}`);
      } catch {
        if (event.retries < 3) {
          failed.push({ ...event, retries: event.retries + 1 });
        }
        // Drop after 3 retries to avoid queue bloat
      }
    })
  );

  await set("offline-queue", failed, queueStore);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getTodayAEDT(): string {
  return new Date()
    .toLocaleDateString("en-AU", { timeZone: "Australia/Canberra" })
    .split("/")
    .reverse()
    .map((p) => p.padStart(2, "0"))
    .join("-");
}
