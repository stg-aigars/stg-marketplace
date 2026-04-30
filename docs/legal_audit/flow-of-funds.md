# Flow of Funds — Second Turn Games

**Audience:** Latvijas Banka (Bank of Latvia) regulatory engagement on PSD2 Article 3(b) commercial-agent exemption
**Date:** 2026-04-30
**Document owner:** Second Turn Games SIA, Reg. 50203665371

This document describes the end-to-end flow of customer funds on the Second Turn Games marketplace, in support of the platform's reliance on the Article 3(b) commercial-agent exemption of Directive (EU) 2015/2366 (PSD2). It is structured to answer the questions Latvijas Banka typically asks under that exemption analysis: who holds funds at each step, on whose behalf, for how long, and what guarantees exist that the platform is acting for one side of the transaction (the seller) rather than as a payment intermediary.

## Glossary

| Term | Meaning |
|---|---|
| **STG** | Second Turn Games SIA — the marketplace operator |
| **Buyer** | A consumer purchasing a board game on the platform |
| **Seller** | A private individual selling personal items on the platform |
| **EveryPay** | Maksekeskus AS, the Estonian-licensed payment institution providing payment services to STG |
| **Marketplace account** | The aggregated EveryPay account into which buyer payments settle, held in STG's name on behalf of sellers |
| **Wallet** | A per-seller balance ledger held on STG's database, denominated in EUR |
| **PSP** | Payment service provider |

## High-level diagram

```mermaid
sequenceDiagram
    autonumber
    participant Buyer
    participant STG as STG (commercial agent for the Seller)
    participant EveryPay as EveryPay (Maksekeskus AS — licensed PI)
    participant SellerWallet as Seller wallet (ledger entry)
    participant SellerIBAN as Seller's bank (IBAN payout)

    Buyer->>STG: 1. Places order, agrees to pay item + shipping
    STG->>EveryPay: 2. Initiate payment for buyer's full payable amount
    Buyer->>EveryPay: 3. Pays via card or bank-link (PSD2 SCA performed by EveryPay)
    EveryPay-->>STG: 4. Payment confirmed (callback)
    STG->>STG: 5. Order created in DB; buyer's funds settle to STG's marketplace account at EveryPay
    Note over EveryPay,STG: Funds held in STG's name<br/>at the licensed PI, on the<br/>seller's behalf as commercial agent.<br/>Not commingled with operating cash.

    alt Order completes (delivery confirmed, dispute window closed)
        STG->>SellerWallet: 6a. Credit seller's wallet (item price minus 10% commission)
        STG->>STG: 6b. Recognise commission as STG revenue (VAT-inclusive at seller's country rate)
        SellerWallet-->>Seller: 7a. Seller may request withdrawal at any time
        STG->>EveryPay: 7b. Withdrawal instruction
        EveryPay->>SellerIBAN: 7c. SEPA payout to seller's verified IBAN
    else Order is cancelled, refunded, or dispute resolved for buyer
        STG->>EveryPay: 6'. Refund instruction
        EveryPay->>Buyer: 7'. Refund issued to original payment method (card/bank-link)
    end
```

## Detailed walkthrough

### Step 1 — Order placement

The buyer selects an item and proceeds to checkout. STG presents the buyer with the total payable amount: item price + shipping cost. The 10% commission STG charges the seller is built into the displayed item price (the seller sets the price gross of commission); it is not a separate buyer-facing fee. The buyer accepts the Terms of Service and agrees to pay the seller through STG.

**Who is in contract with whom:** The sale-of-goods contract is between the buyer and the seller. STG is not a party to the sale. STG provides the platform, payment-collection, shipping, and dispute services to the seller as an electronically supplied service (Article 7 of Implementing Regulation (EU) 282/2011, place of supply Article 58).

### Step 2 — Payment initiation

STG, acting as the seller's commercial agent for the limited purpose of receiving payment, initiates a payment session at EveryPay. EveryPay is Maksekeskus AS, a licensed payment institution registered in Estonia (regulated by Finantsinspektsioon).

### Step 3 — Buyer authorisation

