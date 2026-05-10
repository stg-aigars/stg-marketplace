/**
 * Custom ESLint rule: scripts-load-env-first
 *
 * Catches the env-load-order convention violation that bit PR #3's audit-write
 * path. Scripts that import from `@/lib/*` (or the relative-path equivalent
 * `../src/lib/*`) MUST import `./_load-env` first, so dotenv populates
 * `process.env` before `@/lib/env` evaluates and captures it.
 *
 * Scoping: enforced via `files: ['scripts/**\/*.ts']` in eslint.config.mjs.
 * The rule body is path-blind — it doesn't inspect `context.filename`.
 *
 * Initial level: warn. Escalate to 'error' once 2-3 PRs touching scripts/
 * land cleanly. See PR #4.5b carry-forward.
 */

const LOAD_ENV_PATTERN = /^\.\.?(\/\.\.)*\/_load-env$/;
const LIB_IMPORT_PATTERN = /^(@\/lib\/|(\.\.\/)+src\/lib\/)/;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Scripts that import from @/lib/* must import ./_load-env first to populate process.env before @/lib/env evaluates.',
    },
    schema: [],
    messages: {
      mustLoadEnvFirst:
        "Import from '{{source}}' must be preceded by `import './_load-env';`. ES module imports evaluate in source order, so the env loader must run before any module that captures process.env at load time. See CLAUDE.md \"Script env load order\".",
    },
  },
  create(context) {
    let loadEnvSeen = false;
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;
        if (LOAD_ENV_PATTERN.test(source)) {
          loadEnvSeen = true;
          return;
        }
        if (LIB_IMPORT_PATTERN.test(source) && !loadEnvSeen) {
          context.report({
            node,
            messageId: 'mustLoadEnvFirst',
            data: { source },
          });
        }
      },
    };
  },
};

export default rule;
