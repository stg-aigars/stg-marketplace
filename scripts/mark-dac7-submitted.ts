/**
 * CLI: Mark DAC7 reports as submitted to VID.
 * Usage: npx tsx scripts/mark-dac7-submitted.ts --year 2026
 */

import { markReportsSubmitted } from '../src/lib/dac7/report';

const args = process.argv.slice(2);
const yearIndex = args.indexOf('--year');
const year = yearIndex >= 0 ? parseInt(args[yearIndex + 1], 10) : 0;

if (!year || year < 2024) {
  console.error('Usage: npx tsx scripts/mark-dac7-submitted.ts --year 2026');
  process.exit(1);
}

async function main() {
  console.log(`Marking DAC7 reports for ${year} as submitted to VID...`);
  const marked = await markReportsSubmitted(year);
  console.log(`Marked ${marked} reports as submitted.`);
}

main().catch(console.error);
