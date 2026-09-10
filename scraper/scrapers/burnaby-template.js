/**
 * Template for Burnaby Public Library (bpl.bc.ca/events).
 *
 * WHY THIS ONE IS A TEMPLATE, NOT A FINISHED SCRAPER:
 * Confirmed directly (fetched the live page, checked multiple ?page=N
 * variants) that bpl.bc.ca/events returns the exact same static page
 * shell every time — no event content anywhere in the server-rendered
 * HTML, unlike FVRL or even VPL's BiblioCommons pages. This matches
 * what BPL's own site-redesign case study describes: they built a
 * custom event registration system into Craft CMS (not the standard
 * BiblioCommons calendar most other BC libraries use), which appears to
 * render its event list client-side via JavaScript.
 *
 * BEFORE RUNNING THIS FOR REAL:
 * 1. Open bpl.bc.ca/events in a real browser with DevTools open on the
 *    Network tab, filtered to XHR/Fetch, and reload the page. Custom
 *    Craft CMS builds often call a JSON API under the hood (something
 *    like /api/events or a GraphQL endpoint) — if you find one, call it
 *    directly with axios instead of using Puppeteer below; it'll be far
 *    more stable and faster.
 * 2. Only fall back to full Puppeteer rendering if there's no such
 *    endpoint, following the same shape as
 *    scrapers/perfectmind-activenet-template.js.
 * 3. Whichever approach you use, inspect the real rendered DOM or API
 *    response for the actual field names and replace the placeholders
 *    below — nothing here has been verified against live data, unlike
 *    fvrl.js, virl.js, and vpl.js.
 */

// const puppeteer = require('puppeteer'); // uncomment once installed

const TARGET = {
  org: 'Burnaby Public Library',
  region: 'lower-mainland',
  url: 'https://bpl.bc.ca/events'
};

async function scrapeWithPuppeteer() {
  /*
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(TARGET.url, { waitUntil: 'networkidle2', timeout: 30000 });

  // PLACEHOLDER SELECTORS — verify against the real rendered DOM, this
  // has not been checked against live BPL markup at all.
  const events = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.event-card, .event-listing-item'));
    return cards.map(card => ({
      title: card.querySelector('.event-title')?.textContent.trim(),
      dateText: card.querySelector('.event-date')?.textContent.trim(),
      location: card.querySelector('.event-branch')?.textContent.trim(),
      url: card.querySelector('a')?.href,
    }));
  });

  await browser.close();
  return events;
  */

  console.warn(
    '[burnaby] Scraping not yet wired up — bpl.bc.ca/events renders its ' +
    'event list client-side with no confirmed public API. See file header ' +
    'for the recommended next steps (check DevTools Network tab for a ' +
    'hidden JSON API before reaching for Puppeteer).'
  );
  return [];
}

async function scrapeAll() {
  const rawEvents = await scrapeWithPuppeteer();
  return rawEvents.map(e => ({
    source: 'burnaby',
    title: e.title,
    location: e.location || TARGET.org,
    regionLabel: `Lower Mainland — ${e.location || TARGET.org}`,
    region: TARGET.region,
    dateText: e.dateText || null,
    url: e.url || TARGET.url,
    free: true,
    tag: 'Free'
  }));
}

module.exports = { scrapeAll };

if (require.main === module) {
  scrapeAll().then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events, null, 2));
  });
}
