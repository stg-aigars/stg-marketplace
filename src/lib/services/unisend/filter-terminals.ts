import type { TerminalOption } from './types';

/** Case-insensitive search across name, address, and city. Empty query → all. */
export function filterTerminals(terminals: TerminalOption[], query: string): TerminalOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return terminals;
  return terminals.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q)
  );
}
