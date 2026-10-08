# tdc-experiment2 — "Re-charge the Charge" teaser site

A fork of `tdc-experiment1`, restructured into a **minimalist teaser site** whose job is to
drum up interest in contributing to the reboot of the TDC house.

Where experiment1 is a nine-scene interactive walkthrough with a pledge meter, this one is a
single quiet scrolling page with four parts:

1. **Hero + film** — the video carries the whole storyline; the copy around it just frames it.
2. **Updates** — a timeline, opening with the site going live and a link to the emailed letter
   (~Sept 21, 2026), followed by a "coming soon" roll-up of what gets published next.
3. **FAQ** — accordion, eleven questions, final approved copy: ownership, management, who's
   covering carrying costs, why the house is empty, the fall 2027 reopening goal, funding, and
   who to contact. Editable by non-developers from a Google Sheet — see **Letting others edit
   the FAQ** below.
4. **Interest form** — donations / volunteering / mentoring new startups / updates-only.
   It captures intent, not money. Checking **Mentoring new startups** reveals a panel asking
   for a LinkedIn URL, and tells mentors their resume/bio/deck is attached on the following
   Typeform screen, so those can be run through an AI summarizer to draft what each person
   could advise on.

   The copy states the intent to summarize and nothing more. An earlier draft also promised
   each mentor would see and correct that summary before it was used for an introduction —
   removed, because no part of this system does that. If you build a review step later, put
   the promise back; until then it would be a claim the site can't keep, made to people who
   are handing over a resume.

## Letting others edit the FAQ

The questions live in `index.html` and also work as the fallback, but pointing `FAQ_SHEET_CSV`
at a published Google Sheet lets anyone you share that sheet with rewrite the FAQ — no code,
no deploy, no GitHub account. The page reads the sheet on each load.

Setting it up once:

1. Make a new Google Sheet with two columns headed **Question** and **Answer**. To start from
   what's on the site today, import `faq-template.csv` from this repo (File → Import → Upload).
2. **File → Share → Publish to web** → choose the tab → **Comma-separated values (.csv)** →
   **Publish**. Copy the link it gives you.
3. Put that link in `FAQ_SHEET_CSV` at the top of the script in `index.html`. (Already wired
   to the live sheet — replace the URL only if the sheet moves.)
4. Share the sheet (normal Google sharing) with whoever should be able to edit the FAQ.

From then on, an edit in the sheet shows up on the site within a few minutes — Google caches
published output briefly.

How it fails, deliberately:

- Sheet deleted, unpublished, or unreachable → the built-in questions stay on screen. The FAQ
  is never empty.
- A row missing a question or an answer is skipped, so a half-written row can't blank anything.
- **Sheet text is inserted as text, never as markup.** A pasted `<script>` shows up as literal
  characters. The one exception is `[label](https://example.com)`, which becomes a real link —
  that way an editor can add links without being able to inject HTML. Line breaks are kept.

Publishing to the web makes the sheet's contents public to anyone with the link, which is fine
for FAQ copy — just don't keep anything private on that tab.

## Branding

Theta Delta Chi's black, white and blue, echoing the Theta Deuteron Charge crest imagery:

| Token | Value | Use |
| --- | --- | --- |
| `--black` | `#06080d` | page base |
| `--blue` | `#1b4fa0` | charge blue — borders, primary button |
| `--blue-bright` | `#4c86d9` | interactive accents, crest outline |
| `--blue-light` | `#9fc3f0` | eyebrows, small type |
| `--white` | `#f2f5fa` | body text |

Branding touches: an inline SVG shield crest carrying **ΘΔΧ** and a small bolt (reused in the
header and footer and as the favicon), an oversized ΘΔΧ watermark behind the hero, and one
"charge rule" divider with a pulse that travels along it. Headline face is Fraunces, with IBM
Plex Sans/Mono for body and labels.

### Link previews (unfurls)

`index.html` carries Open Graph and Twitter Card tags so pasted links unfurl with a photo of the
flag on the front of the house. The source photo is `images/TDC Flag_front of house.png`; the
two derived JPEGs it references by absolute URL are:

