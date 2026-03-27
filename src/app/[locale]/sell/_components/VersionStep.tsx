'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CheckCircle, ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button, Input, Spinner, Alert } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { getLanguageFlag } from '@/lib/bgg/utils';
import type { BGGVersion } from '@/lib/bgg/types';
import type { VersionData, VersionSource } from '@/lib/listings/types';

interface VersionStepProps {
  gameId: number;
  gameName: string;
  selectedVersionId: number | null;
  selectedVersionSource: VersionSource | null;
  onSelect: (version: VersionData) => void;
  compact?: boolean;
}

const PRIORITY_LANGUAGES = ['English', 'Latvian', 'Lithuanian', 'Estonian', 'Russian', 'German'];

function getVersionLanguages(version: BGGVersion): string[] {
  return version.languages ?? (version.language ? [version.language] : []);
}

function filterChipClass(active: boolean): string {
  return `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-frost-ice/10 text-frost-arctic border border-frost-ice'
      : 'bg-semantic-bg-surface text-semantic-text-secondary border border-semantic-border-subtle hover:border-semantic-border-default'
  }`;
}

export function VersionStep({
  gameId,
  gameName,
  selectedVersionId,
  selectedVersionSource,
  onSelect,
  compact,
}: VersionStepProps) {
  const [versions, setVersions] = useState<BGGVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [manualPublisher, setManualPublisher] = useState('');
  const [manualLanguage, setManualLanguage] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [yearError, setYearError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiFetch(`/api/games/${gameId}/versions`);
        if (!res.ok) {
          if (!cancelled) {
            const data = await res.json().catch(() => null);
            setFetchError(data?.error || 'Could not load editions. You can enter version details manually.');
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setVersions(data.versions ?? []);
        }
      } catch {
        if (!cancelled) {
          setFetchError('Could not load editions. You can enter version details manually.');
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

  // Extract unique languages sorted: Baltic-priority first, then alphabetical
  const uniqueLanguages = useMemo(() => {
    const langCounts = new Map<string, number>();
    for (const v of versions) {
      for (const lang of getVersionLanguages(v)) {
        langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      }
    }

    const langs = Array.from(langCounts.keys());
    langs.sort((a, b) => {
      const aIdx = PRIORITY_LANGUAGES.indexOf(a);
      const bIdx = PRIORITY_LANGUAGES.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });

    return { languages: langs, counts: langCounts };
  }, [versions]);

  // Filter versions by selected language
  const filteredVersions = useMemo(() => {
    if (!languageFilter) return versions;
    return versions.filter((v) => getVersionLanguages(v).includes(languageFilter));
  }, [versions, languageFilter]);

  // Find the selected version if it's hidden by the current filter
  const selectedVersion = useMemo(() => {
    if (selectedVersionSource !== 'bgg' || selectedVersionId === null) return null;
    return versions.find((v) => v.id === selectedVersionId) ?? null;
  }, [versions, selectedVersionId, selectedVersionSource]);

  const selectedIsFiltered = selectedVersion !== null &&
    !filteredVersions.some((v) => v.id === selectedVersion.id);

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

  const showLanguageFilter = uniqueLanguages.languages.length >= 2;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
          Which edition?
        </h2>
        <div className="flex items-center justify-center py-8">
          <Spinner className="text-semantic-text-muted" />
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
      {compact ? (
        <h2 className="text-base font-semibold text-semantic-text-heading">Edition</h2>
      ) : (
        <>
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            Which edition?
          </h2>
          <p className="text-sm text-semantic-text-secondary">
            Select the edition that matches your copy of {gameName}. This helps buyers know exactly what they are getting.
          </p>
        </>
      )}

      {fetchError && (
        <Alert variant="warning">{fetchError}</Alert>
      )}

      {/* Language filter chips */}
      {showLanguageFilter && (
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLanguageFilter(null)}
              className={filterChipClass(languageFilter === null)}
            >
              All ({versions.length})
            </button>
            {uniqueLanguages.languages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguageFilter(lang === languageFilter ? null : lang)}
                className={filterChipClass(languageFilter === lang)}
              >
                {getLanguageFlag(lang)} {lang} ({uniqueLanguages.counts.get(lang)})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pinned selected card when hidden by filter */}
      {selectedIsFiltered && selectedVersion && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-semantic-text-muted uppercase tracking-wide">
            Your selection
          </p>
          <VersionCard
            version={selectedVersion}
            selected
            onClick={() => handleSelectBGGVersion(selectedVersion)}
          />
          <hr className="border-semantic-border-subtle" />
        </div>
      )}

      {versions.length > 0 ? (
        <div className="space-y-2">
          {filteredVersions.length > 0 ? (
            filteredVersions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                selected={isSelected(version.id)}
                onClick={() => handleSelectBGGVersion(version)}
              />
            ))
          ) : (
            <p className="text-sm text-semantic-text-muted text-center py-4">
              No editions found for this language.
            </p>
          )}
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

// --- Version card sub-component ---

function VersionCard({
  version,
  selected,
  onClick,
}: {
  version: BGGVersion;
  selected: boolean;
  onClick: () => void;
}) {
  const thumbnail = version.thumbnail ?? version.image;
  const lang = version.language ?? version.languages?.[0];

  return (
    <Card
      hoverable
      className={`cursor-pointer transition-all ${
        selected ? 'border-2 border-semantic-primary shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <CardBody className="py-3">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={version.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-semantic-bg-surface shrink-0 flex items-center justify-center">
              <ImageSquare size={24} className="text-semantic-text-muted" aria-hidden="true" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-semantic-text-primary">
              {version.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted mt-0.5">
              {(version.publisher || version.publishers?.[0]) && (
                <span>{version.publisher ?? version.publishers?.[0]}</span>
              )}
              {lang && (
                <span>{getLanguageFlag(lang)} {lang}</span>
              )}
              {version.yearPublished && (
                <span>{version.yearPublished}</span>
              )}
            </div>
          </div>
          {selected && (
            <CheckCircle size={20} weight="fill" className="text-semantic-primary shrink-0 mt-0.5" />
          )}
        </div>
      </CardBody>
    </Card>
  );
}
