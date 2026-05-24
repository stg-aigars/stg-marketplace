/**
 * Supabase Database Webhook: auth.users INSERT.
 *
 * Sends a plain internal notification to ADMIN_EMAIL whenever a new row lands
 * in auth.users — covers email signup, OAuth, magic link, admin invite, every
 * path that creates a Supabase auth user.
 *
 * Setup (Supabase dashboard → Database → Webhooks):
 *   Name:      user-created-notification
 *   Table:     auth.users
 *   Events:    INSERT
 *   Type:      HTTP Request
 *   URL:       https://secondturn.games/api/webhooks/supabase-user-created
 *   Method:    POST
 *   HTTP Headers:
 *     Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
 *
 * Fire-and-forget: the route always returns 200 once auth passes so Supabase
 * doesn't retry on transient Resend failures. Failures are logged.
 */

import { env } from '@/lib/env';
import { resend } from '@/lib/email/client';

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    email: string | null;
    created_at: string;
    raw_app_meta_data?: { provider?: string } | null;
  } | null;
  old_record: unknown;
}

const DEFAULT_RECIPIENT = 'info@secondturn.games';

export async function POST(request: Request) {
  const secret = env.supabaseWebhook.secret;
  if (!secret) {
    console.error('[Webhook/SupabaseUserCreated] SUPABASE_WEBHOOK_SECRET not set');
    return new Response('Webhook not configured', { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await request.json()) as SupabaseWebhookPayload;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (
    payload.type !== 'INSERT' ||
    payload.schema !== 'auth' ||
    payload.table !== 'users' ||
    !payload.record
  ) {
    return new Response('OK', { status: 200 });
  }

  const { id, email, created_at, raw_app_meta_data } = payload.record;
  const provider = raw_app_meta_data?.provider ?? 'unknown';
  const recipient = env.app.adminEmail ?? DEFAULT_RECIPIENT;

  const subject = `New signup: ${email ?? '(no email)'} (${provider})`;
  const text = [
    `A new user just registered on Second Turn Games.`,
    ``,
    `Email:    ${email ?? '(no email)'}`,
    `Provider: ${provider}`,
    `User ID:  ${id}`,
    `Created:  ${created_at}`,
  ].join('\n');

  try {
    const { error } = await resend.emails.send({
      from: `Second Turn Games <${env.resend.fromEmail}>`,
      to: recipient,
      subject,
      text,
    });
    if (error) {
      console.error('[Webhook/SupabaseUserCreated] Resend error:', error);
    }
  } catch (err) {
    console.error('[Webhook/SupabaseUserCreated] Unexpected error:', err);
  }

  return new Response('OK', { status: 200 });
}
