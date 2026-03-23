/**
 * POST /api/push-register
 *
 * Saves a Web Push subscription for the authenticated (or anonymous) user.
 * Body: { subscription: PushSubscriptionJSON, uid?: string }
 *
 * TODO (Week 5+): Persist to Cloudflare KV and use stored subscriptions
 * to send daily game-ready push notifications via a Cloudflare Worker cron.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

interface PushRegisterBody {
  subscription: PushSubscriptionJSON;
  uid?: string;
}

// TODO: Replace with Cloudflare KV binding
const subscriptionStore = new Map<string, PushSubscriptionJSON>();

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PushRegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription, uid } = body;

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Key by uid (authenticated) or by endpoint hash (anonymous)
  const key = uid ?? subscription.endpoint.slice(-32);

  try {
    subscriptionStore.set(key, subscription);
    return NextResponse.json({ registered: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { context: "push_register" } });
    return NextResponse.json({ error: "Failed to register subscription" }, { status: 500 });
  }
}
