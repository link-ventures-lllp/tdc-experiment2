#!/usr/bin/env node
/**
 * Creates (or updates) the Typeform that collects interest-form submissions,
 * with hidden fields whose names match TYPEFORM_FIELDS in index.html.
 *
 *   TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs
 *   TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs --form-id AbCd1234   # update in place
 *   TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs --list               # show your forms + IDs
 *
 * Why this exists: Typeform has no API for submitting a response, so index.html
 * validates the answers and hands off to this form with everything preloaded
 * into hidden fields. The respondent's confirmation on the last screen is what
 * actually writes the response. Hidden fields only work if they are declared on
 * the form itself — that is what this script sets up.
 *
 * The token is read from the environment and never written to disk. Keep it out
 * of index.html: anything in that file is public the moment the site deploys.
 */

import fs from 'node:fs';

const API = 'https://api.typeform.com';
const TOKEN = process.env.TYPEFORM_SECRET || process.env.TYPEFORM_TOKEN;

const HIDDEN_FIELDS = ['name', 'email', 'class_year', 'interest', 'linkedin', 'notes'];
const FORM_TITLE = 'Claude-TDC-Typeform';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * A theme in the site's palette, so the popup doesn't look like a stranger.
 * Typeform renders inside a cross-origin iframe, so this theme is the only way
 * to style those screens — page CSS cannot reach in.
 */
function themeDefinition() {
  return {
    name: 'Re-charge the Charge',
    font: 'Source Sans Pro',
    colors: {
      question: '#F2F5FA',
      answer: '#9FC3F0',
      button: '#1B4FA0',
      background: '#06080D',
    },
  };
}

/**
 * The form the popup lands on. Note that hidden fields prefill *data*, not
 * visible answer boxes — Typeform has no way to pre-answer a question — so this
 * form asks only for what the site cannot carry over: the uploaded files.
 */
function formDefinition(themeHref) {
  return {
    title: FORM_TITLE,
    type: 'form',
    theme: themeHref ? { href: themeHref } : undefined,
    settings: {
      is_public: true,
      show_progress_bar: false,
    },
    hidden: HIDDEN_FIELDS,
    welcome_screens: [
      {
        ref: 'welcome',
        title: 'Got it — one screen to go',
        properties: {
          description:
            "Your name, email and interests came over from the site, so there is nothing to retype. Next are two optional uploads: a resume, then old photos. Skip either, or both — then hit Submit and you're in.",
          show_button: true,
          button_text: 'Continue',
        },
      },
    ],
    fields: [
      {
        ref: 'materials',
        title: '1 of 2 · Resume, bio or deck — optional',
        type: 'file_upload',
        validations: { required: false },
        properties: {
          description:
            'For mentors, so we can tell founders what you could advise on. Not mentoring? Press Skip — it costs you nothing.',
        },
      },
      {
        ref: 'media',
        title: '2 of 2 · Photos, video or memorabilia — optional',
        type: 'file_upload',
        validations: { required: false },
        properties: {
          description:
            'Anything the brotherhood would want to see. Nothing to hand over right now? Press Skip, then Submit — that files everything from the site. Too big to upload? A share link in your notes works just as well.',
        },
      },
    ],
    thankyou_screens: [
      {
        ref: 'done',
        title: "You're on the list. We'll be in touch.",
        properties: {
          show_button: false,
          share_icons: false,
        },
      },
    ],
  };
}

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function main() {
  if (!TOKEN) {
    console.error(
      'Missing token. Run with:  TYPEFORM_SECRET=tfp_xxx node setup/typeform-setup.mjs\n' +
        'Create one at typeform.com → Settings → Personal tokens, with scopes forms:write and forms:read.'
    );
    process.exit(1);
  }

  if (arg('--list')) {
    const { items = [] } = await api('/forms?page_size=200');
    if (!items.length) return console.log('No forms on this account yet.');
    console.log('Your forms:\n');
    for (const f of items) console.log(`  ${f.id}   ${f.title}`);
    console.log('\nThe ID is what goes in TYPEFORM_ID in index.html.');
    return;
  }

  // The theme is a nicety — if the account or plan rejects it, carry on unthemed.
  let themeHref;
  try {
    const theme = await api('/themes', { method: 'POST', body: JSON.stringify(themeDefinition()) });
    themeHref = theme._links?.self || `${API}/themes/${theme.id}`;
    console.log(`Theme created: ${theme.name}`);
  } catch (err) {
    console.warn(`Theme skipped (${err.message.split('\n')[0]}) — set colors in the editor instead.`);
  }

  const definition = stripUndefined(formDefinition(themeHref));
  const formId = arg('--form-id');

  const form = formId
    ? await api(`/forms/${formId}`, { method: 'PUT', body: JSON.stringify(definition) })
    : await api('/forms', { method: 'POST', body: JSON.stringify(definition) });

  const id = form.id;
  const link = form._links?.display || `https://form.typeform.com/to/${id}`;

  console.log(`\n${formId ? 'Updated' : 'Created'}: ${form.title}`);
  console.log(`Form ID:  ${id}`);
  console.log(`Live at:  ${link}`);
  console.log(`Hidden fields: ${HIDDEN_FIELDS.join(', ')}`);
  // Hand the ID back to GitHub Actions so the workflow can report it
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `form_id=${id}\nform_link=${link}\n`);
  }

  if (arg('--write-index')) {
    const file = 'index.html';
    const html = fs.readFileSync(file, 'utf8');
    const pattern = /(const TYPEFORM_ID = ')[^']*(';)/;
    if (!pattern.test(html)) {
      console.error(`\nCould not find the TYPEFORM_ID line in ${file} — set it by hand.`);
      process.exit(1);
    }
    const updated = html.replace(pattern, `$1${id}$2`);
    if (updated === html) {
      console.log(`\n${file} already points at ${id} — nothing to change.`);
    } else {
      fs.writeFileSync(file, updated);
      console.log(`\nUpdated ${file}: TYPEFORM_ID = '${id}'`);
    }
    return;
  }

  console.log(`\nNext: set  const TYPEFORM_ID = '${id}';  in index.html, then commit.`);
  console.log('Test the prefill with:');
  console.log(`  ${link}?name=Test&email=test%40example.com&interest=mentoring`);
  console.log(
    '\nOptional, in the Typeform editor: add a Logic rule on "Resume, bio or deck"\n' +
      'so it is skipped when the hidden field `interest` does not contain "mentoring".\n' +
      'Without it, non-mentors simply see an optional upload they can skip.\n'
  );
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