| File | Size | Used by |
| --- | --- | --- |
| `images/og-flag-1200x630.jpg` | 1200×630 | primary `og:image` and `twitter:image` (1.91:1, the standard card shape) |
| `images/og-flag-1200x1200.jpg` | 1200×1200 | second `og:image`, for platforms that prefer a square (WhatsApp, some chat apps) |

To swap the photo, regenerate both crops at the same dimensions and keep the filenames, or update
the `og:image` / `twitter:image` URLs. Most platforms cache the first unfurl they see, so after a
change re-scrape with the Facebook Sharing Debugger, LinkedIn Post Inspector, or by appending a
throwaway query string to the link.

### Analytics

`index.html` loads the Google Analytics 4 tag at the top of `<head>`. Measurement ID
`G-VLJWCH6WR1` (data stream 15892806857). Page views are collected automatically; nothing else
is instrumented yet.

## Before launch — what to set

Everything lives in one `CONFIG` block at the top of the `<script>` in `index.html`:

| Constant | What it does | Empty / default behavior |
| --- | --- | --- |
| `LETTER_URL` | Hosted copy of the emailed letter | "Read the letter" link hides itself |
| `WHATSAPP_URL` | Group invite behind both WhatsApp calls-to-action | both hide themselves, rather than shipping a dead button |
| `TYPEFORM_ID` | Short ID of the collecting Typeform — the code in `typeform.com/to/XXXXXXXX`, **not** the form's name | falls back to `MAILTO_FALLBACK` |
| `TYPEFORM_FIELDS` | Maps our field names to the Typeform's hidden-field names | already matches `setup/typeform-setup.mjs` |
| `MAILTO_FALLBACK` | Address that receives prefilled submissions if there's no Typeform | form shows a "not connected yet" notice |

## How the Typeform backend works

**Typeform has no API for submitting a response.** Its API creates and edits forms, reads and
deletes responses, and manages webhooks — but nothing writes a response. A response only exists
once a human completes the Typeform itself. Hidden-field prefill *displays* values; it does not
submit them, and Typeform cannot pre-answer a visible question. So a custom HTML form cannot
POST into Typeform, with or without a backend proxy.

What the page does instead:

1. The visitor fills in the form here. All validation and the conditional mentor panel run
   exactly as before — the page UI is untouched by the Typeform switch.
2. On submit, the page loads the Typeform embed SDK and opens the form **in a popup over the
   page**, passing every answer as a hidden field.
3. The visitor confirms — attaching files if they're a mentor — and that submission is what
   records the response. `onSubmit` fires, the page resets the form and shows its own
   confirmation line; closing without submitting says so rather than pretending it sent.

The handoff is foreshadowed so it isn't a surprise: a note under the submit button says one
screen follows, that the uploads on it are optional, and that pressing Submit there is what
files the answers. The Typeform repeats it — the welcome says the details came over from the
site with nothing to retype, and each upload is titled "1 of 2" / "2 of 2 … optional" and tells
visitors it doesn't apply to to press Skip. People were abandoning the handoff because two
upload screens appeared unannounced after they thought they had finished.

Details worth knowing:

- **The SDK is only fetched on first submit**, never on page view, so no third-party script
  runs for someone who just reads the page — the same rule the video player follows.
- **If the embed can't load** (blocked, offline, slow: 8s timeout) the page falls back to a
  full-page handoff to the same form with the same hidden fields, so the submission still
  lands. Both paths are exercised in the Chromium tests.
- **File uploads happen on the Typeform side**, which is why there's no in-page file picker:
  neither a URL nor a hidden field can carry a file. Typeform stores them, which also settles
  where resumes live.
- **Anyone who closes the popup without submitting is not recorded** anywhere — the page keeps
  no copy. Typeform's completion rate is the real conversion number. If Typeform's **partial
  submissions** setting is available on the account's plan, turning it on captures the hidden
  fields from people who start the handoff and abandon it — the only way to recover those
  names.
- **Styling inside the popup is Typeform's**, not this page's: it's a cross-origin iframe, so
  the site's CSS cannot reach in. The setup script creates a theme in the site palette
  (`#06080D` background, `#1B4FA0` buttons, `#F2F5FA` text) to keep it from looking like a
  stranger, and skips the theme rather than failing if the account rejects it.