The buyer is redirected to EveryPay's hosted payment page where they choose card or bank-link (Swedbank-link, SEB-link, Luminor-link, Citadele-link) and complete strong customer authentication. SCA is performed by EveryPay, not STG; STG never touches card numbers, CVV, or bank-link credentials.

### Step 4 — Settlement to marketplace account

On successful authorisation, EveryPay confirms the payment to STG via webhook callback. The funds settle into STG's marketplace account at EveryPay. The marketplace account is held in STG's name but its purpose, as set out in STG's contractual relationship with each seller (the Seller Agreement, Section 2 "Payment authorisation"), is to receive funds on the seller's behalf as commercial agent.

**Key safeguards that support the Art. 3(b) reading:**
- STG does not commingle marketplace-account funds with its operating cash. The marketplace account is held at EveryPay, not at STG's general business bank.
- STG cannot use marketplace-account funds for its own operating expenses. Withdrawals from the marketplace account are restricted to (a) seller payouts, (b) buyer refunds, and (c) STG's own commission once recognised as revenue.
- The funds are subject to EveryPay's licensed-PI safeguarding obligations under Estonian implementation of PSD2 — they are protected from STG's insolvency by EveryPay's segregation rules, not by STG's own balance sheet.

### Step 5 — Order created

STG creates the order record in its database. The order carries the seller's country (snapshotted from the seller's profile) so that VAT calculation, OSS classification, and DAC7 accumulation use a stable per-order data point that does not float if the seller later updates their profile.

### Step 6a — Wallet credit (happy path)

When the order completes — buyer confirms delivery, no dispute opened within the 2-day dispute window, or dispute resolved in seller's favour — STG credits the seller's wallet ledger with the item price minus 10% commission. The wallet is a per-seller balance held in STG's database; it is not a separate bank account.

### Step 6b — Commission recognition

The 10% commission portion is recognised as STG revenue at this point. STG issues an electronic invoice to the seller for commission + shipping (the shipping is a pass-through service under Articles 49/50 of the VAT Directive). VAT is added at the seller's country rate (LV 21%, LT 21%, EE 24%) per the accountant memo of 2026-03-15.

The shipping line is invoiced because shipping is a logistics service STG provides to the seller (funded by the buyer at checkout but contractually owed by the seller to STG).

### Step 7 — Withdrawal to seller's IBAN

The seller may request a withdrawal of their wallet balance at any time. STG verifies the seller's identity and IBAN (KYC-light) before the first withdrawal. STG instructs EveryPay to make a SEPA payout to the seller's verified IBAN. Funds leave the marketplace account on STG's instruction acting as the seller's commercial agent.

### Refund / dispute path (Step 6' / 7')

If the order is cancelled, refunded, or a dispute is resolved for the buyer, STG instructs EveryPay to refund the buyer to the original payment method. The refund is a retraction of the seller's authority to receive the payment, not a payment STG itself owes the buyer.

For partial refunds (proportional reversal where one leg of the original split — card vs wallet — fails), STG records the actual refunded amount and surfaces a manual-reconciliation flag in the staff dashboard. The seller's wallet is debited by the refunded amount; if the wallet does not have a positive balance, the negative is carried forward against future sales (Seller Agreement Section 5).

## Why this fits Article 3(b)

The Article 3(b) commercial-agent exemption requires that the agent act for one side of the transaction with genuine authority to negotiate or conclude the sale. STG's position:

| EBA 2019 criterion | STG's posture |
|---|---|
| Acts for one side only | STG acts for the seller. The Seller Agreement explicitly designates STG as the seller's commercial agent for collection of payment (Section 2). Buyers are STG's counterparty for platform-service contracts (terms acceptance, dispute notification) but not for the underlying sale or for payment-receipt purposes. |
| Genuine authority to negotiate or conclude | STG has authority to set terms of the sale on the seller's behalf within the platform rules: dispute resolution, refund authorisation, cancellation of orders for non-shipment, suspension for fraud. The seller cannot transact except through STG's platform once they have accepted the Seller Agreement. |
| Funds received are received on behalf of one party | Funds settle to STG's marketplace account on the seller's behalf. Once the seller's wallet is credited, the funds become payable to the seller. STG's only own claim against the marketplace account is the 10% commission, and that claim is a contractual fee, not a payment intermediary's spread. |
| Not a multi-sided payment intermediary | STG does not aggregate buyer balances or seller balances in a way that allows arbitrary value transfer between users. Wallet credits flow only from completed orders; wallet debits flow only as withdrawal-to-IBAN or as refund-clawback against the same seller. |

