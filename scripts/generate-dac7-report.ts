/**
 * CLI: Generate DAC7 annual reports.
 * Usage: npx tsx scripts/generate-dac7-report.ts --year 2026
 */

import { generateAnnualReports } from '../src/lib/dac7/report';
import { generateDpiXml } from '../src/lib/dac7/xml-generator';
import { writeFileSync, mkdirSync } from 'fs';

const args = process.argv.slice(2);
const yearIndex = args.indexOf('--year');
const year = yearIndex >= 0 ? parseInt(args[yearIndex + 1], 10) : new Date().getFullYear() - 1;

if (!year || year < 2024) {
  console.error('Usage: npx tsx scripts/generate-dac7-report.ts --year 2026');
  process.exit(1);
}

async function main() {
  console.log(`Generating DAC7 reports for ${year}...`);

  const result = await generateAnnualReports(year);

  console.log(`Complete: ${result.complete.length} sellers`);
  console.log(`Incomplete: ${result.incomplete.length} sellers`);

  if (result.incomplete.length > 0) {
    console.log('\nIncomplete sellers (missing data):');
    for (const entry of result.incomplete) {
      console.log(`  - ${entry.sellerName}: missing ${entry.missingFields.join(', ')}`);
    }
  }

  if (result.complete.length > 0) {
    const xml = generateDpiXml(
      result.complete.map((r) => r.reportData),
      year
    );

    mkdirSync('reports', { recursive: true });
    const filename = `reports/dac7-${year}.xml`;
    writeFileSync(filename, xml, 'utf-8');
    console.log(`\nXML written to ${filename}`);
  }
}

main().catch(console.error);
