#!/bin/sh
# Posts today's trivia question or answer to the WhatsApp group via OpenClaw.
#   usage: post.sh question | answer
#   DRY_RUN=1 post.sh question   prints what would be sent, sends nothing
#
# The tdc-trivia Worker writes the whole message; this script never edits it and no
# AI model is involved. The Worker answers NO_REPLY when there's nothing to post
# (no row today, before 7 a.m., or an answer request before 8 p.m.).
#
# Reads /opt/tdc-trivia/env:  TRIVIA_TARGET  group JID, e.g. 120363…@g.us
#                             OPENCLAW       path to the openclaw binary (optional)
# and the bot key from /opt/tdc-trivia/bot.key (chmod 600).
set -eu

WHAT=${1:-}
case "$WHAT" in question|answer) ;; *) echo "usage: $0 question|answer" >&2; exit 2 ;; esac

DIR=${TRIVIA_DIR:-/opt/tdc-trivia}
. "$DIR/env"
: "${TRIVIA_TARGET:?set TRIVIA_TARGET in $DIR/env}"
OPENCLAW=${OPENCLAW:-openclaw}
API=${TRIVIA_BOT_API:-https://tdc-trivia.link-ventures.workers.dev/api/trivia/bot}
KEY=$(cat "$DIR/bot.key")

# Any failure here exits non-zero before anything is sent, so an error page can
# never end up in the group. systemd records the failure in the journal.
TEXT=$(curl -fsS --max-time 20 --retry 3 --retry-delay 10 \
  -H "Authorization: Bearer $KEY" "$API?what=$WHAT")

if [ -z "$TEXT" ] || [ "$TEXT" = "NO_REPLY" ]; then
  echo "nothing to post ($WHAT)"
  exit 0
fi

if [ "${DRY_RUN:-}" = 1 ]; then
  printf 'would send to %s:\n%s\n' "$TRIVIA_TARGET" "$TEXT"
  exit 0
fi

"$OPENCLAW" message send --channel whatsapp --target "$TRIVIA_TARGET" --message "$TEXT"
echo "posted $WHAT"
