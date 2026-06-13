// BGG integration barrel export
export { searchGames, getGameDetails, getGameVersions, fetchGameMetadata, fetchGameThumbnails, fetchBatchVersions, ensureGameMetadata, ensureGameVersions, ensureGameAccessories, getGameAccessories, extractAccessories } from './api';
export type { BGGGame, BGGVersion, BGGGameMetadata, BGGInboundLink, BGGAccessory, ManualVersion, VersionSelection } from './types';
export { isManualVersion } from './types';
export { classifyGame, isExpansion } from './classifier';
export { decodeHTMLEntities, decodeHTMLEntitiesArray, getLanguageInfo, getLanguageFlag, debounce } from './utils';
export { createBGGHeaders, BGG_CONFIG } from './config';
export { BGGError } from './errors';
