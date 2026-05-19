import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient();

    // Index-only PK probe — verifies the DB is reachable and the games
    // catalog exists. Must NOT use `count: 'exact'` here: the container
    // probe runs every ~30s and `count: 'exact'` triggers a full seq scan
    // of the 170k-row games table on each call, which thrashes shared
    // buffers and consumes the Supabase Disk IO budget.
    const result = await Promise.race([
      supabase.from('games').select('id').limit(1),
      new Promise<{ error: { message: string } }>((_, reject) =>
        setTimeout(() => reject(new Error('DB check timed out')), 2000)
      ),
    ]);

    if (result.error) {
      return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
    }

    return Response.json({
      status: 'ok',
      db: 'connected',
      uptime: Math.floor(process.uptime()),
      version: process.env.BUILD_ID ?? 'dev',
    });
  } catch {
    return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
  }
}
