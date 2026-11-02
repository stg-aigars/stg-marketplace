import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for STG-MARKETPLACE-1W.
 *
 * In a `'use server'` module, the production (Turbopack) server-action
 * transform treats a type-only re-export like `export type { Foo };` as a
 * runtime export and registers `Foo` as a server reference. `Foo` doesn't
 * exist at runtime, so loading the module throws
 * `ReferenceError: Foo is not defined` — which breaks EVERY server action on
 * the page, before any action body runs. Dev mode and type-check don't catch
 * it.
 *
 * Import shared types from their source module (e.g. `@/lib/auth/types`)
 * instead of re-exporting them from the actions file. Inline type
 * declarations (`export type Foo = ...`) are erased correctly and are fine.
 */

const SRC = join(__dirname, '..');

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function isUseServerModule(source: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(source);
}

// `export type { A, B };` / `export type { A } from '...';` / `export { type A } from '...';`
const TYPE_REEXPORT = /^export\s+(?:type\s*\{|\{[^}]*\btype\s+\w)/m;

describe('use server modules', () => {
  it('never re-export types with `export type { ... }`', () => {
    const offenders = collectFiles(SRC)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return isUseServerModule(source) && TYPE_REEXPORT.test(source);
      })
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
