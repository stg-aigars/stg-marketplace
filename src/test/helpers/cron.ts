export async function callCron(name: string): Promise<Response> {
  const mod = await import(`@/app/api/cron/${name}/route`);
  const request = new Request(`http://localhost:3000/api/cron/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? 'test-cron-secret'}` },
  });
  return mod.POST(request);
}
