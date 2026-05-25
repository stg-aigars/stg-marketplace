export interface Announcement {
  id: string;
  slug: string;
  title: string;
  body_markdown: string;
  published_at: string | null;
  notified_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AnnouncementsActionResult = { success: true } | { error: string };

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 20000;
export const ANNOUNCEMENT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ANNOUNCEMENT_SLUG_RESERVED = ['new', 'edit', 'index'];
