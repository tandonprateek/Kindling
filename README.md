# Kindling — Go Live Guide (Netlify)

Free hosting on Netlify, free daily automation via GitHub Actions.
Netlify auto-deploys every time the repo changes — including the bot's
daily commit — so there's no separate "deploy" step to run yourself.

## One-time setup (~5 minutes)

**1. Create the GitHub repo and push these files**
```bash
cd sasquatch-weekends
git init
git add .
git commit -m "Initial site + scraper"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

**2. Connect the repo to Netlify**
- Go to [app.netlify.com](https://app.netlify.com) → sign up/log in (free)
- **Add new site → Import an existing project → Deploy with GitHub**
- Authorize Netlify to access your GitHub account, pick this repo
- Netlify auto-detects `netlify.toml` in this project, which already
  sets the publish folder to `site` — you shouldn't need to type
  anything into the build settings screen. Leave "Build command" blank.
- Click **Deploy site**

**3. Grab your URL / rename it**
- Netlify gives you a random URL like `chic-narwhal-123abc.netlify.app`
- To claim a nicer one: **Site settings → Change site name** →
  try `kindling-bc` or similar (site names are global on Netlify, so
  `kindling` alone may already be taken)

**4. Trigger the first scrape**
- In your GitHub repo, go to the **Actions** tab
- Click **"Scrape events (Netlify auto-deploys on push)"**
- Click **Run workflow** → **Run workflow**
- When it finishes (~30-60 sec), Netlify will detect the new commit
  and redeploy automatically — check the **Deploys** tab on Netlify to
  watch it happen

## What happens automatically from here

Every day at 6 AM Pacific:
1. GitHub Actions runs the scrapers (FVRL + VIRL currently live)
2. Writes a fresh `site/events.json`
3. Commits it to the repo — **that commit is what triggers Netlify**
4. Netlify picks up the push and redeploys within ~30 seconds

No login, no manual redeploy, no server to maintain.

## Checking on it

- **GitHub → Actions tab**: shows every scrape run and its logs
- **Netlify → Deploys tab**: shows every deploy, triggered by each commit
- If a day's events look stale, check Actions first — a red X there
  means the scrape (or commit) failed that day; Netlify simply won't
  have anything new to deploy until the next successful run

## What's live vs. still scaffolded

- **FVRL** (Fraser Valley Regional Library) — fully live, HTML scraper
- **VIRL** (Vancouver Island Regional Library) — fully live, uses the
  site's own iCalendar export (`?ical=1`), which is more stable than
  HTML scraping
- **Township/City of Langley rec programs** (PerfectMind/ActiveNet) —
  still a documented scaffold, not live yet. These platforms render
  their catalogs with JavaScript, so they need either a hidden JSON API
  (check first) or a headless-browser scraper (Puppeteer) — see the
  comments in `scraper/scrapers/perfectmind-activenet-template.js`.

## Adding more regions later

Okanagan and Northern BC aren't wired up yet. Same pattern as VIRL:
find the region's library system, check whether it runs The Events
Calendar (WordPress) with an `?ical=1` export, PerfectMind, ActiveNet,
or BiblioCommons, and add a new file under `scraper/scrapers/` following
whichever existing scraper matches that platform. Wire its output into
`scraper/merge.js`.

## Custom domain (optional)

Netlify supports a custom domain for free (you just pay the registrar,
~$10-15/year) — **Site settings → Domain management → Add a domain**.
