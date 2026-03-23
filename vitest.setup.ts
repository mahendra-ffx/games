import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock idb-keyval for unit/integration tests (no IndexedDB in jsdom)
// Each store name maps to its own Map to prevent cross-store key collisions.
const idbStores = new Map<string, Map<string, unknown>>();

function getStore(storeName: unknown): Map<string, unknown> {
  const name = typeof storeName === "string" ? storeName : "default";
  if (!idbStores.has(name)) idbStores.set(name, new Map());
  return idbStores.get(name)!;
}

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string, storeName?: unknown) =>
    Promise.resolve(getStore(storeName).get(key))
  ),
  set: vi.fn((key: string, val: unknown, storeName?: unknown) => {
    getStore(storeName).set(key, val);
    return Promise.resolve();
  }),
  del: vi.fn((key: string, storeName?: unknown) => {
    getStore(storeName).delete(key);
    return Promise.resolve();
  }),
  createStore: vi.fn((dbName: string) => dbName),
}));

// Clear all idb stores between tests to prevent state leakage
beforeEach(() => {
  idbStores.clear();
});

// Mock PostHog — don't fire real analytics in tests
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

// Mock Sentry — don't send real errors in tests
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((fn: (scope: unknown) => void) => fn({ setTag: vi.fn(), setUser: vi.fn(), setExtra: vi.fn(), setLevel: vi.fn() })),
  setUser: vi.fn(),
  setTag: vi.fn(),
  init: vi.fn(),
}));

// Silence console.error in tests (reduce noise — check specific assertions instead)
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
