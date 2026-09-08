/**
 * Runs every scraper, merges results into one normalized array, and writes
 * public/events.json — the file Sasquatch Weekends' website fetches.
 *
 * Usage: node merge.js
 * Schedule this daily (see README) so events.json stays fresh.
 */

const fs = require('fs');
const path = require('path');
const { scrapeFvrl } = require('./scrapers/fvrl');
const { scrapeVirl } = require('./scrapers/virl');
const { scrapeAll: scrapePerfectMindActiveNet } = require('./scrapers/perfectmind-activenet-template');

async function main() {
  console.log('Scraping FVRL...');
  const fvrlEvents = await scrapeFvrl({ maxPages: 3 });
  console.log(`  -> ${fvrlEvents.length} events`);

  console.log('Scraping VIRL...');
  const virlEvents = await scrapeVirl();
  console.log(`  -> ${virlEvents.length} events`);

  console.log('Scraping PerfectMind/ActiveNet...');
  const recEvents = await scrapePerfectMindActiveNet();
  console.log(`  -> ${recEvents.length} events`);

  const all = [...fvrlEvents, ...virlEvents, ...recEvents];

  // events.json is written directly into ../site so it sits next to
  // index.html — that's the folder GitHub Actions deploys to Pages.
  const outDir = path.join(__dirname, '..', 'site');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'events.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: all.length,
    events: all
  }, null, 2));

  console.log(`\nWrote ${all.length} total events to ${outPath}`);

  if (all.length === 0) {
    console.warn(
      '\nWARNING: zero events scraped. This usually means a source changed ' +
      'its markup. Check each scraper individually before trusting this file.'
    );
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Merge failed:', err);
  process.exitCode = 1;
});
