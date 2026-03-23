"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary — catches React rendering errors in the App Router.
 * Required by Sentry for reporting React render errors.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
          backgroundColor: "#fff",
          color: "#111",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          We&apos;ve been notified and are looking into it.
        </p>
        <button
          onClick={reset}
          style={{
            backgroundColor: "#00558C",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
