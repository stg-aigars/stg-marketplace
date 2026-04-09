const BROWSE_CONTEXT_KEY = 'stg:browse-context';

interface BrowseContext {
  ids: string[];
  searchParams: string;
}

/** Safely read browse context from sessionStorage. Returns null if missing or invalid. */
function readBrowseContext(): BrowseContext | null {
  try {
    const raw = sessionStorage.getItem(BROWSE_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ids) || typeof parsed.searchParams !== 'string') return null;
    return parsed as BrowseContext;
  } catch {
    return null;
  }
}

/** Write browse context to sessionStorage. */
function writeBrowseContext(context: BrowseContext): void {
  try {
    sessionStorage.setItem(BROWSE_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // sessionStorage may be unavailable (private browsing, storage full)
  }
}

export { readBrowseContext, writeBrowseContext };
export type { BrowseContext };
