# TDC daily trivia bot: setup for an OpenClaw agent

These are step-by-step instructions for an OpenClaw agent installing the TDC daily-trivia
bot on its own machine. They are written to be followed in order. Report back to your
operator after each **Checkpoint**.

## What you're installing

Every day at **7:00 a.m. Eastern** the bot posts that day's trivia question to a WhatsApp
group as a single-choice **poll** (options A–D). At **8:00 p.m. Eastern** it posts the answer
as a text message. The questions come from a spreadsheet the operator maintains in Box. A
Cloudflare Worker reads it, and at post time `post.sh` fetches the finished message from:

```
https://tdcreboot.com/api/trivia/bot
```

The message is posted **exactly as the Worker returns it**:

- No AI model writes, edits, summarizes or "improves" it.
- When the Worker answers `NO_REPLY`, nothing is posted.
- When anything fails, nothing is posted.

That's why the schedule runs from the system (systemd or cron) calling `post.sh`, and **not**
from an OpenClaw cron job, which would route the message through an agent turn.

## Rules for the agent

1. **Post only to the test group** until your operator explicitly says to switch to the real
   group. The real group is the TDC brotherhood group, with real people in it.
2. **Never print, log, echo or commit the bot key.** Read it from the secrets manager.
3. **Don't change the message text**, and don't reply in the group to members' votes or
   messages about trivia.
4. **Don't overwrite existing OpenClaw config.** Merge settings in; if something is already
   configured differently, ask before changing it.
5. If a command or flag in this guide doesn't exist in the installed OpenClaw version, **stop
   and report** what `--help` says rather than guessing. The OpenClaw flags here come from
   unofficial copies of its docs.

## What you need from your operator

| Name | What it is | Where it comes from |
| --- | --- | --- |
| `TRIVIA_BOT_KEY` | Secret key for the Worker's bot endpoint | Operator's password manager → store it in your secrets manager. **Secret.** |
| `TRIVIA_TARGET` | WhatsApp group JID to post into, like `120363…@g.us` | The **test** group first (step 4). Not secret. |

The WhatsApp account OpenClaw is linked to must be a member of the target group, and must be
allowed to post there. A dedicated bot number is recommended over a personal one: automated
WhatsApp Web sessions aren't sanctioned by WhatsApp, and a number can be banned.

## 1. Get the code

```bash
git clone --branch preview https://github.com/link-ventures-lllp/tdc-experiment2.git
cd tdc-experiment2/bot
ls
# post.sh  SETUP.md  tdc-trivia@.service  tdc-trivia-question.timer
# tdc-trivia-answer.timer  env.example  openclaw-whatsapp.json5
```

The repo is public; no credentials are needed to clone it. Read `post.sh` before running it;
it's short.

## 2. Check the tools

```bash
command -v curl && command -v openclaw    # both required
openclaw message poll --help              # need: --channel, --target, --poll-question, --poll-option
openclaw message send --help              # need: --channel, --target, --message
openclaw channels status 2>/dev/null || openclaw channels --help
```

`post.sh` runs:

```
openclaw message poll --channel whatsapp --target <JID> --poll-question <text> --poll-option <A> … --poll-option <D>
openclaw message send --channel whatsapp --target <JID> --message <text>
```

If the installed flags differ, adjust only those two lines in `post.sh` and tell your operator
what you changed.

## 3. Make sure WhatsApp is linked

If OpenClaw already has a working WhatsApp channel, skip to step 4.

Otherwise:

1. Install the WhatsApp plugin if needed.
2. Run `openclaw channels login --channel whatsapp`. It shows a QR code.
3. Ask your operator to scan it on the bot phone: WhatsApp → Settings → **Linked devices** →
   **Link a device**. The QR code expires quickly, so show it right away.
4. Restart the gateway if the docs say to.

Optionally, merge `openclaw-whatsapp.json5` into the OpenClaw config so only listed admin
numbers can trigger the agent from WhatsApp. That stops members' poll votes and replies from
setting off AI responses in the group. Replace `+1ADMINNUMBER`, and merge rather than
overwrite.

## 4. Find the test group's JID

Your operator creates a **test group** with just themselves and the bot number in it.

1. Ask them to send any message in it.
2. Find its JID in OpenClaw's session or directory listing (for example
   `openclaw sessions list`). Group JIDs end in `@g.us`.
3. Confirm the group name with your operator before using the JID.

> **Checkpoint 1:** report the test group's name and JID, and the `--help` results from step 2.

## 5. Store the settings

The script reads `TRIVIA_TARGET` and `TRIVIA_BOT_KEY` from the environment, or falls back to
files in `/opt/tdc-trivia/`.

**Preferred: your secrets manager.** Put the code where the schedule can run it, and have the
secrets manager supply both values as environment variables when it runs:

```bash
sudo mkdir -p /opt/tdc-trivia
sudo cp post.sh /opt/tdc-trivia/post.sh
sudo chmod 755 /opt/tdc-trivia/post.sh
```

