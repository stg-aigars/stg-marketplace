/**
 * Moderation — Statement of Reasons (DSA Article 17)
 *
 * Sent when a moderation action restricts or removes content, or suspends a user account.
 * Must contain all six Art. 17(3)(a)-(f) elements:
 *
 *   (a) decision taken                → `decision`
 *   (b) facts and circumstances       → `factsAndCircumstances` (+ `noticeReceived`)
 *   (c) use of automated means        → `wasAutomated` (derive from audit_log.actor_type:
 *                                        'cron' | 'system' → automated;
 *                                        'user' → human — including staff users)
 *   (d) legal / terms basis           → `legalBasis`
 *   (e) scope and duration            → `scopeAndDuration`
 *   (f) redress options               → rendered inline; user has 30 days to dispute by
 *                                        replying to the email, plus ADR + court routes
 *                                        already covered in Terms §14
 *
 * The EU Commission DSA Transparency Database ingests these statements and checks for
 * completeness. Do not ship without all six fields populated.
 */

import { Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

type ModerationDecision =
  | 'content_removed'
  | 'content_restricted_visibility'
  | 'account_suspended'
  | 'account_terminated';

interface ModerationStatementOfReasonsProps {
  userName: string;
  decision: ModerationDecision;
  /** Short identifier shown to the user so they can locate the affected content. */
  contentIdentifier: string;
  /**
   * Plain-English summary of the facts and circumstances we relied on. Include whether the
   * decision was triggered by a notice under our Art. 16 notice-and-action process.
   */
  factsAndCircumstances: string;
  /** True if a user notice under Art. 16 was the trigger. */
  noticeReceived: boolean;
  /** Derived from audit_log.actor_type — true for 'cron' | 'system'. */
  wasAutomated: boolean;
  /**
   * Specific Terms provision, Seller Agreement provision, statutory instrument, or platform
   * rule the content violated. Be specific — "Section 10" or "prohibited content" is not
   * enough.
   */
  legalBasis: string;
  /**
   * e.g. "permanent removal of the listing" or "account suspended for 30 days starting
   * 2026-04-26" — Art. 17(3)(e) requires both scope and duration.
   */
  scopeAndDuration: string;
}

const DECISION_LABELS: Record<ModerationDecision, string> = {
  content_removed: 'removed',
  content_restricted_visibility: 'restricted the visibility of',
  account_suspended: 'suspended the account associated with',
  account_terminated: 'terminated the account associated with',
};

export function ModerationStatementOfReasons({
  userName,
  decision,
  contentIdentifier,
  factsAndCircumstances,
  noticeReceived,
  wasAutomated,
  legalBasis,
  scopeAndDuration,
}: ModerationStatementOfReasonsProps) {
  const decisionVerb = DECISION_LABELS[decision];

  return (
    <EmailLayout preview="Moderation decision — Second Turn Games">
      <Text style={s.greeting}>Hi {userName},</Text>

      <Text style={s.body}>
        We are writing to inform you of a moderation decision we have taken in relation to
        content you posted on Second Turn Games. This notice is provided in accordance with
        Article 17 of Regulation (EU) 2022/2065 (the Digital Services Act).
      </Text>

      <Text style={s.body}>
        <strong>Decision.</strong> We have {decisionVerb} {contentIdentifier}.
      </Text>

      <Text style={s.body}>
        <strong>Facts and circumstances we relied on.</strong> {factsAndCircumstances}{' '}
        {noticeReceived
          ? 'This decision was triggered by a notice we received under our notice-and-action process.'
          : 'This decision was identified through our own review, not a user notice.'}
      </Text>

      <Text style={s.body}>
        <strong>Use of automated means.</strong>{' '}
        {wasAutomated
          ? 'This decision was taken by an automated process (for example, a scheduled cron job enforcing a platform rule such as an auction payment deadline or shipping window).'
          : 'This decision was taken by a human reviewer. Automated tools may have assisted triage, but the decision itself was not automated.'}
      </Text>

      <Text style={s.body}>
        <strong>Legal or platform basis.</strong> {legalBasis}
      </Text>

      <Text style={s.body}>
        <strong>Scope and duration.</strong> {scopeAndDuration}
      </Text>

      <Text style={s.body}>
        <strong>Your right to redress.</strong> You may dispute this decision by replying to
        this email within 30 days. A different member of our team from the one who took the
        original decision will review your appeal. You also retain the right to pursue the
        matter through the consumer protection authority in your country of residence (listed
        in Section 15 of our Terms of Service) or through the courts.
      </Text>

      <Text style={s.note}>
        If you believe this message was sent to you in error, please reply and let us know.
      </Text>
    </EmailLayout>
  );
}

export default ModerationStatementOfReasons;
