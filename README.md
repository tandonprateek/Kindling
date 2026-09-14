# Sproutlist — Go Live Guide

Free hosting (Netlify or Vercel — pick one, or run both), free daily
automation via GitHub Actions. Both hosts auto-deploy every time the
repo changes — including the bot's daily commit — so there's no
separate "deploy" step to run yourself.

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

**2. Connect the repo to a host — Netlify or Vercel**

### Option A: Netlify
- Go to [app.netlify.com](https://app.netlify.com) → sign up/log in (free)
- **Add new site → Import an existing project → Deploy with GitHub**
- Authorize Netlify to access your GitHub account, pick this repo
- Netlify auto-detects `netlify.toml` in this project, which already
  sets the publish folder to `site` — you shouldn't need to type
  anything into the build settings screen. Leave "Build command" blank.
- Click **Deploy site**
- Grab your URL (something like `chic-narwhal-123abc.netlify.app`), or
  claim a nicer one under **Site settings → Change site name**

### Option B: Vercel
- Go to [vercel.com](https://vercel.com) → sign up/log in (free)
- **Add New → Project → Import** your GitHub repo
- Vercel auto-detects `vercel.json` in this project, which already sets
  the output directory to `site` and skips the build step (it's a
  static site — no compiling needed). You shouldn't need to change
  anything on the configuration screen.
- Click **Deploy**
- Grab your URL (something like `your-repo.vercel.app`), or add a
  custom domain under **Project Settings → Domains**

Both hosts can run side-by-side off the same repo if you want a backup
or want to compare — there's no conflict; each just watches the repo
independently and redeploys on every push.

**3. Trigger the first scrape**
- In your GitHub repo, go to the **Actions** tab
- Click **"Scrape events (Netlify auto-deploys on push)"**
- Click **Run workflow** → **Run workflow**
- When it finishes (~30-60 sec), your host will detect the new commit
  and redeploy automatically — check its Deploys tab to watch it happen

## What happens automatically from here

Every day at 6 AM Pacific:
1. GitHub Actions runs the scrapers (FVRL, VIRL, VPL, Burnaby currently live)
2. Writes a fresh `site/events.json`
3. Commits it to the repo — **that commit is what triggers your host to redeploy**
4. Netlify/Vercel picks up the push and redeploys within ~30-60 seconds

No login, no manual redeploy, no server to maintain.

## Checking on it

- **GitHub → Actions tab**: shows every scrape run and its logs
- **Netlify → Deploys tab** or **Vercel → Deployments tab**: shows every
  deploy, triggered by each commit
- If a day's events look stale, check Actions first — a red X there
  means the scrape (or commit) failed that day; your host simply won't
  have anything new to deploy until the next successful run

## What's live vs. still scaffolded

- **FVRL** (Fraser Valley Regional Library) — fully live, HTML scraper
- **VIRL** (Vancouver Island Regional Library) — fully live, uses the
  site's own iCalendar export (`?ical=1`), which is more stable than
  HTML scraping
- **VPL** (Vancouver Public Library) — fully live, HTML scraper against
  BiblioCommons' server-rendered events page, filtered to kid-relevant
  audience tags
- **Burnaby Public Library** — live but less battle-tested than the
  others: the listing page is JavaScript-rendered so this scraper
  discovers event URLs via the site's sitemap and scrapes each detail
  page individually. Verify its output before fully trusting it — see
  the notes in `scraper/scrapers/burnaby.js`.
- **Township/City of Langley rec programs** (PerfectMind/ActiveNet) —
  still a documented scaffold, not live yet. These platforms render
  their catalogs with JavaScript, so they need either a hidden JSON API
  (check first) or a headless-browser scraper (Puppeteer) — see the
  comments in `scraper/scrapers/perfectmind-activenet-template.js`.

## Adding more regions later

Okanagan and Northern BC aren't wired up yet. Same pattern as VIRL or
VPL: find the region's library system, check whether it runs The Events
Calendar (WordPress) with an `?ical=1` export, is server-rendered
BiblioCommons, PerfectMind, or ActiveNet, and add a new file under
`scraper/scrapers/` following whichever existing scraper matches that
platform. Wire its output into `scraper/merge.js`.

## Custom domain (optional)

- **Netlify**: **Site settings → Domain management → Add a domain**
- **Vercel**: **Project Settings → Domains → Add**

Either way you just pay the domain registrar (~$10-15/year) — hosting
and SSL stay free.
