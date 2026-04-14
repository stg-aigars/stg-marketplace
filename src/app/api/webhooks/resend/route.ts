/**
 * Resend webhook handler.
 * Receives email.bounced and email.complained events.
 * Flags affected users so the app can show in-app warnings
 * and skip future email sends for unreachable addresses.
 *
 * Setup: Configure the webhook URL in the Resend dashboard:
 * https://secondturn.games/api/webhooks/resend
 * Events: email.bounced, email.complained
 * Copy the signing secret to RESEND_WEBHOOK_SECRET in Coolify.
 */

import { Webhook } from 'svix';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id: string;
    to: string[];
    created_at: string;
  };
}

export async function POST(request: Request) {
  const secret = env.resend.webhookSecret;
  if (!secret) {
    return new Response('Webhook not configured', { status: 503 });
  }

  // Verify Svix signature
  const body = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing signature headers', { status: 400 });
  }

  let payload: ResendWebhookPayload;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload;
  } catch {
    console.error('[Webhook/Resend] Signature verification failed');
    return new Response('Invalid signature', { status: 401 });
  }

  const { type, data } = payload;

  if (type !== 'email.bounced' && type !== 'email.complained') {
    // Acknowledge but don't process other event types
    return new Response('OK', { status: 200 });
  }

  const emails = data.to;
  if (!emails?.length) {
    return new Response('OK', { status: 200 });
  }

  const supabase = createServiceClient();

  for (const email of emails) {
    const { error } = await supabase
      .from('user_profiles')
      .update({ email_bounced_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .is('email_bounced_at', null); // Only set once, don't overwrite

    if (error) {
      console.error(`[Webhook/Resend] Failed to flag bounce for ${email}:`, error.message);
    } else {
      console.log(`[Webhook/Resend] ${type}: flagged ${email}`);
    }
  }

  return new Response('OK', { status: 200 });
}
