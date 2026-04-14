/**
 * Email service
 * Resend client initialization and generic send helper.
 * Skips sends for users with bounced/complained email addresses.
 */

import { Resend } from 'resend';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';

const resend = new Resend(env.resend.apiKey);

const FROM_NAME = 'Second Turn Games';

interface SendEmailParams {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<{ id: string } | null> {
  try {
    // Skip send if email has been flagged as bounced/complained
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email_bounced_at')
      .eq('email', to.toLowerCase())
      .not('email_bounced_at', 'is', null)
      .maybeSingle();

    if (profile) {
      console.log(`[Email] Skipped (bounced): ${to}`);
      return null;
    }

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${env.resend.fromEmail}>`,
      replyTo: 'support@secondturngames.com',
      to,
      subject,
      react,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return null;
  }
}
