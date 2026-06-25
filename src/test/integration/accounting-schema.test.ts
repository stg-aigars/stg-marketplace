import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestServiceClient, createTestAnonClient } from '../helpers/supabase';
import { dbExec, dbExecOrThrow } from '../helpers/db-exec';
import { createSignedInClient } from '../helpers/auth-personas';
import { deleteTestUser } from '../helpers/factories';
import { SYSTEM_COUNTERPARTY } from '@/lib/accounting/system-counterparties';

const supabase = createTestServiceClient();

const ACCOUNTING_TABLES = [
  'accounts',
  'periods',
  'vat_rates',
  'counterparties',
  'fixed_assets',
  'vendor_invoices',
  'journal_entries',
  'journal_lines',
] as const;

describe('accounting schema (PR 1)', () => {
  beforeAll(() => {
    // Sanity: confirm seeds landed.
    dbExecOrThrow('SELECT count(*)::int AS n FROM accounts;');
  });

  describe('triggers', () => {
    afterEach(() => {
      // Clean up any test entries/lines (TRUNCATE doesn't fire row triggers
      // so it bypasses the immutability guard).
      dbExecOrThrow('TRUNCATE TABLE public.journal_lines, public.journal_entries CASCADE;');
      // Reset any test-mutated period statuses back to open.
      dbExecOrThrow(
        "UPDATE public.periods SET status='open' WHERE period_key IN ('2026-12','2026-11') AND period_type='month';",
      );
    });

    it('T1: deferred balanced-entry check rejects imbalanced entries at COMMIT', async () => {
      const id = '11111111-1111-1111-1111-111111111111';
      // type_id added per PR #2 migration 097 (NOT NULL column for posting-engine
      // dispatch). Schema-test entries use synthetic 'TEST.T1' to avoid colliding
      // with real catalog IDs in idx_journal_entries_idempotency.
      const sql = [
        'BEGIN;',
        `INSERT INTO public.journal_entries (id, posting_date, accounting_period, tax_period, entry_type, type_id, source_doc_type, source_doc_id, narrative, created_by) VALUES ('${id}', '2026-04-15', '2026-04', '2026-04', 'manual', 'TEST.T1', 'schema_test', 't1_imbalanced_${Date.now()}', 'T1 imbalanced', 'test');`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 1, '2610', 1000, 0);`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 2, '5351', 0, 999);`,
        'COMMIT;',
      ].join(' ');
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Unbalanced journal entry/);

      // Verify rollback: entry should not exist.
      const { data: rows } = await supabase.from('journal_entries').select('id').eq('id', id);
      expect(rows ?? []).toHaveLength(0);
    });

    it('T1: deferred balanced-entry check accepts balanced entries', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      const sourceDocId = `t1_balanced_${Date.now()}`;
      const sql = [
        'BEGIN;',
        `INSERT INTO public.journal_entries (id, posting_date, accounting_period, tax_period, entry_type, type_id, source_doc_type, source_doc_id, narrative, created_by) VALUES ('${id}', '2026-04-15', '2026-04', '2026-04', 'manual', 'TEST.T1', 'schema_test', '${sourceDocId}', 'T1 balanced', 'test');`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 1, '2610', 1000, 0);`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 2, '5351', 0, 1000);`,
        'COMMIT;',
      ].join(' ');
      dbExecOrThrow(sql);

      const { data: rows } = await supabase.from('journal_entries').select('id').eq('id', id);
      expect(rows ?? []).toHaveLength(1);
    });

    it('T2: hard_locked period rejects insert with explicit error', async () => {
      dbExecOrThrow(
        "UPDATE public.periods SET status='hard_locked' WHERE period_key='2026-12' AND period_type='month';",
      );

      const { error } = await supabase.from('journal_entries').insert({
        id: '33333333-3333-3333-3333-333333333333',
        posting_date: '2026-12-15',
        accounting_period: '2026-12',
        tax_period: '2026-12',
        entry_type: 'manual',
        type_id: 'TEST.T2',
        source_doc_type: 'schema_test',
        source_doc_id: `t2_hard_${Date.now()}`,
        narrative: 'T2 hard-locked attempt',
        created_by: 'test',
      });
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/hard_locked/);
    });

    it('T2: soft_locked period rejects insert without period_close_adjustment flag', async () => {
      dbExecOrThrow(
        "UPDATE public.periods SET status='soft_locked' WHERE period_key='2026-12' AND period_type='month';",
      );

      const { error } = await supabase.from('journal_entries').insert({
        id: '44444444-4444-4444-4444-444444444444',
        posting_date: '2026-12-15',
        accounting_period: '2026-12',
        tax_period: '2026-12',
        entry_type: 'manual',
        type_id: 'TEST.T2',
        source_doc_type: 'schema_test',
        source_doc_id: `t2_soft_no_flag_${Date.now()}`,
        narrative: 'T2 soft-locked without flag',
        created_by: 'test',
        period_close_adjustment: false,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/soft_locked/);
    });

    it('T2: soft_locked period allows insert with period_close_adjustment=true', async () => {
      dbExecOrThrow(
        "UPDATE public.periods SET status='soft_locked' WHERE period_key='2026-12' AND period_type='month';",
      );

      const { error } = await supabase.from('journal_entries').insert({
        id: '55555555-5555-5555-5555-555555555555',
        posting_date: '2026-12-15',
        accounting_period: '2026-12',
        tax_period: '2026-12',
        entry_type: 'period_close',
        type_id: 'TEST.T2',
        source_doc_type: 'schema_test',
        source_doc_id: `t2_soft_with_flag_${Date.now()}`,
        narrative: 'T2 soft-locked with flag',
        created_by: 'test',
        period_close_adjustment: true,
      });
      expect(error).toBeNull();
    });

    it('T2: open period allows insert (sanity)', async () => {
      const { error } = await supabase.from('journal_entries').insert({
        id: '99999999-9999-9999-9999-999999999999',
        posting_date: '2026-11-15',
        accounting_period: '2026-11',
        tax_period: '2026-11',
        entry_type: 'manual',
        type_id: 'TEST.T2',
        source_doc_type: 'schema_test',
        source_doc_id: `t2_open_${Date.now()}`,
        narrative: 'T2 open sanity',
        created_by: 'test',
      });
      expect(error).toBeNull();
    });

    it('T3: UPDATE / DELETE on journal_entries and journal_lines raise immutability errors', async () => {
      const id = '66666666-6666-6666-6666-666666666666';
      const sourceDocId = `t3_immutability_${Date.now()}`;
      const insert = [
        'BEGIN;',
        `INSERT INTO public.journal_entries (id, posting_date, accounting_period, tax_period, entry_type, type_id, source_doc_type, source_doc_id, narrative, created_by) VALUES ('${id}', '2026-04-15', '2026-04', '2026-04', 'manual', 'TEST.T3', 'schema_test', '${sourceDocId}', 'T3 immutability', 'test');`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 1, '2610', 100, 0);`,
        `INSERT INTO public.journal_lines (entry_id, line_number, account_code, debit_cents, credit_cents) VALUES ('${id}', 2, '5351', 0, 100);`,
        'COMMIT;',
      ].join(' ');
      dbExecOrThrow(insert);

      const upd = dbExec(`UPDATE public.journal_entries SET narrative='changed' WHERE id='${id}';`);
      expect(upd.code).not.toBe(0);
      expect(upd.stderr + upd.stdout).toMatch(/Journal entries are immutable/);

      const del = dbExec(`DELETE FROM public.journal_entries WHERE id='${id}';`);
      expect(del.code).not.toBe(0);
      expect(del.stderr + del.stdout).toMatch(/Journal entries are immutable/);

      const updLine = dbExec(
        `UPDATE public.journal_lines SET debit_cents=200 WHERE entry_id='${id}' AND line_number=1;`,
      );
      expect(updLine.code).not.toBe(0);
      expect(updLine.stderr + updLine.stdout).toMatch(/Journal lines are immutable/);

      const delLine = dbExec(
        `DELETE FROM public.journal_lines WHERE entry_id='${id}' AND line_number=1;`,
      );
      expect(delLine.code).not.toBe(0);
      expect(delLine.stderr + delLine.stdout).toMatch(/Journal lines are immutable/);
    });
  });

  describe('RLS', () => {
    it('R1: anon SELECT returns empty data on all 8 accounting tables', async () => {
      const anon = createTestAnonClient();
      for (const table of ACCOUNTING_TABLES) {
        const { data, error } = await anon.from(table).select('*');
        if (error) {
          // Some PostgREST configurations return error code on RLS denial; accept any auth-shaped error.
          expect(error.code ?? '').toMatch(/PGRST|42501|JWT|auth/i);
        } else {
          expect(data, `anon should not see rows in ${table}`).toEqual([]);
        }
      }
    });

    it('R2: anon INSERT denied on journal_entries and journal_lines', async () => {
      const anon = createTestAnonClient();

      const { error: jeErr } = await anon.from('journal_entries').insert({
        id: '77777777-7777-7777-7777-777777777777',
        posting_date: '2026-04-15',
        accounting_period: '2026-04',
        tax_period: '2026-04',
        entry_type: 'manual',
        narrative: 'anon insert attempt',
        created_by: 'anon',
      });
      expect(jeErr, 'anon must be denied INSERT to journal_entries').not.toBeNull();

      const { error: jlErr } = await anon.from('journal_lines').insert({
        entry_id: '77777777-7777-7777-7777-777777777777',
        line_number: 1,
        account_code: '2610',
        debit_cents: 100,
        credit_cents: 0,
      });
      expect(jlErr, 'anon must be denied INSERT to journal_lines').not.toBeNull();
    });

    it('R3: authenticated non-staff SELECT returns empty on all 8 accounting tables', async () => {
      const persona = await createSignedInClient({ isStaff: false });
      try {
        for (const table of ACCOUNTING_TABLES) {
          const { data, error } = await persona.client.from(table).select('*');
          if (error) {
            expect(error.code ?? '').toMatch(/PGRST|42501/i);
          } else {
            expect(data, `non-staff should not see rows in ${table}`).toEqual([]);
          }
        }
      } finally {
        await deleteTestUser(persona.userId);
      }
    });

    it('R4: staff SELECT returns seeded rows + round-trips VID UUID pin', async () => {
      const persona = await createSignedInClient({ isStaff: true });
      try {
        const { data: accounts } = await persona.client.from('accounts').select('code');
        // Count tracks migration 096 seed + later account-adding migrations
        // (123: 7750 + 5310-META; 125: 2620 e-commerce settlement). Bump when
        // a migration adds a chart-of-accounts row.
        expect(accounts ?? []).toHaveLength(55);

        const { data: periods } = await persona.client
          .from('periods')
          .select('period_key, period_type');
        expect(periods ?? []).toHaveLength(97);

        const { data: vatRates } = await persona.client
          .from('vat_rates')
          .select('country, rate, valid_from');
        expect(vatRates ?? []).toHaveLength(4);

        // Loosened from toHaveLength(2) — PR #2 onwards integration tests
        // legitimately seed extra test counterparties (tagged with
        // PR<N>_INTEGRATION_TEST in full_name) and the FK from journal_lines
        // blocks cleanup. Intent of R4 is "staff can SELECT + the 2 seeded
        // system counterparties round-trip", not a strict population count.
        const { data: counterparties } = await persona.client
          .from('counterparties')
          .select('id, type, full_name, tin, vat_number');
        expect((counterparties ?? []).length).toBeGreaterThanOrEqual(2);
        const ids = (counterparties ?? []).map((c) => c.id);
        expect(ids).toContain(SYSTEM_COUNTERPARTY.VID);
        expect(ids).toContain(SYSTEM_COUNTERPARTY.STG_INTERNAL);

        const { data: fixedAssets } = await persona.client.from('fixed_assets').select('id');
        expect(fixedAssets ?? []).toHaveLength(0);

        const { data: vendorInvoices } = await persona.client.from('vendor_invoices').select('id');
        expect(vendorInvoices ?? []).toHaveLength(0);

        const { data: jeRows } = await persona.client.from('journal_entries').select('id');
        expect(jeRows).toBeInstanceOf(Array);

        const { data: jlRows } = await persona.client.from('journal_lines').select('id');
        expect(jlRows).toBeInstanceOf(Array);

        // Bonus: round-trip the pinned VID UUID.
        const { data: vid, error: vidErr } = await persona.client
          .from('counterparties')
          .select('id, type, full_name, tin')
          .eq('id', SYSTEM_COUNTERPARTY.VID)
          .single();
        expect(vidErr).toBeNull();
        expect(vid).not.toBeNull();
        expect(vid!.tin).toBe('90000010008');
        expect(vid!.type).toBe('tax_authority');
      } finally {
        await deleteTestUser(persona.userId);
      }
    });
  });
});
