'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input } from '@/components/ui';
import type { BGGVersion } from '@/lib/bgg/types';
import type { VersionSource } from '@/lib/listings/types';

interface VersionData {
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
}

interface VersionStepProps {
  gameId: number;
  gameName: string;
  selectedVersionId: number | null;
  selectedVersionSource: VersionSource | null;
  onSelect: (version: VersionData) => void;
}

export function VersionStep({
  gameId,
  gameName,
  selectedVersionId,
  selectedVersionSource,
  onSelect,
}: VersionStepProps) {
  const [versions, setVersions] = useState<BGGVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualPublisher, setManualPublisher] = useState('');
  const [manualLanguage, setManualLanguage] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [yearError, setYearError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/${gameId}/versions`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setVersions(data.versions ?? []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const handleSelectBGGVersion = (version: BGGVersion) => {
    onSelect({
      version_source: 'bgg',
      bgg_version_id: version.id,
      version_name: version.name,
      publisher: version.publisher ?? version.publishers?.[0] ?? null,
      language: version.language ?? version.languages?.[0] ?? null,
      edition_year: version.yearPublished ?? null,
    });
  };

  const handleManualSubmit = () => {
    // Validate year if provided
    if (manualYear) {
      const parsedYear = parseInt(manualYear, 10);
      const maxYear = new Date().getFullYear() + 1;
      if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > maxYear) {
        setYearError(`Year must be between 1900 and ${maxYear}`);
        return;
      }
    }

    setYearError(null);
    onSelect({
      version_source: 'manual',
      bgg_version_id: null,
      version_name: null,
      publisher: manualPublisher || null,
      language: manualLanguage || null,
      edition_year: manualYear ? parseInt(manualYear, 10) : null,
    });
  };

  const handleSkip = () => {
    onSelect({
      version_source: 'manual',
      bgg_version_id: null,
      version_name: null,
      publisher: null,
      language: null,
      edition_year: null,
    });
  };

  const isSelected = (versionId: number) =>
    selectedVersionSource === 'bgg' && selectedVersionId === versionId;

  const isManualSelected =
    selectedVersionSource === 'manual' && selectedVersionId === null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
          Which edition?
        </h2>
        <div className="flex items-center justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-semantic-text-muted" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-2 text-sm text-semantic-text-muted">Loading editions...</span>
        </div>
      </div>
    );
  }

  if (showManual) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
          Enter edition details
        </h2>
        <p className="text-sm text-semantic-text-secondary">
          Tell buyers about your specific edition of {gameName}.
        </p>

        <div className="space-y-4">
          <Input
            label="Publisher"
            placeholder="e.g. Kosmos, Z-Man Games"
            value={manualPublisher}
            onChange={(e) => setManualPublisher(e.target.value)}
          />
          <Input
            label="Language"
            placeholder="e.g. English, Latvian, German"
            value={manualLanguage}
            onChange={(e) => setManualLanguage(e.target.value)}
          />
          <div>
            <Input
              label="Edition year"
              placeholder="e.g. 2019"
              type="number"
              inputMode="numeric"
              value={manualYear}
              onChange={(e) => {
                setManualYear(e.target.value);
                setYearError(null);
              }}
            />
            {yearError && (
              <p className="mt-1 text-sm text-semantic-error">{yearError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setShowManual(false)}>
            Back to list
          </Button>
          <Button
            variant="primary"
            onClick={handleManualSubmit}
            disabled={!manualPublisher && !manualLanguage && !manualYear}
          >
            Use this edition
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
        Which edition?
      </h2>
      <p className="text-sm text-semantic-text-secondary">
        Select the edition that matches your copy of {gameName}. This helps buyers know exactly what they are getting.
      </p>

      {versions.length > 0 ? (
        <div className="space-y-2">
          {versions.map((version) => (
            <Card
              key={version.id}
              hoverable
              className={`cursor-pointer transition-all ${
                isSelected(version.id)
                  ? 'border-2 border-semantic-primary shadow-md'
                  : ''
              }`}
              onClick={() => handleSelectBGGVersion(version)}
            >
              <CardBody className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-semantic-text-primary">
                      {version.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted mt-0.5">
                      {(version.publisher || version.publishers?.[0]) && (
                        <span>{version.publisher ?? version.publishers?.[0]}</span>
                      )}
                      {(version.language || version.languages?.[0]) && (
                        <span>{version.language ?? version.languages?.[0]}</span>
                      )}
                      {version.yearPublished && (
                        <span>{version.yearPublished}</span>
                      )}
                    </div>
                  </div>
                  {isSelected(version.id) && (
                    <svg className="w-5 h-5 text-semantic-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-semantic-text-muted text-center py-4">
          No editions found for this game.
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowManual(true)}
        >
          My edition isn&apos;t listed
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className={
            isManualSelected && !showManual
              ? 'text-semantic-primary font-medium'
              : 'text-semantic-text-muted'
          }
        >
          Skip this step
        </Button>
      </div>
    </div>
  );
}
