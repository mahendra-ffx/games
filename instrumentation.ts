/**
 * Next.js instrumentation hook
 * Sentry server and edge SDK must be initialised here (not in sentry.server.config.ts)
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { init, captureConsoleIntegration } = await import("@sentry/nextjs");
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      integrations: [captureConsoleIntegration({ levels: ["error"] })],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { init } = await import("@sentry/nextjs");
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
  }
}
