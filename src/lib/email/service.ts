/**
 * Email service
 * Resend client initialization and generic send helper.
 */

import { Resend } from 'resend';
import { env } from '@/lib/env';

const resend = new Resend(env.resend.apiKey);

const FROM_NAME = 'Second Turn Games';

interface SendEmailParams {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<{ id: string } | null> {
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${env.resend.fromEmail}>`,
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
