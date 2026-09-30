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

## Notes

- Single self-contained `index.html`; no build step, no dependencies. Drop it on GitHub Pages
  (Settings → Pages → deploy from `main` / root) or any static host.
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
