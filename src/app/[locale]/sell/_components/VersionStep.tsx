'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CheckCircle, ImageSquare, Buildings, Translate, CalendarBlank } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button, Input, Spinner, Alert } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { toBggFullSize } from '@/lib/bgg/utils';
import type { BGGVersion } from '@/lib/bgg/types';
import type { VersionData, VersionSource } from '@/lib/listings/types';
import type { EnrichedGame } from './GameSearchStep';

interface VersionStepProps {
  gameId: number;
  gameName: string;
  selectedGame?: EnrichedGame | null;
  onGameNameChange?: (name: string) => void;
  selectedVersionId: number | null;
  selectedVersionSource: VersionSource | null;
  /** Persisted version details for collapsed view (survives unmount/remount) */
  selectedPublisher?: string | null;
  selectedLanguage?: string | null;
  selectedEditionYear?: number | null;
  onSelect: (version: VersionData) => void;
  compact?: boolean;
}

const PRIORITY_LANGUAGES = ['English', 'Latvian', 'Lithuanian', 'Estonian', 'German'];

function getVersionLanguages(version: BGGVersion): string[] {
  return version.languages ?? (version.language ? [version.language] : []);
}

function filterChipClass(active: boolean): string {
  return `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-250 ease-out-custom ${
    active
      ? 'bg-semantic-brand/10 text-semantic-brand-active border border-semantic-brand'
      : 'bg-semantic-bg-surface text-semantic-text-secondary border border-semantic-border-subtle hover:border-semantic-border-default'
  }`;
}

