import { describe, it, expect } from 'vitest';
import { PSD2_TRANSITIONAL_SUNSET } from './constants';

describe('PSD2_TRANSITIONAL_SUNSET', () => {
  it('is still within its sunset window — transitional Art. 3(b) wording in Terms §1 and Seller §2 must be replaced before this fails', () => {
    // When this assertion flips, the lawyer-drafted transitional wording ("We rely on
    // the Art. 3(b) exemption; if it is determined not to apply, we will restructure
    // through a licensed payment institution") is past its lawyer-approved window.
    //
    // Remediation when this fails:
    //   1. If EveryPay Option 1 (collecting-account through Maksekeskus) has completed
    //      scoping, rewrite Terms §1 and Seller §2 to describe the Option 1 architecture
    //      and delete this constant + test.
    //   2. If Option 1 scoping has not completed, schedule a lawyer redline for an
    //      extension or alternative framing. Do not silently extend this date.
    //
    // Do not bypass this test by bumping the constant without the corresponding
    // legal-text change — that defeats the tripwire purpose.
    expect(Date.now()).toBeLessThan(PSD2_TRANSITIONAL_SUNSET.getTime());
  });
});
