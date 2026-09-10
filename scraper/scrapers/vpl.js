/**
 * Vancouver Public Library (VPL) events scraper.
 *
 * Source: https://vpl.bibliocommons.com/v2/events
 * Confirmed live: despite BiblioCommons being a React-driven catalogue
 * platform in general, this specific events listing page IS server-
 * rendered with full event content in the initial HTML — no headless
 * browser needed, unlike the PerfectMind/ActiveNet rec-centre platforms.
 *
 * VPL's full events list runs to 100+ pages (2,000+ events — everything
 * from seniors' film mornings to ESL classes), so instead of scraping
 * everything we query BiblioCommons' own audience filter, one request
 * per kid-relevant audience, using the taxonomy IDs BiblioCommons uses
 * internally:
 *   Babies                -> 53c940484246f6147c00000d
 *   Toddlers               -> 53c940484246f6147c00000e
 *   Preschool Age Children -> 53c940484246f6147c00000f
 *   School Age Children    -> 53c940484246f6147c000010
 * (There's also a "Family" audience tag visible on the filter sidebar,
 * but its taxonomy ID isn't exposed as a plain link the way the others
 * are — it's only usable by clicking the filter checkbox in a real
 * browser. The four IDs above already cover the practical "kids' events"
 * use case; add "Family" back in later if you find its ID via browser
 * devtools on the filter checkbox.)
 *
 * NOTE ON SELECTORS: as with fvrl.js, these are built from the page's
 * rendered text/link structure rather than inspected raw class names —
 * verify/adjust against the live DOM in a browser if VPL changes their
 * markup. The date/time regex is intentionally tolerant of a few
 * phrasing variations since BiblioCommons duplicates some date text for
 * screen-reader accessibility labels alongside the visible text.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://vpl.bibliocommons.com';
const EVENTS_PATH = '/v2/events';

const KID_AUDIENCES = [
  { id: '53c940484246f6147c00000d', label: 'Babies' },
  { id: '53c940484246f6147c00000e', label: 'Toddlers' },
  { id: '53c940484246f6147c00000f', label: 'Preschool Age Children' },
  { id: '53c940484246f6147c000010', label: 'School Age Children' }
];

async function fetchPage(audienceId, pageNum) {
  const url = `${BASE_URL}${EVENTS_PATH}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SproutlistBot/1.0)' },
    params: { audiences: audienceId, page: pageNum },
    timeout: 20000
  });
  return res.data;
}

function parseEventsFromHtml(html, audienceLabel) {
  const $ = cheerio.load(html);
  const events = [];

  // VERIFY: event detail links match /events/{24-32 char hex id}, distinct
  // from filter links like /v2/events?types=... which carry query strings.
  $('a[href*="/events/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !/\/events\/[0-9a-f]{16,32}$/i.test(href)) return;

    const title = $el.text().trim();
    if (!title || title.length > 200) return; // guard against accidentally matching a large wrapper link

    const $card = $el.closest('article, li, .event-row, div').length
      ? $el.closest('article, li, .event-row, div')
      : $el.parent();

    const cardText = $card.text().replace(/\s+/g, ' ').trim();

    // Matches phrasing like "Thursday, September 10 ... 2:00pm to 3:30pm"
    // tolerant of the accessibility-label duplication BiblioCommons emits.
    const dateMatch = cardText.match(
      /([A-Z][a-z]+),?\s([A-Z][a-z]+)\s(\d{1,2}).*?(\d{1,2}:\d{2}\s?[ap]m)\s?(?:to|–|-)?\s?(\d{1,2}:\d{2}\s?[ap]m)?/
    );

    let dateText = null;
    if (dateMatch) {
      const [, weekday, month, day, startTime] = dateMatch;
      dateText = `${weekday.slice(0, 3)}, ${month.slice(0, 3)} ${day.padStart(2, '0')}${ordinalSuffix(parseInt(day, 10))} ${startTime.replace(/\s/g, '')}`;
    }

    const locationMatch = cardText.match(/Event location:\s*([^,]+?)(?=\s{2,}|$)/) || cardText.match(/([A-Z][a-zA-Z\s]+Branch)Event location/);
    const isOnline = /Online event/i.test(cardText);
    const location = isOnline ? 'Online' : (locationMatch ? locationMatch[1].trim() : 'Vancouver Public Library');

    events.push({
      source: 'vpl',
      title,
      location,
      regionLabel: `Lower Mainland — ${location}`,
      region: 'lower-mainland',
      dateText,
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      free: true, // VPL programs are free with a library card, same convention as FVRL/VIRL
      tag: 'Free',
      audience: audienceLabel
    });
  });

  return events;
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

async function scrapeVpl({ maxPagesPerAudience = 3 } = {}) {
  const all = [];
  for (const audience of KID_AUDIENCES) {
    for (let page = 1; page <= maxPagesPerAudience; page++) {
      try {
        const html = await fetchPage(audience.id, page);
        const pageEvents = parseEventsFromHtml(html, audience.label);
        if (pageEvents.length === 0) break; // ran out of pages for this audience
        all.push(...pageEvents);
      } catch (err) {
        console.error(`VPL scrape failed for audience "${audience.label}" page ${page}:`, err.message);
        break;
      }
    }
  }
  // De-dupe: an event tagged both "Toddlers" and "Preschool Age Children"
  // shows up in both audience queries.
  const seen = new Set();
  return all.filter(e => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

module.exports = { scrapeVpl };

if (require.main === module) {
  scrapeVpl({ maxPagesPerAudience: 1 }).then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
  });
}
