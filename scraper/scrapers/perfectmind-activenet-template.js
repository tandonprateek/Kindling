/**
 * Template for PerfectMind (Township of Langley: tol.perfectmind.com) and
 * ActiveNet (City of Langley, Surrey, many others: apm.activecommunities.com)
 * booking widgets.
 *
 * WHY THIS ONE IS HARDER THAN FVRL:
 * Both platforms render their program/course catalog client-side with
 * JavaScript inside an embedded widget (BookMe4BookingPages for PerfectMind,
 * ActiveNet_CategoryLanding for ActiveNet). A plain axios+cheerio fetch
 * returns an near-empty shell — you need a headless browser (Puppeteer) to
 * let the JS run before you can read the DOM. This makes it slower and more
 * fragile: the widget's internal class names are auto-generated and can
 * change on platform updates without notice.
 *
 * BEFORE RUNNING THIS FOR REAL:
 * 1. `npm install puppeteer`
 * 2. Open the target booking URL in a real browser, open DevTools > Network,
 *    filter to XHR/Fetch, and check whether the widget calls a JSON API
 *    under the hood (many PerfectMind widgets do, at paths like
 *    /Api/.../GetCourses or similar). If you find one, call that endpoint
 *    directly with axios instead of using Puppeteer — it's far more stable
 *    and much faster. Only fall back to full Puppeteer rendering if there's
 *    no such endpoint.
 * 3. If you do need Puppeteer, inspect the rendered DOM for the actual
 *    class/data-attribute names for course title, date, time, and price,
 *    and replace the placeholder selectors below.
 *
 * This file is a working *shape* for the scraper, not a drop-in solution —
 * treat the selectors as placeholders to verify, same caveat as fvrl.js
 * but more so, since this DOM is JS-generated and wasn't directly inspected.
 */

// const puppeteer = require('puppeteer'); // uncomment once installed

const TARGETS = [
  {
    platform: 'perfectmind',
    org: 'Township of Langley',
    region: 'fraser-valley',
    // Example booking page confirmed live — swap calendarId/widgetId per category as needed.
    url: 'https://tol.perfectmind.com/23784/Clients/BookMe4BookingPages/BookingCoursesPage?calendarId=d0679587-ca2e-4e4f-98a0-5b325d329dda&widgetId=df98a38c-79f7-42e3-9f36-173f79124113&embed=False'
  },
  {
    platform: 'activenet',
    org: 'City of Langley',
    region: 'fraser-valley',
    url: 'https://ca.apm.activecommunities.com/langleycityrecconnect/ActiveNet_CategoryLanding'
  }
];

async function scrapeWithPuppeteer(target) {
  /*
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 30000 });

  // PLACEHOLDER SELECTORS — verify against the real rendered DOM.
  const events = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.course-card, .activity-row'));
    return cards.map(card => ({
      title: card.querySelector('.course-title, .activity-name')?.textContent.trim(),
      dateText: card.querySelector('.course-date, .schedule')?.textContent.trim(),
      price: card.querySelector('.price, .fee')?.textContent.trim(),
    }));
  });

  await browser.close();
  return events;
  */

  console.warn(
    `[${target.platform}] Puppeteer scraping not yet wired up for ${target.org}. ` +
    `See file header for the recommended steps: check for a JSON API first.`
  );
  return [];
}

async function scrapeAll() {
  const results = [];
  for (const target of TARGETS) {
    const rawEvents = await scrapeWithPuppeteer(target);
    for (const e of rawEvents) {
      results.push({
        source: target.platform,
        title: e.title,
        location: target.org,
        regionLabel: `Fraser Valley — ${target.org}`,
        region: target.region,
        dateText: e.dateText || null,
        url: target.url,
        free: false,
        tag: e.price || 'See listing'
      });
    }
  }
  return results;
}

module.exports = { scrapeAll };

if (require.main === module) {
  scrapeAll().then(events => {
    console.log(`Found ${events.length} events`);
    console.log(JSON.stringify(events, null, 2));
  });
}
