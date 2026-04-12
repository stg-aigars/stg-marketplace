-- Document the payment_method cutover: values before this date are approximate
-- because all EveryPay-originated orders were stored as 'card' regardless of
-- whether the buyer actually paid by card or bank link.
COMMENT ON COLUMN orders.payment_method IS 'card | bank_link | wallet. Values before 2026-04-13 are approximate (all EveryPay orders were stored as card regardless of actual method).';
