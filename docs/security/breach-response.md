# Breach Response Runbook

## Classification

A personal data breach is any incident where personal data is accidentally or unlawfully:
- Accessed by unauthorized parties
- Lost or destroyed
- Altered without authorization

STG stores: names, email addresses, shipping addresses (via Unisend), country of residence, order history, wallet balances.

## Response Timeline (GDPR Article 33/34)

| Deadline | Action |
|----------|--------|
| Immediately | Contain the breach (revoke keys, disable affected endpoints) |
| Within 24 hours | Assess scope: which users, what data, how it happened |
| Within 72 hours | Notify Datu valsts inspekcija (dvi@dvi.gov.lv) if risk to users |
| Without undue delay | Notify affected users if high risk to their rights/freedoms |

## What to Report to DVI

- Nature of the breach
- Categories and approximate number of affected users
- Contact details of the data controller
- Likely consequences
- Measures taken to address and mitigate

## Key Contacts

- Datu valsts inspekcija: dvi@dvi.gov.lv, +371 67223131
- Supabase incident response: security@supabase.io
- EveryPay support: (add from dashboard)

## Immediate Actions Checklist

- [ ] Rotate Supabase service_role key if database compromised
- [ ] Rotate EveryPay API credentials if payment data affected
- [ ] Rotate CRON_SECRET
- [ ] Rotate Resend API key if email system compromised
- [ ] Rotate Unisend credentials if shipping data affected
- [ ] Review Supabase Auth logs for unauthorized access
- [ ] Check Supabase storage access logs
- [ ] Query audit_log table for suspicious activity
- [ ] Disable affected API routes if needed
- [ ] Draft user notification email (use Resend)
- [ ] Document timeline of events for DVI report

## Credential Locations

All secrets are stored as environment variables in Coolify. To rotate:
1. Generate new credential in the service's dashboard
2. Update the environment variable in Coolify
3. Redeploy the application
4. Verify the old credential no longer works

## Post-Incident

- [ ] Conduct root cause analysis
- [ ] Update security controls to prevent recurrence
- [ ] Update this runbook with lessons learned
- [ ] File DVI report if required (within 72 hours of discovery)