**Fallback: files.** Use this if the secrets manager can't inject environment variables into
a systemd or cron job. Write them as the user that runs the OpenClaw gateway:

```bash
# /opt/tdc-trivia/env         (chmod 600)
TRIVIA_TARGET=<test group JID>

# /opt/tdc-trivia/bot.key     (chmod 600) — the key only, no newline, written from the secrets manager
```

## 6. Test by hand, in the test group only

No real questions exist before **Oct 12, 2026**, so test with a fixed date. In test mode the
Worker returns that day's message immediately, starting with `[TEST]`.

```bash
# 1. Dry run: prints what would be sent and sends nothing
DRY_RUN=1 TRIVIA_TEST_DATE=2026-10-12 /opt/tdc-trivia/post.sh question

# 2. Send a test poll to the test group
TRIVIA_TEST_DATE=2026-10-12 /opt/tdc-trivia/post.sh question

# 3. Send a test answer
TRIVIA_TEST_DATE=2026-10-12 /opt/tdc-trivia/post.sh answer

# 4. Today, for real: should print "nothing to post" before Oct 12
/opt/tdc-trivia/post.sh question
```

(Run these with `TRIVIA_TARGET` and `TRIVIA_BOT_KEY` set by the secrets manager, or with the
files from step 5 in place.)

What the operator should see in the test group:

- **Poll:** "[TEST] ΘΔΧ Daily Trivia · Mon, Oct 12: In the 1964 rush book, what was the
  chapter's street address?" with options *A. 314 Memorial Drive*, *B. 84 Massachusetts
  Avenue*, *C. 528 Beacon Street*, *D. 372 Memorial Drive*, single choice.
- **Answer:** "[TEST] *ΘΔΧ Daily Trivia answer · Mon, Oct 12*" … "Answer: *A. 314 Memorial
  Drive*".

Failure checks, which should post **nothing**:

```bash
TRIVIA_BOT_KEY=wrong TRIVIA_TEST_DATE=2026-10-12 /opt/tdc-trivia/post.sh question   # exits non-zero (404)
TRIVIA_TEST_DATE=2026-10-11 /opt/tdc-trivia/post.sh question                         # "nothing to post"
```

> **Checkpoint 2:** report what was posted, and have your operator confirm the poll looks right
> on their phone.

## 7. Schedule it

Use **one** of these, run as the user that runs the OpenClaw gateway, so `openclaw message`
reaches the linked session.

**A. systemd (preferred on Linux).** The unit files are in this folder.

1. Set `User=` in `tdc-trivia@.service` to the gateway user.
2. If the secrets manager injects variables into systemd, wire them in, for example with
   `EnvironmentFile=` or a drop-in. Otherwise the step-5 files are used.

```bash
sudo cp tdc-trivia@.service tdc-trivia-question.timer tdc-trivia-answer.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tdc-trivia-question.timer tdc-trivia-answer.timer
systemctl list-timers 'tdc-trivia*'      # next runs at 07:00 and 20:00 America/New_York
```

**B. cron (no systemd).** An hourly job in `auto` mode posts the question during the 7 a.m.
Eastern hour and the answer during the 8 p.m. hour, and does nothing otherwise. It handles
daylight saving itself.

```
0 * * * *  /opt/tdc-trivia/post.sh auto >> /var/log/tdc-trivia.log 2>&1
```

(Wrap it so the secrets manager supplies the environment, or rely on the step-5 files.)

The schedule always posts **today's** question, never a test date. With `TRIVIA_TARGET`
still pointing at the test group, the first real post lands there on **Mon, Oct 12 at 7:00
a.m. Eastern**. That's a good full rehearsal.

> **Checkpoint 3:** report the scheduler used and the next two run times.

## 8. Go live (only when your operator says so)

Change `TRIVIA_TARGET` to the brotherhood group's JID, found the same way as in step 4. Then
confirm the group name with your operator before the next 7:00 a.m. run.

## Operating it

| Task | systemd | cron |
| --- | --- | --- |
| Run history | `journalctl -u 'tdc-trivia@*'` | `/var/log/tdc-trivia.log` |
| Next runs | `systemctl list-timers 'tdc-trivia*'` | `crontab -l` |
| Pause | `sudo systemctl stop tdc-trivia-question.timer tdc-trivia-answer.timer` | comment out the line |
| Post now, manually | `sudo systemctl start tdc-trivia@question` | `/opt/tdc-trivia/post.sh question` |

- If a run fails (network, wrong key, WhatsApp disconnected), nothing is posted and the run
  exits non-zero. The Worker never returns tomorrow's answer early: the answer only comes
  after 8 p.m. Eastern.
- If the instance was down at 7:00, systemd posts the poll when it comes back (same day only).
  Cron skips that day.
- If the WhatsApp link drops, re-run step 3. The bot phone needs to come online every so often
  to keep the linked session alive.
- Questions, dates and answers are edited in the Box spreadsheet, not here. Changes reach the
  Worker within 30 minutes. A day's question is frozen once it goes live at 7:00 a.m.