## Areas the Bank of Latvia may probe

| Concern | STG's mitigation today | Direction we are open to |
|---|---|---|
| Multi-day holding of buyer funds during dispute window (up to 2 days post-delivery + 7 days dispute negotiation + staff escalation) | Funds are held at EveryPay (licensed PI) the whole time, not at STG. STG does not invest, lend, or otherwise put the funds to work; they sit in the marketplace account earning nothing for STG. | Move to a "split payment" model where EveryPay holds funds explicitly in escrow with named buyer / seller / STG as parties, removing the Art. 3(b) reading entirely. |
| Wallet ledger with seller-controlled withdrawal timing | The wallet is a record of amounts STG owes the seller, not a deposit account. There is no interest, no inter-user transfer, no debit-card-on-balance functionality. The user cannot use the wallet as a stored-value instrument. | Continue restricting wallet to "owed to seller, payout to verified IBAN only." If the Bank of Latvia views even this as stored-value-adjacent, we would migrate to a pull-based payout model where funds are not "held" pending the seller's withdrawal request but are pushed at order-completion. |
| Refund mechanics — STG instructs the refund | The refund is a retraction of the seller's authority. STG does not use its own funds to compensate the buyer; the refund flows from the marketplace account back through EveryPay to the original payment method. | We can add a contractual statement that refunds are issued in the seller's name as principal, with STG instructing only as agent. |
| Sunset of the transitional Art. 3(b) framing | Currently 2026-10-26 in the codebase — Vitest assertion fails after this date so CI blocks unawareness. | This regulatory engagement is the pre-cursor to either confirming Art. 3(b) holds (no change) or moving to Option B (deeper Maksekeskus integration in collecting-account / split-payment mode). |

## Decision points for the engagement

Bank of Latvia interactions on Art. 3(b) typically resolve to one of three outcomes:

1. **The exemption holds.** Bank of Latvia confirms STG's posture is within Art. 3(b) given the safeguards above. No structural change required. Document the confirmation, retire the transitional sunset language in the Seller Agreement.
2. **The exemption is borderline; restructure.** Bank of Latvia indicates the multi-day holding period or refund mechanics push the model out of Art. 3(b). STG migrates to a "collecting-account" model with EveryPay (Option 1 already scoped per the lawyer memo of 2026-04-26), where EveryPay holds funds explicitly on the seller's behalf with clear segregation. STG remains the platform; EveryPay handles the regulated leg.
3. **Neither — escrow only.** Bank of Latvia views the model as inherently a payment-intermediary one. STG partners with a marketplace-specialist PSP (Mangopay or Adyen-for-Platforms) operating in escrow / split-payment mode. Larger lift; 6–9 months of integration. Not the preferred direction unless 2 is also unavailable.

## Annexes available on request

- Seller Agreement (current version, 2026-04-30) showing Section 2 (Payment authorisation) and Section 5 (Wallet and payouts) in full.
- Audit-log schema showing the financial events captured per order (`order.refunded`, `payment.cart_completed`, `wallet.credit`/`debit`/`refund`/`withdrawal_requested`) under regulatory retention class.
- VAT memo from STG's accountant (2026-03-15) confirming the commission + shipping invoicing posture and Article 7 / 58 ESS treatment of the commission.
- DAC7 reporting infrastructure showing how STG identifies reportable sellers (statutory threshold: 30 sales or €2,000 in a calendar year) and the data points reported to the Latvian State Revenue Service.

---

**Suggested usage:** Send the entire document to the Latvijas Banka contact you reach out to, alongside a one-paragraph cover note describing STG and the specific question (i.e. "we currently rely on Article 3(b) of PSD2; we would value an informal indication of whether this remains supportable post-EBA-2019, or whether we should be planning a transition"). The Bank typically replies in writing within four to six weeks for informal queries.
