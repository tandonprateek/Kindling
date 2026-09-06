# Sasquatch Weekends — Go Live Guide

Everything here runs on GitHub's free tier: free hosting (GitHub Pages),
free automation (GitHub Actions, 2,000 free minutes/month — this uses
under a minute a day). No Netlify, no server, no credit card.

## One-time setup (about 5 minutes)

**1. Create the repo**
- Go to github.com → New repository
- Name it whatever you like, e.g. `sasquatch-weekends`
- Public or private both work — Public is simpler for free Pages hosting
- Don't initialize with a README (you're uploading files directly)

**2. Push these files to it**

From this folder, run:
```bash
cd sasquatch-weekends
git init
git add .
git commit -m "Initial site + scraper"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(If you've never used git from the command line before: install it from
git-scm.com, and GitHub will prompt you to sign in the first time you push.)

**3. Turn on GitHub Pages, powered by Actions**
- In your repo, go to **Settings → Pages**
- Under "Build and deployment" → **Source**, select **GitHub Actions**
  (not "Deploy from a branch" — that's the older method this workflow
  doesn't use)
- That's it. No further clicking needed after this.

**4. Trigger the first run**
- Go to the **Actions** tab in your repo
- Click **"Scrape events and deploy site"** in the left sidebar
- Click **Run workflow** → **Run workflow** (green button)
- Wait ~30-60 seconds, refresh — you'll see a green checkmark when done

**5. Find your live URL**
- Go to **Settings → Pages** again — your live URL is shown at the top,
  something like `https://YOUR_USERNAME.github.io/YOUR_REPO/`
- Open it. You should see live FVRL events (or a graceful "unavailable"
  message if that day's scrape hit an issue — check the Actions log)

## What happens automatically from here

Every day at 6 AM Pacific, GitHub will, with no action from you:
1. Run the scraper against FVRL (and any other source you've wired up)
2. Write a fresh `events.json`
3. Commit that file back to the repo
4. Redeploy the live site with the new data

You can also trigger it manually anytime from the Actions tab, or it'll
redeploy automatically whenever you push a change to `site/index.html`.

## Checking on it / troubleshooting

- **Actions tab** shows every run, past and scheduled, with full logs —
  if events look stale, check here first for a red X
- A run can fail at the scraping step (a site changed its markup) without
  taking the live site down — the workflow is built to redeploy with
  whatever the last good `events.json` was rather than break the page
- **`::warning::`** messages in a run's log mean the scrape came back
  empty that day — worth a look but not an emergency

## Adding a custom domain later (optional, still free-ish)

GitHub Pages supports a custom domain (e.g. `sasquatchweekends.ca`) if you
buy one from any registrar — add it under **Settings → Pages → Custom
domain**. The domain itself typically costs $10-15/year; GitHub's hosting
and SSL certificate for it stay free.

## Extending the scraper later

To add more regions (Vancouver Island, Okanagan, Northern BC), find each
region's library system and municipal rec platform, following the same
pattern as `scraper/scrapers/fvrl.js` — check if it's server-rendered
(easy) or a JS widget like PerfectMind/ActiveNet (needs the Puppeteer
approach outlined in `perfectmind-activenet-template.js`). Add each new
scraper's output into `merge.js`'s combined list.
