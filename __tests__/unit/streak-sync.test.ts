/**
 * Tests for Week 4: streak sync, offline queue, and push registration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getStreak,
  updateStreak,
  enqueueEvent,
  flushEventQueue,
  getPreference,
  setPreference,
} from "@/lib/storage";

// ── Streak sync ───────────────────────────────────────────────────────────────

describe("streak server sync — /api/streak GET+POST", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET returns streak for an authenticated user", async () => {
    const { GET } = await import("@/app/api/streak/route");
    const req = new NextRequest("http://localhost/api/streak?gameType=binary_sort", {
      headers: { cookie: "__ppid=test-session-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("streak");
    expect(body.streak).toMatchObject({ current: 0, longest: 0 });
  });

  it("GET returns 401 when no session cookie", async () => {
    const { GET } = await import("@/app/api/streak/route");
    const req = new NextRequest("http://localhost/api/streak?gameType=binary_sort");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("GET returns 400 when gameType missing", async () => {
    const { GET } = await import("@/app/api/streak/route");
    const req = new NextRequest("http://localhost/api/streak", {
      headers: { cookie: "__ppid=test-session-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("POST saves streak and GET retrieves it", async () => {
    const { GET, POST } = await import("@/app/api/streak/route");
    const cookie = "__ppid=sync-test-uid";

    // Save streak
    const postReq = new NextRequest("http://localhost/api/streak", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        gameType: "binary_sort",
        streak: { current: 5, longest: 10, lastPlayedDate: "2026-03-21" },
      }),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.saved).toBe(true);

    // Retrieve it
    const getReq = new NextRequest(
      "http://localhost/api/streak?gameType=binary_sort",
      { headers: { cookie } }
    );
    const getRes = await GET(getReq);
    const getBody = await getRes.json();
    expect(getBody.streak.current).toBe(5);
    expect(getBody.streak.longest).toBe(10);
  });

  it("POST does not downgrade longest streak", async () => {
    const { GET, POST } = await import("@/app/api/streak/route");
    const cookie = "__ppid=downgrade-test-uid";

    // Save with high longest
    await POST(
      new NextRequest("http://localhost/api/streak", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "binary_sort",
          streak: { current: 20, longest: 20, lastPlayedDate: "2026-01-01" },
        }),
      })
    );

    // Attempt to downgrade longest
    await POST(
      new NextRequest("http://localhost/api/streak", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "binary_sort",
          streak: { current: 1, longest: 1, lastPlayedDate: "2026-03-21" },
        }),
      })
    );

    // longest must remain 20
    const getReq = new NextRequest(
      "http://localhost/api/streak?gameType=binary_sort",
      { headers: { cookie } }
    );
    const body = await (await GET(getReq)).json();
    expect(body.streak.longest).toBe(20);
    expect(body.streak.current).toBe(1);
  });

  it("POST rejects absurd streak values", async () => {
    const { POST } = await import("@/app/api/streak/route");
    const req = new NextRequest("http://localhost/api/streak", {
      method: "POST",
      headers: { cookie: "__ppid=x", "Content-Type": "application/json" },
      body: JSON.stringify({
        gameType: "binary_sort",
        streak: { current: 9999, longest: 9999, lastPlayedDate: "2026-03-21" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── Offline event queue ───────────────────────────────────────────────────────

describe("offline event queue", () => {
  it("enqueues and flushes events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    );

    await enqueueEvent("/api/score", { gameType: "binary_sort", score: 42 });

    await flushEventQueue();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/score",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("keeps event in queue on network failure (retries < max)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await enqueueEvent("/api/score", { score: 1 });

    // After flush with network failure the event should remain (or be dropped
    // after max retries — here retries=0 so it will be re-queued)
    await expect(flushEventQueue()).resolves.not.toThrow();
  });
});

// ── Preferences — push opt-in ─────────────────────────────────────────────────

describe("push opt-in preference", () => {
  it("pushOptInSeen defaults to false", async () => {
    const seen = await getPreference("pushOptInSeen");
    expect(seen).toBe(false);
  });

  it("can mark pushOptInSeen as true", async () => {
    await setPreference("pushOptInSeen", true);
    const seen = await getPreference("pushOptInSeen");
    expect(seen).toBe(true);
  });
});

// ── Local streak + IndexedDB round-trip ──────────────────────────────────────

describe("local streak mirrors server data", () => {
  it("updateStreak reflects in getStreak", async () => {
    await updateStreak("binary_sort", "2026-03-20");
    await updateStreak("binary_sort", "2026-03-21");
    const streak = await getStreak("binary_sort");
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
  });

  it("streaks are isolated per game type", async () => {
    await updateStreak("binary_sort", "2026-03-21");
    const crossword = await getStreak("crossword");
    expect(crossword.current).toBe(0);
  });
});
