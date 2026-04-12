import { formatDate } from '@/lib/date-utils';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
  LEGAL_ENTITY_VAT_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  LEGAL_ENTITY_IBAN,
} from '@/lib/constants';
import { PrintButton } from './PrintButton';

interface DocumentLayoutProps {
  title: string;
  documentNumber: string;
  date: string;
  recipient: React.ReactNode;
  children: React.ReactNode;
}

export function DocumentLayout({
  title,
  documentNumber,
  date,
  recipient,
  children,
}: DocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-semantic-bg-secondary py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 print:max-w-none print:px-0">
        <div className="rounded-xl border border-semantic-border-subtle bg-semantic-bg-primary p-6 shadow-sm sm:p-10 print:rounded-none print:border-none print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-semantic-text-heading">{LEGAL_ENTITY_NAME}</p>
              <p className="text-sm text-semantic-text-secondary">{LEGAL_ENTITY_ADDRESS}</p>
              <p className="text-sm text-semantic-text-secondary">
                Reg. {LEGAL_ENTITY_REG_NUMBER} / VAT {LEGAL_ENTITY_VAT_NUMBER}
              </p>
            </div>
            <PrintButton />
          </div>

          <div className="mt-8 border-b border-semantic-border-subtle pb-4">
            <h1 className="text-2xl font-bold text-semantic-text-heading">{title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-6 text-sm text-semantic-text-secondary">
              <span>No. {documentNumber}</span>
              <span>Date: {formatDate(date)}</span>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-semantic-text-secondary">
              Recipient
            </p>
            <div className="mt-1 text-sm text-semantic-text-primary">{recipient}</div>
          </div>

          <div className="mt-8">{children}</div>

          <div className="mt-12 border-t border-semantic-border-subtle pt-4 text-xs text-semantic-text-muted">
            <p>This document was generated electronically and is valid without a signature.</p>
            <p className="mt-1">
              {LEGAL_ENTITY_NAME} / {LEGAL_ENTITY_VAT_NUMBER} / {LEGAL_ENTITY_BANK_NAME} / {LEGAL_ENTITY_IBAN}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
