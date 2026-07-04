-- Add 'buyer' to counterparties.type (buyer-counterparty attribution).
--
-- Closes a documented gap: computeCartPayment (C.1/C.2) and the C.9
-- partial-refund-cash-leg compute both hardcode counterparty_id=null on the
-- buyer's 5351 wallet-contribution line, because journal_lines.counterparty_id
-- is a foreign key to counterparties(id) and no 'buyer' type existed to create
-- such a row against. This left those lines showing up as "unattributed" on
-- the staff wallet-integrity dashboard.
--
-- Does not retroactively touch any already-posted journal_lines — those stay
-- null (journal_lines are immutable by trigger). Only new entries, once the
-- engine-side wiring lands (lifecycle-wraps.ts, lifecycle-events.ts,
-- mapping.ts, same PR), get real attribution going forward.

alter table public.counterparties
  drop constraint counterparties_type_check;

alter table public.counterparties
  add constraint counterparties_type_check
  check (type in ('seller', 'vendor', 'tax_authority', 'internal', 'buyer'));
