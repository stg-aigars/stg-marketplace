# ROPA — Login-activity logging

**Date entered:** 2026-04-30
**Lawful basis sign-off:** Privacy counsel, 2026-04-30 (see message thread + lawyer-response.md)
**Status:** Live in production (migration 090, cron `cleanup-login-activity`)

## Processing activity

Login-activity logging for fraud detection **and platform security**.

## Categories of data subjects

All authenticated users (buyers, sellers, staff).

## Categories of personal data

| Field | Source | Notes |
|---|---|---|
| `user_id` | `auth.sessions.user_id` | FK to `auth.users` |
| `ip_address` (inet) | `auth.sessions.ip` | Raw IP — recommended over hash by counsel given Cloudflare WAF blocking pathway |
| `user_agent` | `auth.sessions.user_agent` | When available; nullable |
| `country` | nullable, app-side optional | Reserved for future cf-ipcountry capture from auth-callback flows; not populated by current trigger |
| `created_at` | `auth.sessions.created_at` | Login event timestamp |

## Purpose

- Account-takeover detection (login from unexpected country / new IP)
- Multi-account abuse detection (one IP behind many accounts)
- Manual fraud investigation by staff

Not used for marketing, profiling under Art. 22, or anything outside fraud / abuse investigation.

## Lawful basis

GDPR Article 6(1)(f) legitimate interest **(documented in this LIA / ROPA entry)**.

Recital 47 explicitly cites fraud prevention as a legitimate-interest example: *"The processing of personal data strictly necessary for the purposes of preventing fraud also constitutes a legitimate interest."*

### Balancing test

| Step | Assessment |
|---|---|
| Legitimate interest identified | Fraud prevention + account-security protection — financial-loss risk to users themselves if accounts are compromised. |
| Necessity | Cannot be achieved without the IP — without IP we cannot detect ATO from new locations or multi-account clustering. Country alone is insufficient (kills multi-account detection per counsel review). |
| Balancing | Mitigated by: (a) 30-day retention with irreversible deletion; (b) RLS — staff-only read; (c) staff reads logged in audit_log; (d) no third-party transfer; (e) no profiling, no automated decision-making with legal effects. User reasonable expectation: GDPR Recital 47 + privacy-policy §2 disclosure. |
| Outcome | Legitimate interest overrides the user's interest in not having login IP recorded for 30 days. |

## Recipients

STG staff only, RLS-enforced. Every staff query of the suspicious-activity surface is gated by `is_staff` in the staff layout. No third-party processors.

## Cross-border transfers

None. Data resides in Supabase EU region (Frankfurt).

## Retention

30 days, **automatic and irreversible** deletion via `cleanup-login-activity` cron (POST `/api/cron/cleanup-login-activity`).

## DSAR position

- **Erasure (Art. 17):** refused during the 30-day retention window per Art. 17(3)(b) (legal obligation to ensure security) / Art. 21(1) (compelling legitimate grounds for the processing which override the data subject's interests). After 30 days the row is gone via the cleanup cron, so erasure becomes moot.
- **Access (Art. 15):** users can read their own `login_activity` rows directly via the `login_activity_user_select` RLS policy on the table (access-by-design). DSAR responses cite this column-level access where applicable.

## DPIA

Not required (preliminary view, **does not meet Art. 35 high-risk thresholds**):
- Not large-scale systematic monitoring as defined in Art. 35(3)(c)
- No special-category data (Art. 9)
- No automated decision-making with legal effects (Art. 22)
- Narrow purpose, short retention, staff-only access

## Privacy-policy disclosure

Pre-existing — the policy at `/privacy` already covers this:
- §2 — "Usage data: ... IP address (for security and to improve the platform)"
- §6 — Cloudflare processes IPs at the edge
- §9 retention table — "Security logs (IP, login activity) — 30 days"

Counsel confirmed (2026-04-30) that no policy edit or acknowledgement banner is required because the new processing fits inside the existing disclosure bounds.

## Counsel-recommended follow-up

At next routine privacy-policy update (not blocking), add to §2:

> "to comply with legal obligations, such as audit trails for regulatory notices (e.g., DSA)."

This covers the existing `dsa_notices.reporter_ip` storage under Art. 6(1)(c) (legal obligation) framing.

## Capture mechanism

`AFTER INSERT` trigger on `auth.sessions` mirrors each row into `public.login_activity` (`mirror_session_to_login_activity` function, SECURITY DEFINER, EXCEPTION-wrapped so a capture failure never blocks sign-in). One row in `auth.sessions` per fresh authentication (refreshes update the same row, they don't insert), so the table reflects login events not refreshes.

In-database trigger means the capture path survives DR rebuilds — no Supabase dashboard configuration to forget.

## Suspicious-pattern flagger

`get_suspicious_login_activity(p_days int default 7, p_min_unique_ips int default 5)` RPC returns users whose recent login pattern crosses the unique-IP threshold. SECURITY DEFINER; EXECUTE granted only to `service_role`. Surfaced at `/staff/audit/security`.

Defaults match the legacy STG pattern (≥5 distinct IPs in 7 days). Tuneable from the staff UI for ad-hoc investigation.
