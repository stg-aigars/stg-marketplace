import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';

import rule from './scripts-load-env-first.mjs';

// Wire RuleTester to Vitest's globals so each scenario surfaces as a separate
// test. Without this, RuleTester falls back to its default runner which
// doesn't integrate with Vitest's reporter.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

// Scoping note: the rule body is path-blind. ESLint config in eslint.config.mjs
// scopes the rule to scripts/**/*.ts via the `files` predicate. RuleTester
// runs the rule against every scenario regardless of filename, so we don't
// have a unit-level "rule doesn't apply outside scripts/" case here. The
// manual lint fixture step in the verification gate covers that.
ruleTester.run('scripts-load-env-first', rule, {
  valid: [
    // _load-env first, then alias-form lib import
    {
      code: "import './_load-env';\nimport { env } from '@/lib/env';",
      filename: 'scripts/example.ts',
    },
    // _load-env first, then relative-form lib import
    {
      code: "import './_load-env';\nimport { foo } from '../src/lib/services/account';",
      filename: 'scripts/example.ts',
    },
    // Only _load-env, no lib imports — trivially passes
    {
      code: "import './_load-env';",
      filename: 'scripts/example.ts',
    },
    // Only third-party imports, no lib imports and no _load-env
    {
      code: "import * as fs from 'fs';\nimport sharp from 'sharp';",
      filename: 'scripts/example.ts',
    },
  ],
  invalid: [
    // Alias-form lib import without _load-env
    {
      code: "import { env } from '@/lib/env';",
      filename: 'scripts/example.ts',
      errors: [{ messageId: 'mustLoadEnvFirst', data: { source: '@/lib/env' } }],
    },
    // Relative-form lib import without _load-env
    {
      code: "import { foo } from '../src/lib/services/account';",
      filename: 'scripts/example.ts',
      errors: [
        { messageId: 'mustLoadEnvFirst', data: { source: '../src/lib/services/account' } },
      ],
    },
    // _load-env appears AFTER the lib import — too late
    {
      code: "import { env } from '@/lib/env';\nimport './_load-env';",
      filename: 'scripts/example.ts',
      errors: [{ messageId: 'mustLoadEnvFirst', data: { source: '@/lib/env' } }],
    },
    // Multiple lib imports, no _load-env — rule reports each violation
    {
      code: "import { env } from '@/lib/env';\nimport { foo } from '@/lib/foo';",
      filename: 'scripts/example.ts',
      errors: [
        { messageId: 'mustLoadEnvFirst', data: { source: '@/lib/env' } },
        { messageId: 'mustLoadEnvFirst', data: { source: '@/lib/foo' } },
      ],
    },
  ],
});
