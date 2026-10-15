#!/bin/sh
# Posts today's trivia to the WhatsApp group via OpenClaw. See bot/SETUP.md.
#   post.sh question   7 a.m.: the question as a single-choice WhatsApp poll (A-D)
#   post.sh answer     8 p.m.: the answer as a text message
#   post.sh auto       for an hourly cron: question at 7, answer at 20 (Eastern), else nothing
#
#   DRY_RUN=1 post.sh question                  print what would be sent, send nothing
#   TRIVIA_TEST_DATE=2026-10-12 post.sh question  post that day's poll now, marked [TEST]
#
# The tdc-trivia Worker writes the whole message; this script never edits it and no
# AI model is involved. The Worker answers NO_REPLY when there's nothing to post
# (no row today, before 7 a.m., or an answer request before 8 p.m.).
#
# Settings, from the environment (e.g. a secrets manager) or /opt/tdc-trivia/env:
#   TRIVIA_TARGET    WhatsApp group JID, e.g. 120363…@g.us  (required)
#   TRIVIA_BOT_KEY   the Worker's BOT_KEY  (or put it in /opt/tdc-trivia/bot.key, chmod 600)
#   OPENCLAW         path to the openclaw binary, if it isn't on PATH
set -eu

WHAT=${1:-}
if [ "$WHAT" = auto ]; then
  case "$(TZ=America/New_York date +%H)" in
    07) WHAT=question ;;
    20) WHAT=answer ;;
    *)  exit 0 ;;
  esac
fi
case "$WHAT" in
  question) FETCH=poll ;;
  answer)   FETCH=answer ;;
  *) echo "usage: $0 question|answer|auto" >&2; exit 2 ;;
esac

DIR=${TRIVIA_DIR:-/opt/tdc-trivia}
if [ -f "$DIR/env" ]; then . "$DIR/env"; fi
: "${TRIVIA_TARGET:?set TRIVIA_TARGET (environment or $DIR/env)}"
OPENCLAW=${OPENCLAW:-openclaw}
API=${TRIVIA_BOT_API:-https://tdcreboot.com/api/trivia/bot}
KEY=${TRIVIA_BOT_KEY:-$(cat "$DIR/bot.key")}
QUERY="what=$FETCH"
if [ -n "${TRIVIA_TEST_DATE:-}" ]; then QUERY="$QUERY&date=$TRIVIA_TEST_DATE"; fi

# Any failure here exits non-zero before anything is sent, so an error page can
# never end up in the group. systemd records the failure in the journal.
TEXT=$(curl -fsS --max-time 20 --retry 3 --retry-delay 10 \
  -H "Authorization: Bearer $KEY" "$API?$QUERY")

if [ -z "$TEXT" ] || [ "$TEXT" = "NO_REPLY" ]; then
  echo "nothing to post ($WHAT)"
  exit 0
fi

if [ "$WHAT" = answer ]; then
  if [ "${DRY_RUN:-}" = 1 ]; then
    printf 'would send to %s:\n%s\n' "$TRIVIA_TARGET" "$TEXT"
    exit 0
  fi
  "$OPENCLAW" message send --channel whatsapp --target "$TRIVIA_TARGET" --message "$TEXT"
  echo "posted answer"
  exit 0
fi

# Poll: line 1 is the question, each following line one option (A-D, same order
# as the site). Build the argument list without word-splitting the text.
QUESTION=$(printf '%s\n' "$TEXT" | head -n 1)
set -- message poll --channel whatsapp --target "$TRIVIA_TARGET" --poll-question "$QUESTION"
COUNT=0
NL='
'
OLDIFS=$IFS; IFS=$NL; set -f          # no globbing: an option like "*" stays literal
for OPT in $(printf '%s\n' "$TEXT" | tail -n +2); do
  [ -n "$OPT" ] || continue
  set -- "$@" --poll-option "$OPT"
  COUNT=$((COUNT + 1))
done
IFS=$OLDIFS; set +f

if [ "$COUNT" -lt 2 ]; then
  echo "poll needs at least 2 options, got $COUNT; not posting" >&2
  exit 1
fi

if [ "${DRY_RUN:-}" = 1 ]; then
  printf 'would run: %s' "$OPENCLAW"
  for a in "$@"; do printf ' [%s]' "$a"; done
  printf '\n'
  exit 0
fi

"$OPENCLAW" "$@"
echo "posted poll ($COUNT options)"
