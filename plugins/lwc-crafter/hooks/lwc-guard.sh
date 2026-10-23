#!/usr/bin/env bash
# PostToolUse hook of the LWC Crafter: after every write to a file of a
# Lightning web component, runs the skill's checker for the errors that must
# never ship - APIs that Lightning Web Security blocks, HTML strings written
# into the DOM, dynamic code, scripts from other hosts, Aura globals - and hands
# them straight back to the agent, so they are fixed before anything else.
#
# Warnings stay out of it; they belong in a review. Outside lwc folders, and
# where Node.js is missing, the hook does nothing. LWC_CRAFTER_GUARD=off turns
# it off for one person - set in their own settings, never in a project's
# shared ones.
#
# Reads the hook event as JSON on stdin; the checker answers with a block
# decision on stdout. Written for bash 3.2 and BSD tools as well, without jq.

set -u

[ "${LWC_CRAFTER_GUARD:-on}" = off ] && exit 0

input=$(cat)

# Cheap exit for everything that is not a file in an lwc folder - on Windows
# the path arrives with JSON-escaped backslashes.
case "$input" in
  *'/lwc/'* | *'\\lwc\\'*) ;;
  *) exit 0 ;;
esac

command -v node >/dev/null 2>&1 || exit 0

root=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
printf '%s' "$input" | node "$root/skills/salesforce-lwc-crafter/scripts/lwc-check.mjs" --hook
exit 0
