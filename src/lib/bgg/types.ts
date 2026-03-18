// BGG type definitions

export interface BGGGame {
  id: number;
  name: string;
  yearPublished?: number;
  thumbnail?: string;
  image?: string;
  designers?: string[];
  playerCount?: string;
  minAge?: number;
  playingTime?: string;
  description?: string;
  rating?: number;
  isExpansion?: boolean;
  alternateNames?: string[];
}

export interface BGGVersion {
  id: number;
  name: string;
  publisher?: string;
  publishers?: string[];
  language?: string;
  languages?: string[];
  languageId?: number;
  languageIds?: number[];
  yearPublished?: number;
  productCode?: string;
  thumbnail?: string;
  image?: string;
}

export interface BGGInboundLink {
  id: string;
  type: string; // 'boardgameexpansion', 'boardgameintegration', 'boardgamecompilation', etc.
  value: string;
  inbound: boolean;
}

export interface BGGGameMetadata {
  id: number;
  name: string;
  type: string; // 'boardgame', 'boardgameexpansion', etc.
  yearPublished?: number;
  thumbnail?: string;
  image?: string;
  alternateNames?: string[];
  designers?: string[];
  playerCount?: string;
  minAge?: number;
  playingTime?: string;
  description?: string;
  rating?: number;
  bayesaverage?: number;
  weight?: number;
  categories?: string[];
  mechanics?: string[];
  inboundLinks: BGGInboundLink[];
  outboundLinks: BGGInboundLink[];
  versions?: BGGVersion[]; // Parsed from BGG API when &versions=1 is included
}

// Manual version input — used when BGG API is unavailable or version not found
export interface ManualVersion extends Omit<BGGVersion, 'id'> {
  id: 0;           // Sentinel value to identify manual versions
  isManual: true;   // Type discriminator
  name: string;
  publisher?: string;
  language?: string;
  yearPublished?: number;
  thumbnail?: string;
  image?: string;
}

// Union type for version selection (BGG or manual)
export type VersionSelection = BGGVersion | ManualVersion;

// Type guard
export function isManualVersion(version: VersionSelection | null): version is ManualVersion {
  return version !== null && 'isManual' in version && version.isManual === true;
}
