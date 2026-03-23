import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of transactions in production for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay — capture 5% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask text fields by default for PII protection
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Don't report errors from browser extensions
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],

  beforeSend(event) {
    // Scrub piano_uid from request URLs before sending to Sentry
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/piano_uid=[^&]+/, "piano_uid=[REDACTED]");
    }
    return event;
  },
});
