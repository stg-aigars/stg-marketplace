import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { getTerminals } = await import('../src/lib/services/unisend/client');
  const countries = ['EE', 'LV', 'LT'] as const;
  let total = 0;
  for (const c of countries) {
    const terminals = await getTerminals(c);
    console.log(`${c}: ${terminals.length}`);
    total += terminals.length;
  }
  console.log(`Total (EE+LV+LT): ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
