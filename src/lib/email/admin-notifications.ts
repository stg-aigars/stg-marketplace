/**
 * Internal admin notification emails — plain-text alerts to ADMIN_EMAIL
 * (info@secondturn.games fallback), same pattern as the new-signup email in
 * /api/webhooks/supabase-user-created.
 *
 * Fire-and-forget: never throws, callers use `void sendAdminNotification(...)`.
 */

import { env } from '@/lib/env';
import { resend } from './client';

const DEFAULT_RECIPIENT = 'info@secondturn.games';

export async function sendAdminNotification(subject: string, lines: string[]): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: `Second Turn Games <${env.resend.fromEmail}>`,
      to: env.app.adminEmail ?? DEFAULT_RECIPIENT,
      subject,
      text: lines.join('\n'),
    });
    if (error) {
      console.error('[Email/AdminNotification] Resend error:', error);
    }
  } catch (err) {
    console.error('[Email/AdminNotification] Unexpected error:', err);
  }
}
