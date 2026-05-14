import { Alert } from '@/components/ui';
import {
  LEGAL_DISCLAIMER_MESSAGES,
  type LegalDocId,
  type LegalDocLang,
} from '@/lib/legal/constants';

interface TranslationDisclaimerNoticeProps {
  doc: LegalDocId;
  lang: Exclude<LegalDocLang, 'en'>;
}

/**
 * Info banner shown above the language switcher on translated legal
 * document pages (lv / lt / et). Asserts that the English version is
 * the legally binding (Terms / Seller) or authoritative (Privacy)
 * original, mirroring the §17 / §10 / §14 clause body inside each doc.
 *
 * Wording is keyed by both doc and language so the framing matches the
 * corresponding clause exactly. See LEGAL_DISCLAIMER_MESSAGES and
 * LEGAL_DISCLAIMER_CLAUSE_BRIDGE in constants.ts for the substring
 * contract enforced by language-clause.test.ts.
 */
export function TranslationDisclaimerNotice({
  doc,
  lang,
}: TranslationDisclaimerNoticeProps) {
  return (
    <Alert variant="info" className="mb-6">
      {LEGAL_DISCLAIMER_MESSAGES[doc][lang]}
    </Alert>
  );
}
