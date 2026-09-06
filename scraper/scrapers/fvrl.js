/**
 * Fraser Valley Regional Library (FVRL) events scraper.
 *
 * Source: https://www.fvrl.bc.ca/events
 * Confirmed live: Drupal 10 site, server-rendered HTML (no JS rendering
 * needed), paginated with ?page=N. Each result links to /events/{id}.
 *
 * NOTE ON SELECTORS: these were built from the page's rendered text/link
 * structure, not from inspecting raw class names in a browser (I don't have
 * live browser access to this container). Before relying on this in
 * production, open the page in Chrome DevTools, inspect one event card,
 * and confirm/adjust the selectors marked "VERIFY" below. The pagination
 * and URL pattern are confirmed from the live page.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.fvrl.bc.ca';
const EVENTS_PATH = '/events';

// Libraries that fall in the Fraser Valley region for our site's filter.
// FVRL also serves some Metro Vancouver branches (Delta, Maple Ridge, etc.)
// — tag those to lower-mainland instead if you want a cleaner split.
const FRASER_VALLEY_BRANCHES = new Set([
  'abbotsford community library', 'aldergrove library', 'brookswood library',
  'chilliwack library', 'city of langley library', 'clearbrook library',
  'dean drysdale library', 'fort langley library', 'george mackie library',
  'hope library', 'mission library', 'mount lehman library',
  'murrayville library', 'sardis library', 'yarrow library',
  'agassiz library', 'terry fox library'
]);

async function fetchPage(pageNum) {
  const url = `${BASE_URL}${EVENTS_PATH}?page=${pageNum}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SasquatchWeekendsBot/1.0)' },
    timeout: 15000
  });
  return res.data;
}

function parseEventsFromHtml(html) {
  const $ = cheerio.load(html);
  const events = [];

  // VERIFY: each event result is a heading link to /events/{id}, followed
  // by a location link and a date/time text node in the same card wrapper.
  // Drupal "views" listings typically wrap each row in something like
  // .views-row — adjust the outer selector below if it doesn't match.
  $('a[href*="/events/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !/\/events\/\d+$/.test(href)) return; // skip nav/filter links

    const title = $el.text().trim();
    if (!title) return;

    // Walk up to the likely card container to find sibling location/date text.
    const $card = $el.closest('.views-row, article, .event-card, li').length
      ? $el.closest('.views-row, article, .event-card, li')
      : $el.parent().parent();

    const cardText = $card.text().replace(/\s+/g, ' ').trim();

    // Location: FVRL cards link to /locations/{slug} with the branch name as text.
    const locationLink = $card.find('a[href*="/locations/"]').first();
    const location = locationLink.text().trim() || null;

    // Date/time: appears as free text like "Sun, Sep 06th 1:00 pm to 4:30 pm".
    const dateMatch = cardText.match(
      /([A-Z][a-z]{2},\s[A-Z][a-z]{2}\s\d{1,2}(st|nd|rd|th)?\s\d{1,2}:\d{2}\s?[ap]m(\sto\s\d{1,2}:\d{2}\s?[ap]m)?)/
    );
    const dateText = dateMatch ? dateMatch[1] : null;

    const region = location && FRASER_VALLEY_BRANCHES.has(location.toLowerCase())
      ? 'fraser-valley'
      : 'lower-mainland';

    events.push({
      source: 'fvrl',
      title,
      location,
      regionLabel: location ? `Fraser Valley — ${location.replace(/ Library$/, '')}` : 'Fraser Valley Regional Library',
      region,
      dateText,
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      // FVRL programs are free with a library card — true for essentially all branch events.
      free: true,
      tag: 'Free'
    });
  });

  return events;
}

async function scrapeFvrl({ maxPages = 3 } = {}) {
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    try {
      const html = await fetchPage(page);
      const pageEvents = parseEventsFromHtml(html);
      if (pageEvents.length === 0) break; // ran out of pages
      all.push(...pageEvents);
    } catch (err) {
      console.error(`FVRL scrape failed on page ${page}:`, err.message);
      break;
    }
  }
  // De-dupe by event URL (same event can appear if pagination overlaps).
  const seen = new Set();
  return all.filter(e => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

module.exports = { scrapeFvrl };

// Allow running directly: node scrapers/fvrl.js
if (require.main === module) {
  scrapeFvrl({ maxPages: 2 }).then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
  });
}
