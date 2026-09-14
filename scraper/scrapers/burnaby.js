/**
 * Burnaby Public Library (bpl.bc.ca) events scraper.
 *
 * WHY THIS APPROACH: bpl.bc.ca/events (the listing page) renders its
 * event list client-side with JavaScript — confirmed directly, the
 * server-rendered HTML is an identical empty shell on every page. BUT
 * individual event DETAIL pages (e.g. bpl.bc.ca/events/family-storytime-
 * march-21) turned out to be indexed with full real content — title,
 * time, address, description — meaning those pages likely ARE server-
 * rendered even though the listing isn't. That's a common pattern:
 * an interactive JS shell for browsing/filtering, but individually
 * linkable pages built for SEO.
 *
 * So instead of scraping the listing, this scraper:
 *   1. Fetches the site's sitemap (tries a couple of common locations)
 *   2. Filters it down to /events/{slug} URLs
 *   3. Fetches each event detail page and parses out the real fields
 *
 * NOTE ON RELIABILITY: this has NOT been verified against the raw live
 * HTML of a detail page (only against search-engine text snippets of
 * one), so the selectors/regex below are a best-effort first pass —
 * more so than fvrl.js or virl.js. Verify against a real detail page in
 * a browser and adjust before trusting this in production. If the
 * sitemap doesn't exist at either guessed location, this scraper logs a
 * clear warning and returns nothing rather than failing silently.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://bpl.bc.ca';
const SITEMAP_CANDIDATES = ['/sitemap.xml', '/sitemap_index.xml'];
const MAX_EVENTS = 60; // sanity cap so a huge sitemap doesn't trigger hundreds of requests

async function findEventUrls() {
  for (const path of SITEMAP_CANDIDATES) {
    try {
      const res = await axios.get(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SproutlistBot/1.0)' },
        timeout: 15000
      });
      const $ = cheerio.load(res.data, { xmlMode: true });
      const urls = [];
      $('loc').each((_, el) => {
        const url = $(el).text().trim();
        if (/\/events\/[a-z0-9-]+$/i.test(url) && !url.endsWith('/events')) {
          urls.push(url);
        }
      });
      if (urls.length > 0) return urls.slice(0, MAX_EVENTS);
    } catch (err) {
      // try the next candidate
    }
  }
  return null; // signals "no sitemap found at either guessed location"
}

async function scrapeEventDetail(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SproutlistBot/1.0)' },
    timeout: 15000
  });
  const $ = cheerio.load(res.data);
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();

  // Skip past events — BPL's detail pages show this exact phrase.
  if (/This event is in the past/i.test(pageText)) return null;

  let title = ($('h1').first().text() || $('title').text() || '').trim();
  title = title.replace(/\s*-\s*Burnaby Public Library\s*$/i, '').trim();
  if (!title) return null;

  // VERIFY: time shown like "11:30am · Duration: 30 minutes"
  const timeMatch = pageText.match(/(\d{1,2}:\d{2}\s?[ap]m)\s*·?\s*Duration/i);
  const time = timeMatch ? timeMatch[1] : null;

  // VERIFY: address shown like "7311 Kingsway Burnaby BC V5E 1G8" or a
  // named outdoor location like "Ernie Winch Park 7680 15th St Burnaby, BC" —
  // anchored to start right after the "Duration: N minutes" marker so it
  // doesn't greedily swallow preceding page text.
  const addressMatch = pageText.match(/Duration:\s*\d+\s*minutes\s*(.*?(?:Burnaby,?\s?BC)[A-Za-z0-9\s]*?)(?:\s[A-Z][a-z]+\s(?:Room|Branch)|$)/i);
  const location = addressMatch ? addressMatch[1].trim() : 'Burnaby Public Library';

  // VERIFY: description is the first substantial paragraph on the page —
  // best-effort since we don't have confirmed class names to target.
  const descEl = $('p').filter((_, el) => $(el).text().trim().length > 40).first();
  const desc = descEl.text().trim().slice(0, 300) || 'See the listing for full details.';

  // No confirmed way to extract a clean date from what we've seen so
  // far (search snippets didn't show one clearly) — leave null rather
  // than guess. The site's date-parsing regex handles a null dateText
  // gracefully by showing "—" instead of a day/date badge.
  const dateText = null;

  return {
    source: 'burnaby',
    title,
    location,
    city: 'Burnaby',
    regionLabel: `Burnaby — ${location}`,
    region: 'lower-mainland',
    dateText,
    url,
    free: true,
    tag: 'Free'
  };
}

async function scrapeAll() {
  const urls = await findEventUrls();
  if (urls === null) {
    console.warn(
      'Burnaby: no sitemap found at /sitemap.xml or /sitemap_index.xml. ' +
      'Check bpl.bc.ca for its actual sitemap location (view page source ' +
      'or check robots.txt) and update SITEMAP_CANDIDATES in this file.'
    );
    return [];
  }

  const events = [];
  for (const url of urls) {
    try {
      const event = await scrapeEventDetail(url);
      if (event) events.push(event);
    } catch (err) {
      console.error(`Burnaby: failed to scrape ${url}:`, err.message);
    }
  }
  return events;
}

module.exports = { scrapeAll };

if (require.main === module) {
  scrapeAll().then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
  });
}
