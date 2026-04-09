'use client';

import { useState } from 'react';
import { Button, Card, CardBody, Input, Select, Alert } from '@/components/ui';
import { isValidBalticTIN, isValidIBAN, cleanTIN, cleanIBAN } from '@/lib/dac7/validation';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import type { Dac7ProfileData } from '@/lib/dac7/types';

interface Dac7FormProps {
  dac7Profile: Dac7ProfileData | null;
}

export function Dac7Form({ dac7Profile }: Dac7FormProps) {
  const [dateOfBirth, setDateOfBirth] = useState(dac7Profile?.dac7_date_of_birth ?? '');
  const [taxId, setTaxId] = useState(dac7Profile?.dac7_tax_id ?? '');
  const [taxCountry, setTaxCountry] = useState(dac7Profile?.dac7_tax_country ?? '');
  const [address, setAddress] = useState(dac7Profile?.dac7_address ?? '');
  const [iban, setIban] = useState(dac7Profile?.iban ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasExistingIban = !!dac7Profile?.iban;
  const isEditing = dac7Profile?.dac7_status === 'data_provided';

  // Validation
  const tinError = taxId && taxCountry && !isValidBalticTIN(taxId, taxCountry)
    ? 'Invalid format for selected country'
    : null;
  const ibanError = iban && !isValidIBAN(iban)
    ? 'Invalid IBAN format'
    : null;

  const canSubmit =
    dateOfBirth.trim() &&
    taxId.trim() &&
    taxCountry.trim() &&
    address.trim() &&
    (hasExistingIban || iban.trim()) &&
    !tinError &&
    !ibanError &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch('/api/account/dac7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateOfBirth,
          taxId: cleanTIN(taxId),
          taxCountry,
          address: address.trim(),
          iban: hasExistingIban ? dac7Profile.iban : cleanIBAN(iban),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(sanitizeApiError(data.error));
        return;
      }

      setSuccess(true);
      // Reload page to show updated status
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
          {isEditing ? 'Update tax information' : 'Tax reporting information'}
        </h2>

        {success && (
          <Alert variant="success" className="mb-4">
            Tax information saved successfully.
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Date of birth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />

          <Select
            label="Country of tax residence"
            value={taxCountry}
            onChange={(e) => setTaxCountry(e.target.value)}
            placeholder="Select country"
            options={[
              { value: 'LV', label: 'Latvia' },
              { value: 'LT', label: 'Lithuania' },
              { value: 'EE', label: 'Estonia' },
              { value: 'DE', label: 'Germany' },
              { value: 'PL', label: 'Poland' },
              { value: 'FI', label: 'Finland' },
              { value: 'SE', label: 'Sweden' },
            ]}
            required
          />

          <Input
            label="Personal identification number (TIN)"
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            error={tinError ?? undefined}
            required
          />
          <p className="text-xs text-semantic-text-muted -mt-2">
            Your national personal code used for tax purposes
          </p>

          <Input
            label="Address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          {hasExistingIban ? (
            <div>
              <p className="text-sm font-medium text-semantic-text-heading mb-1">
                Bank account (IBAN)
              </p>
              <p className="text-sm text-semantic-text-muted">
                Using your IBAN on file: {dac7Profile.iban}
              </p>
            </div>
          ) : (
            <Input
            label="Bank account (IBAN)"
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            error={ibanError ?? undefined}
            required
          />
          )}

          <div className="rounded-lg bg-semantic-bg-secondary p-3 text-xs text-semantic-text-muted">
            This information will be shared with the State Revenue Service (VID)
            and may be exchanged with tax authorities in other EU member states,
            as required by EU Directive 2021/514 (DAC7). Data is retained for 5 years.
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            loading={loading}
          >
            {isEditing ? 'Update tax information' : 'Save tax information'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