Hidden fields, logic rules, file-upload questions and custom fonts each depend on the
Typeform plan — check yours covers them.

### Creating the Typeform

**The no-terminal way.** On GitHub: **Actions** tab → **Connect the form to Typeform** →
**Run workflow**. It reads `TYPEFORM_SECRET` from the repo secrets, creates the form with the
right hidden fields, writes the new ID into `index.html` and commits it. Leave the input blank
to create a form; paste an existing form's ID to reuse that one instead. The run summary prints
the form ID and a link.

**From a shell**, if you prefer:

```bash
TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs                      # create, prints the ID
TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs --write-index        # …and patch index.html
TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs --list               # list forms and IDs
TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs --form-id AbCd1234   # update that form
```

Hidden fields only work when declared on the form, which is why this is scripted rather than
hand-built: prefill silently drops any field the form hasn't declared.

The script builds one visible question — the optional file upload — behind a "One last step"
welcome screen. To hide that upload from non-mentors entirely, add a Logic rule on it in the
Typeform editor: skip when the hidden field `interest` does not contain `mentoring`. Left
alone, non-mentors just see an optional upload they can skip.

### About the token

The token is only ever used by that script, from a shell. **It must never go into
`index.html`** — this is a public repo serving a static site, so anything in that file is
readable by anyone, and a Typeform token can read and delete every response on the account.

A secret stored in **GitHub repository secrets is not available to a GitHub Pages site** either:
those are exposed only inside GitHub Actions runs, never to the browser. There is nothing the
page needs it for — the handoff URL is public by design, exactly like a Typeform link in an
email.

**The video** is a standard YouTube embed written into the markup — a plain `<iframe>` inside
`.video-frame` — so YouTube draws the film's own still frame and play button on load, and the
video works with JavaScript off:

```
https://www.youtube-nocookie.com/embed/got4YYzsbYg?rel=0&cc_load_policy=0&modestbranding=1
```

- `youtube-nocookie.com` is YouTube's privacy-enhanced host, and `loading="lazy"` defers the
  frame until it is near the viewport. The embed does load on page view, so YouTube sees each
  visitor — that is what showing the real thumbnail costs, and it is normal for a public
  marketing page. An earlier version loaded nothing until a click, which is stricter but has no
  thumbnail to show.
- Self-host instead by swapping the iframe for
  `<video src="media/film.mp4" poster="media/poster.jpg" controls playsinline></video>` — the
  frame's CSS already styles both.

**On captions:** `cc_load_policy=0` means "don't force captions on", and that is as far as the
YouTube player API goes. There is no parameter that forces captions *off* — a viewer whose own
YouTube account prefers captions still sees them, and nothing in this page can override that.
To guarantee no captions for anyone, unpublish the caption track in YouTube Studio.

## Daily trivia

A question goes up each morning at 7 a.m. Eastern and the answer at 8 p.m. It appears on the
site and is posted to the brotherhood WhatsApp group. Members answer in WhatsApp; the site only
shows the question and links to the group.

```
Excel file in Box ──(every 30 min)──▶ tdc-trivia Worker + KV ──▶ /api/trivia      ▶ site section
   (private)                         (holds the answer         └▶ /api/trivia/bot  ▶ OpenClaw on EC2
                                      until 8 p.m. ET)                                ▶ WhatsApp group
```

| Time (ET) | Site | WhatsApp |
| --- | --- | --- |
| midnight – 7 a.m. | section hidden | — |
| 7 a.m. – 8 p.m. | question with A–D, "Answer in WhatsApp" | bot posts the question |
| 8 p.m. – midnight | correct choice highlighted | bot posts the answer |

A day with no row in the spreadsheet shows nothing and posts nothing. If the Worker is down or
unreachable, the site is exactly what it was before trivia existed.

### The spreadsheet

`TDC_Rush_Book_Trivia_dbase1.xlsx` in Box (file ID `2513830681297`, kept by Román Cepeda),
one row per day:

