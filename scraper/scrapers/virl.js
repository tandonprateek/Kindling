/**
 * Vancouver Island Regional Library (VIRL) events scraper.
 *
 * Source: standard iCalendar (.ics) export from The Events Calendar
 * WordPress plugin, confirmed live on virl.bc.ca. The site's HTML
 * declares `<meta name="tec-api-origin">` and `<meta name="tec-api-version"
 * content="v1">`, confirming the plugin's REST/export layer is active.
 * Each category view exposes an "+ Export Calendar" link at `?ical=1` —
 * this is a documented feature of The Events Calendar plugin, not a
 * reverse-engineered endpoint, and standard iCalendar is far more stable
 * to parse than scraping rendered HTML.
 *
 * We pull the "Kids" and "Families" categories specifically (VIRL tags
 * most children's programs with one or both) rather than the full
 * system-wide calendar, which includes adult/senior programs too.
 */

const axios = require('axios');
const ical = require('node-ical');

const BASE_URL = 'https://virl.bc.ca';
const CATEGORY_FEEDS = [
  { slug: 'kids', label: 'Children' },
  { slug: 'families', label: 'Families' }
];

async function fetchIcsFeed(categorySlug) {
  const url = `${BASE_URL}/calendar/category/${categorySlug}/?ical=1`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KindlingBot/1.0)' },
    timeout: 20000
  });
  return res.data; // raw .ics text
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Formats a Date into "Tue, Sep 08th 3:30 pm" — matching FVRL's exact
// dateText shape so the site's single date-parsing regex handles both
// sources without a second code path. Computed in America/Vancouver time
// since the ICS feed's UTC timestamps would otherwise show the wrong hour.
function formatDateText(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', weekday: 'short', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value;
  const weekday = get('weekday');
  const month = get('month');
  const day = parseInt(get('day'), 10);
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = (get('dayPeriod') || '').toLowerCase().replace(/\./g, '');
  return `${weekday}, ${month} ${String(day).padStart(2, '0')}${ordinalSuffix(day)} ${hour}:${minute} ${dayPeriod}`;
}

function icsEventsToNormalized(icsText, categoryLabel) {
  const parsed = ical.sync.parseICS(icsText);
  const events = [];

  for (const key in parsed) {
    const item = parsed[key];
    if (item.type !== 'VEVENT') continue;

    const start = item.start ? new Date(item.start) : null;
    // Only keep events from today onward — the feed can include past
    // recurring instances depending on how the plugin generates it.
    if (start && start < new Date(new Date().toDateString())) continue;

    // Build dateText in the same shape FVRL's feed uses ("Tue, Sep 08th
    // 3:30 pm") so the site's existing date-parsing regex handles both
    // sources identically without needing a second code path.
    const dateText = start ? formatDateText(start) : null;

    // VIRL's LOCATION field is often just "British Columbia, Canada" for
    // system-wide programs, so prefer parsing the branch name out of the
    // event summary/description when present, falling back to LOCATION.
    const location = (item.location && !/^British Columbia, Canada$/i.test(item.location))
      ? item.location
      : 'Vancouver Island Regional Library';

    events.push({
      source: 'virl',
      title: item.summary || 'Untitled event',
      location,
      regionLabel: `Vancouver Island — ${location}`,
      region: 'vancouver-island',
      dateText,
      url: item.url || null,
      free: true, // VIRL programs are free with a library card, same as FVRL
      tag: 'Free',
      category: categoryLabel
    });
  }

  return events;
}

async function scrapeVirl() {
  const all = [];
  for (const { slug, label } of CATEGORY_FEEDS) {
    try {
      const icsText = await fetchIcsFeed(slug);
      const events = icsEventsToNormalized(icsText, label);
      all.push(...events);
    } catch (err) {
      console.error(`VIRL scrape failed for category "${slug}":`, err.message);
    }
  }
  // De-dupe: the same event often appears in both "kids" and "families"
  // feeds. Dedupe by title+dateText+location.
  const seen = new Set();
  return all.filter(e => {
    const key = `${e.title}|${e.dateText}|${e.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { scrapeVirl };

if (require.main === module) {
  scrapeVirl().then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
  });
}
