import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient();

    const result = await Promise.race([
      supabase.from('games').select('id', { count: 'exact', head: true }).limit(0),
      new Promise<{ error: { message: string } }>((_, reject) =>
        setTimeout(() => reject(new Error('DB check timed out')), 2000)
      ),
    ]);

    if (result.error) {
      return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
    }

    return Response.json({ status: 'ok', db: 'connected' });
  } catch {
    return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
  }
}