| Date | Question | Correct answer | Incorrect answer 1 | Incorrect answer 2 | Incorrect answer 3 | Source file(s) |
| --- | --- | --- | --- | --- | --- | --- |
| 12-Oct-26 | In the 1964 rush book, what was the chapter's street address? | 314 Memorial Drive | 372 Memorial Drive | 528 Beacon Street | 84 Massachusetts Avenue | 1964 Rush Book |

- **The layout is flexible.** The Worker uses the first sheet with a *Question* header within
  its first 20 rows, so title rows, an empty first column, extra columns like *Source file(s)*,
  and other sheets like *Notes* are all fine. Headers are matched loosely: *Date* or
  *publish_date*, *Correct answer*, and *Incorrect answer 1–3* or *wrong_answer_1–3*.
- **Dates:** a date cell, or text like `12-Oct-26`, `2026-10-12` or `10/12/2026`. Row order
  doesn't matter.
- **The correct answer always goes in its own column.** The Worker shuffles the four choices
  in an order fixed for that date, so the site and the bot show the same A–D.
- **Today is locked at 7 a.m.** Later edits to a day that's already live are ignored, so
  nobody's answer ends up pointing at a different question. Edits to any other day apply at the
  next sync, within 30 minutes.
- Rows with no date, a missing answer, or a duplicate date are skipped and listed in the sync
  report (`/api/trivia/status`). If no row is valid, the previous schedule stays live.

### Box: giving the Worker its own login

The file stays private: no shared link. A Box Platform app gets a service account, and the
file is shared with that account like any other collaborator.

1. Box Developer Console → **Create Platform App** → Custom App → **Server Authentication
   (Client Credentials Grant)**. Name it "TDC Trivia Sync".
2. Configuration: App Access Level = **App Access Only**. Scopes: **Read all files and
   folders**. Save.
3. Authorization → **Review and Submit**. A Box admin approves it under Admin Console → Apps →
   Platform Apps Manager.
4. General Settings shows a service account address like `AutomationUser_…@boxdevedition.com`.
   Invite it to the Excel file as **Viewer**.
