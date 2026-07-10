-- Script-tier flagship: the real AgentCash statusline, uploaded as-is.
INSERT INTO statuslines (slug, name, description, author, price_usd, kind, spec, script, preview_ansi, capabilities, audit_verdict, audit_summary, audit_model, tags, installs, featured)
VALUES ('agentcash-banner', 'AgentCash Banner', 'The real thing: animated brand slashes with a traveling shimmer, live wallet balances via the agentcash CLI, deposit hyperlink, and your last agentcash charge right-justified at the terminal edge.', 'merit systems', '0', 'script', NULL, '#!/usr/bin/env bash
# Claude Code status line — AgentCash brand banner.
# Green diagonal slashes (bright left -> fading dark) with a shimmer band that
# travels once per second (requires "refreshInterval": 1 in settings.json),
# the AGENTCASH wordmark, and live wallet balances.
#
# Balances are cached for instant render and refreshed in the background so the
# repaint never blocks on the ~1s network call. Claude Code cancels in-flight
# statusline runs when a new update triggers, so the script itself must always
# return fast — a cold cache just renders $0.00 for a beat while the first
# detached refresh completes.
#
# Test with mock input:
#   echo ''{}'' | COLUMNS=120 ~/.claude/statusline.sh

input=$(cat)

# UTF-8 locale so ${#var} counts characters (⬢, ↳), not bytes — the
# right-justify math below depends on it.
export LC_ALL=en_US.UTF-8

CACHE="$HOME/.claude/.agentcash-accounts.json"
STAMP="$CACHE.stamp"
MAX_AGE=60   # seconds between background balance refreshes
COLD_AGE=10  # retry cadence while the cache is empty (cold start / logged out)

now=$(date +%s)
frame=$now   # 1 fps animation clock; refreshInterval re-runs us each second

# The stamp file debounces refresh spawns independently of the cache content,
# so a failing CLI (not installed / logged out) can''t fork a fetch per second.
stamp_mtime=$(stat -f %m "$STAMP" 2>/dev/null || stat -c %Y "$STAMP" 2>/dev/null || echo 0)
due=$MAX_AGE; [ -s "$CACHE" ] || due=$COLD_AGE
if [ $(( now - stamp_mtime )) -ge "$due" ]; then
  touch "$STAMP" 2>/dev/null
  ( agentcash accounts --format json > "$CACHE.tmp" 2>/dev/null \
      && mv "$CACHE.tmp" "$CACHE" ) >/dev/null 2>&1 &
fi

# --- balances ---------------------------------------------------------------
total=0; base=0; tempo=0; sol=0
if [ -s "$CACHE" ]; then
  read -r total base tempo sol < <(jq -r ''
    [ (.data.totalBalance // 0),
      (.data.accounts[]? | select(.network=="base")   | .balance) // 0,
      (.data.accounts[]? | select(.network=="tempo")  | .balance) // 0,
      (.data.accounts[]? | select(.network=="solana") | .balance) // 0
    ] | @tsv'' "$CACHE" 2>/dev/null)
fi

# --- animated brand slashes (truecolor) -------------------------------------
# Envelope: bright on the left, fading toward black on the right.
# Shimmer:  a sinusoidal highlight whose phase advances with `frame`, so the
#           bright band appears to travel through the slashes each second.
slashes=$(awk -v n=11 -v f="$frame" ''BEGIN{
  Gmax=245; pi=3.14159265;
  w = 2*pi/10;                         # ~10s cycle -> small step per second = smooth
  for(p=0;p<n;p++){
    env = 1.0 - (p/(n-1))*0.80;        # bright left -> dark right brand gradient
    sh  = 0.80 + 0.20*sin(f*w + p*0.45); # subtle shimmer, slight per-bar phase offset
    i = env*sh;
    if(i > 1) i = 1; if(i < 0.10) i = 0.10;
    G = int(Gmax*i); R = int(G*0.28); B = int(G*0.40);
    printf "\033[38;2;%d;%d;%dm/", R, G, B;
  }
  printf "\033[0m";
}'')

# --- wordmark + balances ----------------------------------------------------
cube=$''\033[38;2;72;224;91m⬢\033[0m''
word=$''\033[1;97mAGENT\033[38;2;72;224;91mCASH\033[0m''
bal=$(printf ''\033[1;38;2;96;232;112m$%.2f\033[0m'' "$total")
sub=$(printf ''\033[2;38;2;78;168;96m(b%.2f|t%.2f|s%.2f)\033[0m'' "$base" "$tempo" "$sol")

# --- topup link ---------------------------------------------------------------
# OSC 8 hyperlink to the deposit page for this wallet (Cmd/Ctrl+click; needs a
# terminal with hyperlink support — iTerm2, Kitty, WezTerm, Ghostty).
topup=""
if [ -s "$CACHE" ]; then
  addr=$(jq -r ''[.data.accounts[]? | select(.network=="base") | .address] | first // empty'' "$CACHE" 2>/dev/null)
  if [ -n "$addr" ]; then
    topup=$(printf ''\033]8;;https://agentcash.dev/deposit/%s\a\033[4;2;38;2;96;232;112mtopup\033[0m\033]8;;\a'' "$addr")
  fi
fi

# --- last agentcash charge (right-justified) ---------------------------------
# Written by the PostToolUse hook ~/.claude/hooks/agentcash-last-charge.sh
# whenever a paid agentcash fetch returns paymentInfo.
CHARGE="$HOME/.claude/.agentcash-last-charge.json"
last=""
if [ -s "$CHARGE" ]; then
  read -r c_origin c_price < <(jq -r ''[.origin, (.price|tostring)] | @tsv'' "$CHARGE" 2>/dev/null)
  if [ -n "$c_origin" ]; then
    p=$(awk -v x="$c_price" ''BEGIN{s=sprintf("%.4f",x); sub(/0+$/,"",s); sub(/\.$/,"",s); print s}'')
    last=$(printf ''\033[2;38;2;120;170;135m↳ %s -$%s\033[0m'' "$c_origin" "$p")
  fi
fi

left=$(printf ''%s %s %s %s %s'' "$cube" "$word" "$slashes" "$bal" "$sub")
[ -n "$topup" ] && left="$left $topup"

# Columns to leave free at the right edge: Claude Code adds undocumented
# built-in spacing around the statusline, and its truncation counts ⬢/↳ by
# display width (wider than our character count). Shrink toward 0 if the
# segment sits short of the edge; grow if the amount gets cut off.
RIGHT_MARGIN=4

if [ -n "$last" ] && [ -n "$COLUMNS" ]; then
  # Pad so the charge segment ends RIGHT_MARGIN short of the terminal''s right
  # edge. Lengths are computed on stripped copies: ANSI color codes and OSC 8
  # hyperlink wrappers are zero-width, so both must be removed before counting.
  esc=$(printf ''\033''); bel=$(printf ''\a'')
  strip_zero_width() {
    printf ''%s'' "$1" | sed -e "s/${esc}\[[0-9;]*m//g" -e "s/${esc}]8;;[^${bel}]*${bel}//g"
  }
  lplain=$(strip_zero_width "$left")
  rplain=$(strip_zero_width "$last")
  gap=$(( COLUMNS - RIGHT_MARGIN - ${#lplain} - ${#rplain} ))
  [ "$gap" -lt 1 ] && gap=1
  printf ''%s%*s%s'' "$left" "$gap" '''' "$last"
elif [ -n "$last" ]; then
  printf ''%s  %s'' "$left" "$last"
else
  printf ''%s'' "$left"
fi
', '[38;2;72;224;91m⬢[0m [1;97mAGENT[38;2;72;224;91mCASH[0m [38;2;67;242;96m/[38;2;59;213;85m/[38;2;50;179;71m/[38;2;40;146;58m/[38;2;32;116;46m/[38;2;26;93;37m/[38;2;21;76;30m/[38;2;18;65;26m/[38;2;15;57;22m/[38;2;13;49;19m/[38;2;10;39;15m/[0m [1;38;2;96;232;112m$24.96[0m [2;38;2;78;168;96m(b23.46|t0.70|s0.80)[0m ]8;;https://agentcash.dev/deposit/0xb4ad6bb516725fF69594E46c3a7DAEdF7c473186[4;2;38;2;96;232;112mtopup[0m]8;;                                 [2;38;2;120;170;135m↳ stableenrich.dev -$0.002[0m', ARRAY['network','writes-files','reads-home','background-jobs','env-vars']::text[], 'approve', 'Displays an animated AgentCash brand banner with live wallet balances. Reads session JSON from stdin but primarily shells out to the agentcash CLI (network) to fetch account balances, caching them under ~/.claude/ and refreshing in a detached background job so repaints never block. Uses jq/awk for parsing and rendering, emits an OSC-8 hyperlink to the wallet deposit page, and right-justifies the most recent agentcash charge (read from a hook-written cache file) against the terminal width. Writes only to its own cache files in ~/.claude/. No data leaves the machine except the balance query to the agentcash CLI.', 'claude-fable-5', ARRAY['brand','live-data','animated']::text[], 0, true)
ON CONFLICT (slug) DO UPDATE SET script = EXCLUDED.script, preview_ansi = EXCLUDED.preview_ansi, audit_summary = EXCLUDED.audit_summary, capabilities = EXCLUDED.capabilities;
