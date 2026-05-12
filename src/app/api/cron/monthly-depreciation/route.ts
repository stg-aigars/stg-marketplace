/**
 * Monthly-depreciation cron.
 *
 * Runs day-1 of each month at 00:30 UTC and posts P.6 entries for the
 * previous month for every active fixed asset. Takes over from the
 * Phase 0 backfill / April 2026 backfill manually-emitted P.6 chain
 * (Entries 19, 20, phase0_entry_21 = months 1-3 of IT-2026-001's 36).
 *
 * source_doc_id pattern: `depreciation_<asset_code>_<YYYY-MM>`. Deterministic
 * per (asset, period); UNIQUE on (source_doc_type, source_doc_id, type_id)
 * makes re-runs hit `idempotent_skip`.
 *
 * Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/monthly-depreciation
 *
 * Schedule: `30 0 1 * *` (00:30 UTC on day 1 of every month).
 */

import { NextResponse } from 'next/server';

import { emit } from '@/lib/accounting/posting-engine';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';

import {
  buildDepreciationEvent,
  computeTargetPeriod,
  type FixedAssetRow,
} from './depreciation-logic';

interface PerAssetResult {
  asset_code: string;
  status: 'created' | 'idempotent_skip' | 'failed' | 'skip_disposed' | 'skip_before_start' | 'skip_complete';
  entry_id?: string;
  error?: string;
}

interface CronResult {
  target_period: string;
  posting_date: string;
  created: number;
  idempotent_skip: number;
  failed: number;
  skipped: number;
  per_asset: PerAssetResult[];
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const target = computeTargetPeriod(new Date());

  const result: CronResult = {
    target_period: target.period_key,
    posting_date: target.posting_date,
    created: 0,
    idempotent_skip: 0,
    failed: 0,
    skipped: 0,
    per_asset: [],
  };

  // Load every fixed asset (disposed_date filtered per-asset in buildDepreciationEvent
  // so the result surfaces which assets were skipped vs depreciated vs failed).
  const { data: assets, error: loadError } = await supabase
    .from('fixed_assets')
    .select('asset_code, acquisition_cost_cents, useful_life_months, depreciation_start_date, disposed_date')
    .order('asset_code');

  if (loadError) {
    return NextResponse.json(
      { ok: false, error: `load fixed_assets: ${loadError.message}` },
      { status: 500 },
    );
  }

  for (const raw of (assets ?? []) as ReadonlyArray<FixedAssetRow>) {
    const built = buildDepreciationEvent(raw, target);

    if (built.status === 'skip') {
      result.skipped += 1;
      const status =
        built.reason === 'disposed' ? 'skip_disposed'
        : built.reason === 'before_depreciation_start' ? 'skip_before_start'
        : 'skip_complete';
      result.per_asset.push({ asset_code: raw.asset_code, status });
      continue;
    }

    const emitResult = await emit(supabase, built.event);
    if (emitResult.status === 'created') {
      result.created += 1;
      result.per_asset.push({
        asset_code: raw.asset_code,
        status: 'created',
        entry_id: emitResult.entry_id,
      });
    } else if (emitResult.status === 'idempotent_skip') {
      result.idempotent_skip += 1;
      result.per_asset.push({
        asset_code: raw.asset_code,
        status: 'idempotent_skip',
        entry_id: emitResult.entry_id,
      });
    } else {
      result.failed += 1;
      result.per_asset.push({
        asset_code: raw.asset_code,
        status: 'failed',
        error: emitResult.error,
      });
    }
  }

  const httpStatus = result.failed > 0 ? 500 : 200;
  return NextResponse.json({ ok: result.failed === 0, result }, { status: httpStatus });
}
