/**
 * Eventbrite scraper — BC family/kids events, by organizer.
 *
 * IMPORTANT CONTEXT (read before configuring):
 * Eventbrite killed its general public "search all events" API endpoint
 * (GET /v3/events/search/) back in February 2020 — there is no way to ask
 * the API "give me all family events in BC" the way we can with FVRL or
 * VIRL. What DOES still work, confirmed live and public, is:
 *
 *   GET https://www.eventbriteapi.com/v3/organizers/:organizer_id/events/
 *
 * This returns a specific organizer's own public events — no special
 * permission needed beyond a free personal API token, and no requirement
 * that you own or manage that organizer's account. So this scraper works
 * as a curated watchlist: you tell it which BC family-event organizers to
 * check, and it pulls their public listings daily.
 *
 * SETUP (one-time, free, ~5 minutes):
 * 1. Create a free Eventbrite account if you don't have one.
 * 2. Go to Account Settings -> Developer Links -> API Keys.
 * 3. Copy your "Private Token" (no approval wait, works immediately).
 * 4. Set it as an environment variable EVENTBRITE_TOKEN (locally in a
 *    .env file, or as a GitHub Actions secret — see the project README).
 *
 * FINDING ORGANIZER IDs (the part that needs your judgment, not code):
 * Browse eventbrite.ca, search for BC family/kids activity providers
 * (museums, kids' camps, children's theatre, science centres, etc.),
 * open their public organizer profile page, and look at the URL —
 * it's typically shaped like eventbrite.ca/o/some-name-12345678901,
 * where the trailing digits are the organizer ID. Add each one you want
 * to track to the ORGANIZERS list below. There's no shortcut for
 * discovering these automatically since the search API is gone — this
 * list only grows by you finding organizers manually, the same way any
 * event aggregator using Eventbrite's API has to.
 */

const axios = require('axios');

const EVENTBRITE_TOKEN = process.env.EVENTBRITE_TOKEN;

// Curated watchlist. Replace these placeholder IDs with real BC family/
// kids event organizers you've found — these three are illustrative
// placeholders only and will 404 or return nothing as-is.
const ORGANIZERS = [
  { id: 'REPLACE_WITH_REAL_ORGANIZER_ID', label: 'Example Museum', region: 'lower-mainland' },
  { id: 'REPLACE_WITH_REAL_ORGANIZER_ID', label: 'Example Kids Theatre', region: 'vancouver-island' },
  { id: 'REPLACE_WITH_REAL_ORGANIZER_ID', label: 'Example Science Centre', region: 'fraser-valley' }
];

// Extra keyword safety net: even a "family event" organizer sometimes
// posts adult-only listings (fundraisers, staff training, etc.). Keep
// events whose title/summary mentions family/kids language, but don't
// be so strict that we drop everything if an organizer's wording varies —
// this is a soft filter, not a hard requirement.
const FAMILY_KEYWORDS = /kids?|child|children|family|toddler|youth|teen|camp|storytime|playgroup/i;

async function fetchOrganizerEvents(organizerId) {
  if (!EVENTBRITE_TOKEN) {
    throw new Error('EVENTBRITE_TOKEN environment variable is not set — see file header for setup steps.');
  }
  const url = `https://www.eventbriteapi.com/v3/organizers/${organizerId}/events/`;
  const events = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${EVENTBRITE_TOKEN}` },
      params: { status: 'live', expand: 'venue', page },
      timeout: 15000
    });
    events.push(...(res.data.events || []));
    hasMore = res.data.pagination && res.data.pagination.has_more_items;
    page++;
    if (page > 5) break; // sanity cap, don't loop forever on a huge organizer
  }
  return events;
}

function normalizeEvent(raw, organizerMeta) {
  const start = raw.start && raw.start.local ? new Date(raw.start.local) : null;
  const title = raw.name && raw.name.text ? raw.name.text : 'Untitled event';
  const summary = raw.summary || '';
  const venueName = raw.venue && raw.venue.name ? raw.venue.name : organizerMeta.label;

  const dateText = start ? formatDateText(start) : null;
  const isFree = raw.is_free === true;

  return {
    source: 'eventbrite',
    title,
    location: venueName,
    regionLabel: `${regionDisplayName(organizerMeta.region)} — ${venueName}`,
    region: organizerMeta.region,
    dateText,
    url: raw.url || null,
    free: isFree,
    tag: isFree ? 'Free' : 'See listing',
    _matchesFamilyKeywords: FAMILY_KEYWORDS.test(title) || FAMILY_KEYWORDS.test(summary)
  };
}

function regionDisplayName(region) {
  const map = {
    'lower-mainland': 'Lower Mainland',
    'fraser-valley': 'Fraser Valley',
    'vancouver-island': 'Vancouver Island',
    'okanagan': 'Okanagan',
    'northern-bc': 'Northern BC'
  };
  return map[region] || region;
}

// Same dateText shape as fvrl.js/virl.js ("Tue, Sep 08th 3:30 pm") so the
// site's existing parsing regex works identically across all sources.
function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

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

async function scrapeEventbrite() {
  if (!EVENTBRITE_TOKEN) {
    console.warn('EVENTBRITE_TOKEN not set — skipping Eventbrite scrape entirely. See scrapers/eventbrite.js header for setup.');
    return [];
  }

  const placeholderIds = ORGANIZERS.filter(o => o.id.startsWith('REPLACE_WITH'));
  if (placeholderIds.length === ORGANIZERS.length) {
    console.warn('All organizer IDs in scrapers/eventbrite.js are still placeholders — skipping. Add real organizer IDs to enable this source.');
    return [];
  }

  const all = [];
  for (const organizer of ORGANIZERS) {
    if (organizer.id.startsWith('REPLACE_WITH')) continue;
    try {
      const rawEvents = await fetchOrganizerEvents(organizer.id);
      const normalized = rawEvents.map(e => normalizeEvent(e, organizer));
      const kept = normalized.filter(e => e._matchesFamilyKeywords);
      kept.forEach(e => delete e._matchesFamilyKeywords);
      all.push(...kept);
      console.log(`  Eventbrite [${organizer.label}]: ${rawEvents.length} events found, ${kept.length} matched family/kids keywords`);
    } catch (err) {
      console.error(`Eventbrite scrape failed for organizer "${organizer.label}" (${organizer.id}):`, err.message);
    }
  }
  return all;
}

module.exports = { scrapeEventbrite };

if (require.main === module) {
  scrapeEventbrite().then(events => {
    console.log(`Found ${events.length} events total`);
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
  });
}