5. Collect the Client ID and Client Secret (Configuration), the Enterprise ID (General
   Settings), and the file ID (the number at the end of the file's Box URL).

### The Worker (`trivia-worker/`)

The same Worker runs the sync and serves the API. **Until launch it is only at
`https://tdc-trivia.link-ventures.workers.dev`**; nothing on tdcreboot.com reaches it. The
public endpoint sends CORS, so the preview site can read it from there.

**At launch:** uncomment the `routes` line in `trivia-worker/wrangler.toml` and run
`npm run deploy`, then set `TRIVIA_API` in `index.html` to `https://tdcreboot.com/api/trivia`
and `API` in `bot/post.sh` to `https://tdcreboot.com/api/trivia/bot`. If you're taking the
route back off later, delete it in the dashboard (zone → Workers Routes); removing it from
the config doesn't remove it from Cloudflare.

**Always pass `--config wrangler.toml`** (the npm scripts already do). Wrangler otherwise
picks up the site's `wrangler.jsonc` at the repo root, even from inside `trivia-worker/`, and
deploys *this checkout* over the production site. The configs pin the Link Ventures account,
since the Cloudflare login can see several.

```bash
cd trivia-worker
npm install
npx wrangler login
# KV namespace already created; its id is in wrangler.toml. Set BOX_FILE_ID there.
npx wrangler secret put BOX_CLIENT_ID      --config wrangler.toml
npx wrangler secret put BOX_CLIENT_SECRET  --config wrangler.toml
npx wrangler secret put BOX_ENTERPRISE_ID  --config wrangler.toml
npm run deploy
npm test                                        # parser, choice order, messages, DST
```

`ADMIN_KEY` and `BOT_KEY` are already set on the Worker; copies are in
`~/.config/tdc-trivia/keys.env` on the machine that deployed it.

| Path (on the Worker's host) | What it does |
| --- | --- |
| `/api/trivia` | public; today's question, plus `correctIndex` after 8 p.m. |
| `/api/trivia/bot?what=question\|answer` | bot only (`Authorization: Bearer BOT_KEY`); ready-to-post text or `NO_REPLY` |
| `/api/trivia/sync?key=ADMIN_KEY` | sync from Box now; returns the row count and skipped rows |
| `/api/trivia/status?key=ADMIN_KEY` | the last sync report |
| `/api/trivia/preview?key=ADMIN_KEY&date=2026-10-09` | any day's question with its answer |

Wrong or missing keys get a 404, and an unset secret never matches. Box secrets live only in
the Worker. They never go in `index.html` or the repo.

On the site, `TRIVIA_API` in the `CONFIG` block points at the Worker; set it to `''` to switch
trivia off. Add `?trivia=live` or `?trivia=revealed` to any page URL to see the section with a
sample question, no API needed.

### WhatsApp: OpenClaw on EC2 (`bot/`)

OpenClaw keeps a WhatsApp Web session for a dedicated bot number alive on the instance. Two
systemd timers run `bot/post.sh` at 7:00 and 20:00 Eastern. The script fetches the
finished message from the Worker and sends it with `openclaw message send`. It sends exactly
what the Worker returns, and no AI model is involved. `NO_REPLY` or any error means nothing is
sent.

Before you start:

- **This is still WhatsApp Web.** WhatsApp's terms don't sanction automated linked sessions.
  Two messages a day is low risk, but the number could be banned, so use a dedicated number,
  never anyone's personal one.
- **Keep the bot phone alive.** It needs to come online now and then or the linked session
  drops. Leave it charging on Wi-Fi.
- **The OpenClaw gateway must run as a service** that restarts with the instance.

Setup:

1. **Bot number.** A prepaid SIM in a spare phone, registered on WhatsApp as "TDC Trivia Bot".
   A group admin adds it to the brotherhood group (as admin, if only admins can post).
2. **Instance.** Ubuntu LTS, t3.small is plenty. Security group: SSH from your IP only; nothing
   inbound is needed.
3. **WhatsApp channel.** Install the OpenClaw WhatsApp plugin and merge
   `bot/openclaw-whatsapp.json5` into the OpenClaw config, putting the admins' numbers in place
   of `+1ADMINNUMBER`. Restart the gateway.
4. **Link the number.** `openclaw channels login --channel whatsapp` shows a QR code. On the
   bot phone, go to Settings → Linked devices → Link a device and scan it. The code expires
   quickly, so scan it straight from the SSH terminal.
5. **Group JID.** Post something in the group, then find the group's JID (it looks like
   `120363…@g.us`) in `openclaw sessions list`.
6. **Script.** Copy `bot/post.sh` to `/opt/tdc-trivia/`, put BOT_KEY in
   `/opt/tdc-trivia/bot.key`, and copy `bot/env.example` to `/opt/tdc-trivia/env` with a
   two-person **test** group's JID. `chmod 600` both, owned by the gateway user.
7. **Timers.** Copy `bot/tdc-trivia@.service` and both `.timer` files to
   `/etc/systemd/system/`, set `User=` in the service to the gateway user, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now tdc-trivia-question.timer tdc-trivia-answer.timer`.

Testing:

- `DRY_RUN=1 /opt/tdc-trivia/post.sh question` prints the message without sending.
- `sudo systemctl start tdc-trivia@question` sends it to the test group now. Before 8 p.m.,
  `tdc-trivia@answer` should send nothing.
- Then set `TRIVIA_TARGET` in `/opt/tdc-trivia/env` to the brotherhood group's JID.
- History: `journalctl -u 'tdc-trivia@*'`. Next runs: `systemctl list-timers 'tdc-trivia*'`.
  To pause, `sudo systemctl stop tdc-trivia-question.timer tdc-trivia-answer.timer`.

The OpenClaw CLI flags (`message send --target`, `channels login`, `sessions list`) come from
third-party copies of its docs and should be checked against `openclaw --help` on the instance.

## Renderings page

The concept-rendering gallery is unlisted: it lives at `/r/b7b51a4a7bf81a6d92bde972/`, a random path that nothing on
the site links to, and everything under `/r/` is sent with `noindex`. Drop the images into
`r/b7b51a4a7bf81a6d92bde972/` named `render-01.jpg` (16:9, shown full width) through `render-05.jpg` (4:3). A
missing file shows its slot label instead of a broken image.

**Unlisted is not private.** This repo and its fork are public on GitHub, so anyone browsing the
repo can see the path and any images committed here. For real privacy, put a Cloudflare Access
application on `tdcreboot.com/r/*` (allow specific emails, with a one-time PIN), or keep the
images out of git.

## Preview deployments (Cloudflare Pages)

`tdcreboot.com` is served by Cloudflare. Pages publishes every non-production branch to its own
URL, so trying a change means pushing a branch — production doesn't change until it merges to
`main`.

| URL | What it shows |
| --- | --- |
| `https://<hash>.<project>.pages.dev` | one exact commit; never changes, good for "look at this version" |
| `https://preview.<project>.pages.dev` | latest commit on the `preview` branch |
| `https://preview.tdcreboot.com` | same, on our own domain (optional, set up once below) |

**Git-connected project:** `git push origin preview` builds it. In the Pages project under
Settings → Builds → Branch control, preview deployments must be enabled for all branches or for
`preview`. Build command: none. Output directory: `/`.

**Direct-upload project** (no Git connection):
`npx wrangler pages deploy . --project-name <project> --branch preview`

**`preview.tdcreboot.com`, set up once:** Pages project → Custom domains → add
`preview.tdcreboot.com`. Then DNS → edit its CNAME so the target is
`preview.<project>.pages.dev`, **proxied** (orange cloud). If the record isn't proxied it serves
production.

**Keeping previews private:** Pages project → Settings → General → *Enable access policy*
locks the `*.pages.dev` preview URLs behind Cloudflare Access. `preview.tdcreboot.com` needs its
own Zero Trust → Access → Application for that hostname, for example allowing specific emails
with a one-time PIN. Without one of these, anyone with a preview link can open it.

What keeps a preview from interfering with production:

- **`_headers`** sends `X-Robots-Tag: noindex` on every `*.pages.dev` host and on
  `preview.tdcreboot.com`, so search engines don't index a preview. Production gets no extra
  header.
- **Analytics only loads on `tdcreboot.com` / `www.tdcreboot.com`**, so preview and local visits
  don't count in GA.
- The Typeform and the FAQ sheet are the **live** ones. A test submission from a preview shows up
  as a real response, so delete it in Typeform afterwards.
- Trivia reads production's Worker (`TRIVIA_API`). Before that Worker is deployed, the section
  stays hidden; use `?trivia=live` or `?trivia=revealed` to review it.
- `og:url` and `og:image` point at the production domain. A preview link pasted into a chat
  unfurls with production's card.

## Notes

- The site is still a self-contained `index.html` (plus `renderings.html`), with no build step
  and no dependencies. `trivia-worker/` deploys separately with Wrangler, and `bot/` goes on the
  EC2 instance. Neither is part of the static site.
- Verified rendering at 1280px and 390px, no horizontal overflow. Exercised in Chromium: form
  validation, the mentor panel's reveal/hide, the popup handoff (all six hidden fields arrive
  correctly encoded, including the normalized LinkedIn URL), submit vs. close-without-submit,
  the blocked-SDK fallback to a full-page handoff, and the no-Typeform notice.
- Honors `prefers-reduced-motion`, and a `<noscript>` rule keeps every section visible if
  JavaScript is off.
- A fixed **scroll cue** (bottom center) names the next section — Updates, FAQ, Get involved —
  and scrolls to it when clicked, so the tall dark bands don't read as the end of the page. It
  retires within 90px of the true bottom and inside the last section. Sections advertise their
  cue label via `data-cue`, so adding a section to the sequence means adding that attribute;
  the cue starts with class `gone` and is enabled by script, so it never appears empty.
- The FAQ carries real, load-bearing claims — House Corp.'s 1966 ownership, the 372 Management
  Co. arrangement, who is funding carrying costs, the fall 2027 target. That copy was supplied
  approved; treat any edit to it as a factual change, not a wording change.
- Two names appear with no contact details (Román Cepeda '97, Matt Rita '89, in the last
  question). Add emails or a link there so the closing answer is actionable.
- The only date on the page is the "September 2026" update entry, deliberately without a
  day so the site can be published any time that month.
