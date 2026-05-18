# Internal Compliance-Advisor Analysis — Swedbank E-Commerce Gateway VAT Classification

> **Status:** Internal advisory. **NOT** a human accountant attestation.
>
> This file captures an analysis produced by a Custom Gem (an AI advisor configured for STG's legal / compliance / bookkeeping context) on the VAT treatment of Swedbank's e-commerce gateway service for invoice **V0000891330**. The Custom Gem's reasoning aligns with the lawyer/accountant-precedent reasoning previously established for related VAT questions (see [accountant-vat-confirmation.md](accountant-vat-confirmation.md)), but it is **not** itself an attestation from a licensed Latvian tax advisor (sertificēts nodokļu konsultants).
>
> **For audit purposes:** this file documents the contemporaneous basis on which STG made the I.1-vs-I.5 routing decision for the Swedbank gateway fee stream at the time of the May 2026 backfill (journal entry `invoice_V0000891330`, accounting period `2026-05`). A future external reviewer (VID audit, Big Four engagement, replacement accountant) asking "who classified this as standard-rated input VAT?" gets a truthful answer from this file: an internal Custom Gem analysis, against the legal reasoning in §92 PVN-likums + Article 168 of Directive 2006/112/EC, with human-accountant co-sign deferred.

**Date received:** 18 May 2026
**Source:** Custom Gem — *"Second Turn – Legal, Compliance & Bookkeeping Advisor"*
**Re:** VAT classification of Swedbank invoice V0000891330 (€0.60 net + €0.12 VAT, period 01.05.2026 – 15.05.2026, e-commerce gateway service "E-komercijas maksājumu platforma")
**Forward-convention impact:** sets the routing rule for every future Swedbank e-commerce gateway invoice

---

## Question put to the advisor

(Sent in Latvian; reproduced verbatim below.)

> Sveiki,
>
> Īss PVN klasifikācijas jautājums par pievienoto Swedbank rēķinu V0000891330 (15.05.2026, EUR 0.60 + 21% PVN 0.12, periods 01.05.–15.05.2026). Rēķins ir par Swedbank "E-komercijas maksājumu platformas" pakalpojumu — komisiju par darījumu apstrādi un par maksājumu ierosināšanu mūsu tiešsaistes karšu maksājumu vārtejā.
>
> Lūdzu apstipriniet rakstiski, ka šis ir korekti uzskatāms par:
>
> - **Ar standarta likmi apliekamu maksājumu-tehnoloģijas pakalpojumu**, kuram priekšnodoklis ir atskaitāms saskaņā ar PVN likuma 92. pantu / Direktīvas 2006/112/EK 168. pantu (PVN-1-I daļa, transakcijas kods A),
> - nevis ar PVN likuma 52. pantu / Direktīvas 135(1)(d) pantu **atbrīvotu finanšu starpniecības pakalpojumu**.
>
> Tas, ka Swedbank izrakstījis rēķinu ar atsevišķi norādītu 21% PVN, ir spēcīgs pierādījums, ka piegāde ir ar nodokli apliekama — bet robeža starp maksājumu-tehnoloģijas pakalpojumiem un atbrīvotu finanšu starpniecību ir tieši tā joma, kur vēlamies Jūsu apliecinājumu rakstiski. Šis rēķins nosaka grāmatošanas praksi visiem turpmākajiem Swedbank e-komercijas platformas rēķiniem.
>
> Konteksts: pārējās Swedbank komisijas (POS DAR per-darījuma komisija, ārvalstu maksājumu komisija, valūtas konvertācijas komisija) jau grāmatojam kā PVN-atbrīvotas saskaņā ar 52. pantu — tās arī rēķinā nenāk ar atsevišķu PVN. E-komercijas vārtejas pakalpojums ir jauna un strukturāli atšķirīga plūsma.
>
> Pietiek ar vienu rindu apliecinājuma (piem., "Jā, ar standarta likmi apliekams saskaņā ar [pants]") — saglabāsim to mūsu iekšējā audita pierakstā.
>
> Paldies,
> Aigars

---

## Advisor response (verbatim)

> Sveiks, Aigar!
>
> Kā tavs padomdevējs nodokļu un atbilstības jautājumos varu apstiprināt tavu pieņēmumu. Šeit ir formāls apliecinājums tavam iekšējam auditam un grāmatvedības reģistriem:
>
> **APSTIPRINĀJUMS:**
> Jā, apstiprinu. Rēķinā Nr. V0000891330 norādītais e-komercijas maksājumu platformas pakalpojums (darījumu apstrāde un komisija par maksājumu ierosināšanu) ir uzskatāms par ar standarta 21% likmi apliekamu tehnoloģisko pakalpojumu, un tajā norādītā PVN summa (0.12 EUR) ir atskaitāma kā priekšnodoklis saskaņā ar PVN likuma 92. pantu.
>
> **BACKGROUND:**
> Nodokļu likumdošana un Eiropas Savienības tiesu prakse nošķir reālu finanšu līdzekļu pārvedumu (kas ir atbrīvots no PVN saskaņā ar PVN likuma 52. pantu) no tehniskas infrastruktūras (vārtejas/gateway) nodrošināšanas, kas tikai tehniski apstrādā informāciju vai ierosina maksājumu. Tā kā pakalpojuma sniedzējs (Swedbank AS) rēķinā šiem e-komercijas platformas pakalpojumiem ir skaidri piemērojis 21% PVN likmi bāzei 0.60 EUR apmērā, tas apliecina, ka pakalpojums tiek klasificēts kā ar PVN apliekams IT/tehniskais pakalpojums.
>
> **IMPACT:**
>
> - ✅ **Atbilstība:** Tava pieeja ir pilnīgi pareiza. Tas, ka banka atsevišķi izdala PVN, nozīmē, ka pakalpojums nav klasificējams kā PVN-atbrīvots finanšu starpniecības pakalpojums.
> - 💰 **Finanses:** Tu drīksti atskaitīt šo priekšnodokli (PVN-1-I daļa), tādējādi samazinot uzņēmuma reālās izmaksas par šo pakalpojumu.
>
> **NEXT STEPS:**
>
> 1. Droši grāmato šo rēķinu un turpmākos strukturāli identiskos Swedbank e-komercijas platformas rēķinus ar standarta PVN likmi (transakcijas kods A), kā to biji plānojis.
> 2. Pārējās bankas komisijas (POS darījumi, konta apkalpošana), kurām rēķinos netiek piemērots PVN, turpini grāmatot kā no PVN atbrīvotas.

---

## Internal notes (not part of the advisor output)

### What this file IS

- The contemporaneous documentation of the VAT-classification reasoning at the time the May 2026 Swedbank gateway invoice was booked.
- Cited from the journal entry's `vat_classification_basis_ref` payload key (renamed from the plan's draft `accountant_confirmation_ref` to honestly reflect this file's source).
- Supporting evidence for the I.1-vs-I.5 routing discriminator established for the Swedbank counterparty:
  - Gateway invoices with separate 21% VAT lines → **I.1** (Art. 168 input VAT recovery, PVN-1-I-daļa code `A`)
  - Commission charges without separate VAT lines (POS DAR, foreign-payment, FX conversion) → **I.5** (Art. 52 / Art. 135(1)(d) exempt)

### What this file is NOT

- A licensed Latvian tax advisor's written attestation. Compare to [accountant-vat-confirmation.md](accountant-vat-confirmation.md), whose frontmatter is signed by a "Latvia certified tax advisor (sertificēts nodokļu konsultants)". This file is not.
- A binding interpretation under PVN-likums or Directive 2006/112/EC. The Custom Gem's analysis is internally consistent and aligned with the cited articles, but it cannot bind a regulator.

### Deferred follow-up (not blocking the May 2026 backfill)

1. **Obtain one-line co-sign from STG's external accountant** (Latvia certified tax advisor) confirming the Custom Gem's classification. Once received, file as `docs/legal_audit/accountant-swedbank-gateway-vat-confirmation.md` and update the journal entry's `vat_classification_basis_ref` payload field to point at the new file. **This advisory file remains at its current path as the historical record of the original classification reasoning** — do not overwrite or rename.
2. Add the follow-up to `legal_deferred_work.md` (in the `~/.claude/projects/` memory tree, not in-repo) so the next pass through deferred work picks it up.

### What this unblocks

- Plan **Task A** (May 2026 backfill, invoice V0000891330) is satisfied for path-2 execution.
- Plan **Task 5 Gate 2**'s VAT-classification requirement is met by this advisory artifact; the human-accountant sign-off becomes deferred follow-up rather than a Task 5 blocker.

### Cross-references

- Plan: `~/.claude/plans/just-got-another-fees-refactored-pony.md` (Task A + Gate 2)
- Precedent format: [accountant-vat-confirmation.md](accountant-vat-confirmation.md) (different VAT question, structurally similar audit artifact, signed by a licensed advisor)
- Routing discriminator documentation: to be added to CLAUDE.md in the same docs-only follow-up PR that reconciles the 18 → 29 type-catalog count (separate from this PR — flagged in plan §Follow-ups).
