/**
 * One-shot probe: dump the Unisend `GET /api/v2/parcel/{parcelId}` response
 * for a given order, so we can see what fields are actually returned and
 * whether any of them tell us the *actual* delivery terminal (vs. the
 * buyer-chosen terminal snapshotted at checkout).
 *
 * Usage:
 *   pnpm tsx scripts/probe-unisend-parcel.ts <order_number_or_uuid>
 *
 * Read-only. Calls Unisend with the credentials in .env.local. PII fields
 * (phone, email, name) are redacted in the output.
 */

import './_load-env';

import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';
import { getParcelDetail } from '@/lib/services/unisend/client';

const PII_KEY_PATTERN = /name|phone|email|person/i;

function redactPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPii);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEY_PATTERN.test(k) && typeof v === 'string') {
        out[k] = '<redacted>';
      } else {
        out[k] = redactPii(v);
      }
    }
    return out;
  }
  return value;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: pnpm tsx scripts/probe-unisend-parcel.ts <order_number_or_uuid>');
    process.exit(1);
  }

  const supabaseHost = (() => {
    try {
      return new URL(env.supabase.url).host;
    } catch {
      return env.supabase.url;
    }
  })();
  const unisendHost = (() => {
    try {
      return new URL(env.unisend.apiUrl).host;
    } catch {
      return env.unisend.apiUrl;
    }
  })();

  console.log('--- environment ---');
  console.log(`supabase: ${supabaseHost}`);
  console.log(`unisend : ${unisendHost}`);
  console.log('');

  const supabase = createServiceClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(arg);

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, unisend_parcel_id, terminal_id, terminal_name, terminal_city, terminal_postal_code, terminal_country'
    )
    .eq(isUuid ? 'id' : 'order_number', arg)
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }
  if (!order) {
    console.error(`Order not found for ${isUuid ? 'id' : 'order_number'}=${arg}`);
    process.exit(1);
  }

  console.log('--- order (from our DB) ---');
  console.log(`order_number       : ${order.order_number}`);
  console.log(`status             : ${order.status}`);
  console.log(`unisend_parcel_id  : ${order.unisend_parcel_id}`);
  console.log(`chosen terminal_id : ${order.terminal_id}`);
  console.log(`chosen name        : ${order.terminal_name}`);
  console.log(`chosen city        : ${order.terminal_city}`);
  console.log(`chosen postal      : ${order.terminal_postal_code}`);
  console.log(`chosen country     : ${order.terminal_country}`);
  console.log('');

  const { data: events } = await supabase
    .from('tracking_events')
    .select('event_type, state_type, location, event_timestamp')
    .eq('order_id', order.id)
    .order('event_timestamp', { ascending: true });
  console.log('--- tracking_events (our DB) ---');
  for (const e of events ?? []) {
    console.log(`${e.event_timestamp}  ${e.state_type.padEnd(20)} ${e.event_type.padEnd(25)} ${e.location ?? ''}`);
  }
  console.log('');

  if (!order.unisend_parcel_id) {
    console.error('Order has no unisend_parcel_id — nothing to probe.');
    process.exit(1);
  }

  console.log(`--- calling GET /api/v2/parcel/${order.unisend_parcel_id} ---`);
  let detail: unknown;
  try {
    detail = await getParcelDetail(order.unisend_parcel_id);
  } catch (err) {
    console.error('Unisend API call failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log('');
  console.log('--- top-level keys ---');
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    console.log(Object.keys(detail).join(', '));
  } else {
    console.log(`(response is not an object: ${typeof detail})`);
  }

  console.log('');
  console.log('--- full response (PII redacted) ---');
  console.log(JSON.stringify(redactPii(detail), null, 2));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
