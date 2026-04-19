import type { Metadata } from 'next';
import {
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_EMAIL,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_PHONE,
  LEGAL_ENTITY_REG_NUMBER,
  LEGAL_ENTITY_VAT_NUMBER,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Imprint',
};

export default function ImprintPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Imprint
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p>
          This page identifies the operator of Second Turn Games as required by Article 5 of
          Directive 2000/31/EC (the E-Commerce Directive), Latvia Commercial Law §8,
          Lithuania&apos;s Law on Electronic Commerce, and Estonia&apos;s Information Society
          Services Act.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Operator
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="font-semibold text-semantic-text-heading">Company</dt>
            <dd>{LEGAL_ENTITY_NAME}</dd>

            <dt className="font-semibold text-semantic-text-heading">Registration number</dt>
            <dd>{LEGAL_ENTITY_REG_NUMBER}</dd>

            <dt className="font-semibold text-semantic-text-heading">VAT number</dt>
            <dd>{LEGAL_ENTITY_VAT_NUMBER}</dd>

            <dt className="font-semibold text-semantic-text-heading">Registered office</dt>
            <dd>{LEGAL_ENTITY_ADDRESS}</dd>

            <dt className="font-semibold text-semantic-text-heading">Commercial register</dt>
            <dd>Register of Enterprises of the Republic of Latvia (Uzņēmumu reģistrs)</dd>

            <dt className="font-semibold text-semantic-text-heading">Email</dt>
            <dd>
              <a href={`mailto:${LEGAL_ENTITY_EMAIL}`} className="link-brand">
                {LEGAL_ENTITY_EMAIL}
              </a>
            </dd>

            <dt className="font-semibold text-semantic-text-heading">Telephone</dt>
            <dd>{LEGAL_ENTITY_PHONE}</dd>
          </dl>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Supervisory and data-protection authorities
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="font-semibold text-semantic-text-heading">Consumer rights</dt>
            <dd>
              Consumer Rights Protection Centre (PTAC), Brīvības iela 55, Riga, LV-1010, Latvia
              &mdash;{' '}
              <a
                href="https://www.ptac.gov.lv"
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                ptac.gov.lv
              </a>
            </dd>

            <dt className="font-semibold text-semantic-text-heading">Data protection</dt>
            <dd>
              Data State Inspectorate (DVI), Elijas iela 17, Riga, LV-1050, Latvia &mdash;{' '}
              <a
                href="https://www.dvi.gov.lv"
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                dvi.gov.lv
              </a>
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
