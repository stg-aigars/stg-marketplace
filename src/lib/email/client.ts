import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';

export const resend = new Resend(env.resend.apiKey);

// Syntactic email-shape check shared by unauth POST routes that collect
// an email (feedback contactEmail, newsletter signup, DSA notifier email).
// The signup form intentionally uses a stricter pattern that also enforces
// a 2+ char TLD — do not unify without revisiting that path.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
