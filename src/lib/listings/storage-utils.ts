import { env } from '@/lib/env';

const STORAGE_PREFIX = `${env.supabase.url}/storage/v1/object/public/listing-photos/`;

/** Strip the Supabase public URL prefix to get the storage path (e.g. "{userId}/{uuid}.webp") */
export function extractStoragePath(url: string): string {
  return url.slice(STORAGE_PREFIX.length);
}