export function VersionStep({
  gameId,
  gameName,
  selectedGame,
  onGameNameChange,
  selectedVersionId,
  selectedVersionSource,
  selectedPublisher,
  selectedLanguage,
  selectedEditionYear,
  onSelect,
  compact,
}: VersionStepProps) {
  const [versions, setVersions] = useState<BGGVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [collapsed, setCollapsed] = useState(selectedVersionSource !== null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [manualPublisher, setManualPublisher] = useState('');
  const [manualLanguage, setManualLanguage] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [yearError, setYearError] = useState<string | null>(null);

  const primaryGameName = selectedGame?.name ?? gameName;
  const alternateNames = selectedGame?.alternateNames ?? [];

  // Validate and collapse after selection
  const collapseWithValidation = () => {
    setCollapsed(true);
    // Ensure current game_name is valid for this game's names
    if (onGameNameChange && alternateNames.length > 0) {
      const validNames = [primaryGameName, ...alternateNames];
      if (!validNames.includes(gameName)) {
        onGameNameChange(primaryGameName);
      }
    }
  };

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
      version_thumbnail: toBggFullSize(version.image) ?? toBggFullSize(version.thumbnail) ?? null,
    });
    collapseWithValidation();
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
      version_thumbnail: null,
    });
    collapseWithValidation();
  };

  const isSelected = (versionId: number) =>
    selectedVersionSource === 'bgg' && selectedVersionId === versionId;

  const showLanguageFilter = uniqueLanguages.languages.length >= 2;

  // Collapsed view — show selected edition + alternate name selector
  const canShowCollapsed = collapsed && selectedVersionSource !== null &&
    (selectedVersionSource !== 'bgg' || selectedVersion !== null);

  if (canShowCollapsed) {
    return (
      <div className="space-y-4">
        {compact ? (
          <h2 className="text-base font-semibold text-semantic-text-heading">Edition</h2>
        ) : (
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Edition
          </h2>
        )}

        {/* Selected edition card */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              {selectedVersionSource === 'bgg' && selectedVersion ? (
                <>
                  {(selectedVersion.image ?? selectedVersion.thumbnail) ? (
                    <Image
                      src={(selectedVersion.image ?? selectedVersion.thumbnail)!}
                      alt={selectedVersion.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
                      <ImageSquare size={28} className="text-semantic-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-semantic-text-primary truncate">
                      {selectedVersion.name}
                    </p>
                    <VersionMeta version={selectedVersion} />
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-semantic-text-primary">
                    {selectedPublisher || selectedLanguage || selectedEditionYear
                      ? 'Custom edition'
                      : 'No specific edition'}
                  </p>
                  {(selectedPublisher || selectedLanguage || selectedEditionYear) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted mt-0.5">
                      {selectedPublisher && (
                        <span className="flex items-center gap-1">
                          <Buildings size={14} className="shrink-0" />
                          {selectedPublisher}
                        </span>
                      )}
                      {selectedLanguage && (
                        <span className="flex items-center gap-1">
                          <Translate size={14} className="shrink-0" />
                          {selectedLanguage}
                        </span>
                      )}
                      {selectedEditionYear && (
                        <span className="flex items-center gap-1">
                          <CalendarBlank size={14} className="shrink-0" />
                          {selectedEditionYear}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(false)}>
                Change
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Alternate name selector */}
        {alternateNames.length > 0 && onGameNameChange && (
          <AlternateNameSelector
            primaryName={primaryGameName}
            alternateNames={alternateNames}
            selectedName={gameName}
            onSelect={onGameNameChange}
          />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
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
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          Enter edition details
        </h2>
        <p className="text-sm text-semantic-text-secondary">
          Tell buyers about your specific edition of {primaryGameName}.
        </p>

        <div className="space-y-4">
          <Input
            label="Publisher"
            placeholder="e.g. Kosmos, Z-Man Games"
            value={manualPublisher}
            onChange={(e) => setManualPublisher(e.target.value)}
          />
          <Input
            label="Language *"
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
            disabled={!manualLanguage.trim()}
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
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Which edition?
          </h2>
          <p className="text-sm text-semantic-text-secondary">
            Select the edition that matches your copy of {primaryGameName}. This helps buyers know exactly what they are getting.
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
                {lang} ({uniqueLanguages.counts.get(lang)})
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

      <div className="pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowManual(true)}
        >
          My edition isn&apos;t listed
        </Button>
      </div>
    </div>
  );
}

// --- Version metadata (shared between VersionCard and collapsed view) ---

function VersionMeta({ version }: { version: BGGVersion }) {
  const publishers = version.publishers ?? (version.publisher ? [version.publisher] : []);
  const languages = version.languages ?? (version.language ? [version.language] : []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted mt-0.5">
      {publishers.length > 0 && (
        <span className="flex items-center gap-1">
          <Buildings size={14} className="shrink-0" />
          {publishers.join(', ')}
        </span>
      )}
      {languages.length > 0 && (
        <span className="flex items-center gap-1">
          <Translate size={14} className="shrink-0" />
          {languages.join(', ')}
        </span>
      )}
      {version.yearPublished && (
        <span className="flex items-center gap-1">
          <CalendarBlank size={14} className="shrink-0" />
          {version.yearPublished}
        </span>
      )}
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
  const thumbnail = version.image ?? version.thumbnail;

  return (
    <Card
      hoverable
      className={`cursor-pointer transition-all duration-350 ease-out-custom ${
        selected ? 'border-2 border-semantic-brand shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <CardBody className="py-3">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={version.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
              <ImageSquare size={28} className="text-semantic-text-muted" aria-hidden="true" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-semantic-text-primary">
              {version.name}
            </p>
            <VersionMeta version={version} />
          </div>
          {selected && (
            <CheckCircle size={20} weight="fill" className="text-semantic-brand shrink-0 mt-0.5" />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// --- Alternate name selector sub-component ---

/** Latin + Extended Latin: covers EN, LV, LT, ET, DE, PL, FI, FR, ES, IT, etc. */
const LATIN_RE = /^[\u0000-\u024F\u1E00-\u1EFF]/;

function isLatinScript(name: string): boolean {
  return LATIN_RE.test(name);
}

function AlternateNameSelector({
  primaryName,
  alternateNames,
  selectedName,
  onSelect,
}: {
  primaryName: string;
  alternateNames: string[];
  selectedName: string;
  onSelect: (name: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const allNames = useMemo(() => [primaryName, ...alternateNames], [primaryName, alternateNames]);
  const latinNames = useMemo(() => allNames.filter(isLatinScript), [allNames]);
  const nonLatinCount = allNames.length - latinNames.length;

  if (alternateNames.length === 0) return null;

  // If selected name is non-Latin, always show all
  const effectiveShowAll = showAll || (selectedName !== primaryName && !isLatinScript(selectedName));
  const visibleNames = effectiveShowAll ? allNames : latinNames;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-semantic-text-secondary">
        Name on the box
      </p>
      <div className="space-y-1.5">
        {visibleNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors duration-250 ease-out-custom ${
              selectedName === name
                ? 'border-semantic-brand bg-semantic-brand/5 text-semantic-text-primary font-medium'
                : 'border-semantic-border-subtle bg-semantic-bg-surface text-semantic-text-secondary hover:border-semantic-border-default'
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedName === name && (
                <CheckCircle size={16} weight="fill" className="text-semantic-brand shrink-0" />
              )}
              <span className="truncate">{name}</span>
              {name === primaryName && (
                <span className="text-xs text-semantic-text-muted ml-auto shrink-0">(primary)</span>
              )}
            </div>
          </button>
        ))}
      </div>
      {nonLatinCount > 0 && !effectiveShowAll && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
          Show all names ({allNames.length})
        </Button>
      )}
    </div>
  );
}
