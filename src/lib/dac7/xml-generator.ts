/**
 * OECD DPI-DAC7 XML generator.
 * Generates XML conforming to the DPI schema for VID EDS submission.
 * At current scale, template literals are sufficient.
 */

import type { Dac7ReportData } from './types';
import { LEGAL_ENTITY_NAME, LEGAL_ENTITY_REG_NUMBER, LEGAL_ENTITY_ADDRESS } from '@/lib/constants';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Generate OECD DPI XML for a set of DAC7 reports.
 */
export function generateDpiXml(reports: Dac7ReportData[], year: number): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');
  const messageRefId = `STG-${year}-${Date.now()}`;

  const platform = reports[0]?.platform ?? {
    name: 'Second Turn Games',
    registered_name: LEGAL_ENTITY_NAME,
    registration_number: LEGAL_ENTITY_REG_NUMBER,
    address: LEGAL_ENTITY_ADDRESS,
    country: 'LV',
  };

  const sellerElements = reports.map((report, index) => `
    <ReportableSeller>
      <Identity>
        <IndividualSeller>
          <Standard>
            <Name>
              <NameFree>${escapeXml(report.seller.full_name)}</NameFree>
            </Name>
            <Address>
              <CountryCode>${escapeXml(report.seller.country)}</CountryCode>
              <AddressFree>${escapeXml(report.seller.address || report.seller.country)}</AddressFree>
            </Address>
            <TIN issuedBy="${escapeXml(report.seller.tax_country)}">${escapeXml(report.seller.tax_identification_number)}</TIN>
            <BirthDate>${escapeXml(report.seller.date_of_birth)}</BirthDate>
          </Standard>
        </IndividualSeller>
      </Identity>
      <FinancialIdentifier>
        <Identifier>${escapeXml(report.seller.iban)}</Identifier>
        <Type>IBAN</Type>
        <Country>${escapeXml(report.seller.country)}</Country>
      </FinancialIdentifier>
      <RelevantActivities>
        <ImmovableProperty>false</ImmovableProperty>
        <PersonalServices>false</PersonalServices>
        <SaleOfGoods>true</SaleOfGoods>
        <RentalOfTransport>false</RentalOfTransport>
      </RelevantActivities>
      <NumberOfActivities>${report.activity.completed_transaction_count}</NumberOfActivities>
      <Consideration>
        <ConsQ1>${centsToEuros(report.activity.consideration_by_quarter.q1_cents)}</ConsQ1>
        <ConsQ2>${centsToEuros(report.activity.consideration_by_quarter.q2_cents)}</ConsQ2>
        <ConsQ3>${centsToEuros(report.activity.consideration_by_quarter.q3_cents)}</ConsQ3>
        <ConsQ4>${centsToEuros(report.activity.consideration_by_quarter.q4_cents)}</ConsQ4>
      </Consideration>
      <Fees>
        <FeesQ1>${centsToEuros(report.activity.fees_by_quarter.q1_cents)}</FeesQ1>
        <FeesQ2>${centsToEuros(report.activity.fees_by_quarter.q2_cents)}</FeesQ2>
        <FeesQ3>${centsToEuros(report.activity.fees_by_quarter.q3_cents)}</FeesQ3>
        <FeesQ4>${centsToEuros(report.activity.fees_by_quarter.q4_cents)}</FeesQ4>
      </Fees>
      <DocRefId>STG-${year}-S${String(index + 1).padStart(4, '0')}</DocRefId>
    </ReportableSeller>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPI_OECD version="2.0"
  xmlns="urn:oecd:ties:dpi:v2"
  xmlns:stf="urn:oecd:ties:dpistf:v2">
  <MessageSpec>
    <SendingCompanyIN>${escapeXml(platform.registration_number)}</SendingCompanyIN>
    <TransmittingCountry>${escapeXml(platform.country)}</TransmittingCountry>
    <ReceivingCountry>${escapeXml(platform.country)}</ReceivingCountry>
    <MessageType>DPI</MessageType>
    <MessageRefId>${escapeXml(messageRefId)}</MessageRefId>
    <MessageTypeIndic>DPI401</MessageTypeIndic>
    <ReportingPeriod>${year}-12-31</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  <DPIBody>
    <PlatformOperator>
      <ResCountryCode>${escapeXml(platform.country)}</ResCountryCode>
      <TIN issuedBy="${escapeXml(platform.country)}">${escapeXml(platform.registration_number)}</TIN>
      <Name>${escapeXml(platform.registered_name)}</Name>
      <Address>
        <CountryCode>${escapeXml(platform.country)}</CountryCode>
        <AddressFree>${escapeXml(platform.address)}</AddressFree>
      </Address>
      <DocRefId>STG-${year}-PO001</DocRefId>
    </PlatformOperator>${sellerElements}
  </DPIBody>
</DPI_OECD>`;
}
