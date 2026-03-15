/**
 * BGG Game Type Classification
 *
 * BGG's search API incorrectly marks many expansions as type="boardgame".
 * The only reliable way to detect expansions is to check inbound/outbound links.
 */

import type { BGGGameMetadata } from './types';

export function isExpansion(metadata: BGGGameMetadata): boolean {
  if (metadata.type === 'boardgameexpansion') return true;

  const hasExpansionLinks = metadata.inboundLinks.some(
    (link) => link.type === 'boardgameexpansion' || link.type === 'boardgameintegration'
  );
  if (hasExpansionLinks) return true;

  return metadata.outboundLinks.some((link) => link.type === 'boardgameexpansion');
}

export function classifyGame(metadata: BGGGameMetadata): {
  type: 'base' | 'expansion' | 'standalone-expansion' | 'compilation';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  // Compilation
  if (
    metadata.type === 'boardgamecompilation' ||
    metadata.inboundLinks.some((link) => link.type === 'boardgamecompilation')
  ) {
    return { type: 'compilation', confidence: 'high', reason: 'Compilation of multiple games' };
  }

  // Standalone expansion (can be played without base game but expands another)
  const hasIntegrationLink = metadata.inboundLinks.some((l) => l.type === 'boardgameintegration');
  const hasExpansionLink = metadata.inboundLinks.some((l) => l.type === 'boardgameexpansion');
  if (hasIntegrationLink && hasExpansionLink) {
    return { type: 'standalone-expansion', confidence: 'high', reason: 'Standalone expansion' };
  }

  // Expansion
  if (isExpansion(metadata)) {
    const expansionLinks = metadata.inboundLinks.filter(
      (l) => l.type === 'boardgameexpansion' || l.type === 'boardgameintegration'
    );
    if (expansionLinks.length > 0) {
      return {
        type: 'expansion',
        confidence: 'high',
        reason: `Expands: ${expansionLinks.map((l) => l.value).join(', ')}`,
      };
    }
    return { type: 'expansion', confidence: 'medium', reason: 'Marked as expansion type' };
  }

  // Base game
  if (metadata.type === 'boardgame' && metadata.inboundLinks.length === 0) {
    return { type: 'base', confidence: 'high', reason: 'No expansion links found' };
  }

  return { type: 'base', confidence: 'medium', reason: 'Assumed to be base game' };
}
