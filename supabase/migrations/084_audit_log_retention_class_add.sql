-- PR 0b (first migration of two) — Audit-log retention class.
--
-- Adds the retention_class column to audit_log so the cleanup-audit-log cron
-- can distinguish events that need 30-day cleanup ('operational') from events
-- subject to 10-year regulatory retention ('regulatory'). See plan in
-- /Users/secondturn/.claude/plans/ + CLAUDE.md "Audit Events" register.
--
-- Why two migrations: ALTER ADD COLUMN NOT NULL fails on a non-empty table
-- without a default. The safe pattern is (a) add nullable + backfill here, then
-- (b) update emission sites in code, then (c) tighten to NOT NULL in migration
-- 085. The intermediate nullable state survives the deploy gap between this
-- migration running and the next one.
--
-- Reasoning for the classifier below: any event that may be relevant to a
-- regulator inquiry, OSS prior-period adjustment, accountant retention
-- (Grāmatvedības likums §10 = 5y, PVN likums Art. 133 = 5y, OSS Article 369k
-- = 10y, DAC7 Article 25 of Directive 2011/16/EU = 10y), DSA Art. 16/17
-- defensibility, or trader-status (Kamenova C-105/17) defense gets
-- 'regulatory'. Conservative bias: misclassifying toward retention costs disk;
-- misclassifying toward deletion is irrecoverable.

alter table public.audit_log
  add column retention_class text;

-- Backfill existing rows by action prefix.
-- Every action-string currently in use as of migration 084 is enumerated;
-- anything unrecognised falls through to 'operational' (deliberately — if a
-- new event was added without registration, the safe default is short
-- retention). The CLAUDE.md "canonical register" discipline prevents this
-- from being a long-term issue going forward.
update public.audit_log set retention_class = 'regulatory'
 where action in (
   -- Version acceptance (preserved across version bumps for "who agreed to X?")
   'terms.accepted',
   'seller_terms.accepted',
   -- DSA Art. 16 receipt + Art. 17 statement-of-reasons
   'dsa_notice.received',
   'listing.actioned_by_staff',
   -- Seller suspension + trader-detection workflow (Kamenova C-105/17)
   'seller.status_changed',
   'seller.trader_signal_crossed',
   'seller.trader_signal_dismissed',
   'seller.verification_requested',
   'seller.verification_responded',
   'seller.verification_unresponsive',
   -- Financial events (accountant retention + OSS prior-period adjustments)
   'order.refunded',
   'payment.refunded',
   'payment.cart_completed',
   'payment.cart_wallet_completed',
   'payment.cart_created',
   'wallet.credit',
   'wallet.debit',
   'wallet.refund',
   'wallet.withdrawal_requested',
   -- Contract-resolution audit chain (multi-year defensibility). delivery_escalated
   -- auto-creates a dispute row; same regulatory weight as dispute.opened.
   'dispute.opened',
   'dispute.escalated',
   'dispute.staff_resolved',
   'dispute.seller_accepted_refund',
   'dispute.withdrawn',
   'order.delivery_escalated'
 );

-- Dynamic action: order.auto_cancelled.{reason} — fired by enforce-deadlines cron
-- when a deadline expires (response_timeout, shipping_timeout, etc.). The reason is
-- appended to the action string at emission time, so a literal IN-list misses these.
-- Classified as regulatory because the auto-cancellation triggers an automated
-- refund chain (companion order.refunded/payment.refunded events are also regulatory).
update public.audit_log set retention_class = 'regulatory'
 where retention_class is null
   and action like 'order.auto_cancelled.%';

update public.audit_log set retention_class = 'operational'
 where retention_class is null
   and action in (
     -- Order lifecycle (status_changed is derivative of orders.status column)
     'order.status_changed',
     -- Shipping operational events
     'order.parcel_returning',
     'shipment.cancelled',
     -- Moderation (the regulatory companion event fires alongside if applicable)
     'comment.deleted',
     'order_message.deleted'
   );

-- Anything still null is an unrecognised action; default to 'operational' for
-- safety (short retention). If real prod data surfaces an unrecognised action
-- with regulatory weight, follow up with a corrective UPDATE in a later
-- migration.
update public.audit_log set retention_class = 'operational'
 where retention_class is null;

comment on column public.audit_log.retention_class is
  'Retention bucket for the cleanup-audit-log cron. ''operational'' = 30 days. ''regulatory'' = 10 years (compliance/financial/legal). New emission sites must specify the class explicitly; the canonical register lives in CLAUDE.md "Audit Events". See migrations 084 + 085.';

create index idx_audit_log_retention_class on public.audit_log(retention_class)
  where retention_class = 'operational';
