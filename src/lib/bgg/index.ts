// BGG integration barrel export
export { searchGames, getGameDetails, getGameVersions, fetchGameMetadata, ensureGameMetadata, ensureGameVersions } from './api';
export type { BGGGame, BGGVersion, BGGGameMetadata, BGGInboundLink, ManualVersion, VersionSelection } from './types';
export { isManualVersion } from './types';
export { classifyGame, isExpansion } from './classifier';
export { decodeHTMLEntities, decodeHTMLEntitiesArray, getLanguageInfo, getLanguageFlag, debounce } from './utils';
export { createBGGHeaders, BGG_CONFIG } from './config';
export { BGGError } from './errors';
