#!/usr/bin/env bash
# PreToolUse hook of the DevOps Operator: guardrails for git and gh commands in
# Salesforce projects, so a mistake is stopped before it happens instead of
# being explained afterwards.
#
#   deny - force pushes, pushes to an environment branch, and commits, merges,
#          rebases or cherry-picks on an environment branch
#   ask  - commands that throw away work (reset --hard, clean, restore, branch
#          -D, stash drop, ...) and merging a pull request
#
# Environment branches come from .github/salesforce-devops.yml (environments
# and base); without that file, main, master and the remote's default branch.
# A branch switch earlier in the same command counts (git switch -c x && git
# commit commits on x), and heredoc bodies are data, never commands.
# Outside a Salesforce project - no sfdx-project.json and no config file - the
# hook does nothing. DEVOPS_OPERATOR_GUARD=off turns it off for one person -
# set in their own settings, never in a project's shared ones.
#
# Reads the hook event as JSON on stdin and answers with a permission decision
# on stdout. Written for bash 3.2 and BSD tools as well, without jq.

set -u

# Read the event even when turned off: exiting before Claude Code has written
# it breaks the pipe on its side.
if [ "${DEVOPS_OPERATOR_GUARD:-on}" = off ]; then
  cat >/dev/null
  exit 0
fi

input=$(cat)

# Cheap exit for everything that is not a git or gh command.
case "$input" in
  *git* | *'"gh '* | *'gh '*) ;;
  *) exit 0 ;;
esac

# Value of a top-level string field of the event, still JSON-escaped.
json_field() {
  printf '%s' "$input" | tr '\n' ' ' |
    sed -nE 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p'
}

unescape() {
  sed -e 's/\\"/"/g' -e 's/\\t/ /g' -e 's/\\n/\
/g' -e 's/\\\\/\\/g'
}

command=$(json_field command | unescape)
cwd=$(json_field cwd | unescape)
[ -n "$command" ] || exit 0
[ -d "$cwd" ] || cwd=$PWD

decide() {
  # $1 deny|ask, $2 reason - plain text without double quotes or backslashes
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' "$1" "$2"
  exit 0
}

is_salesforce_project() {
  top=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -f "$top/sfdx-project.json" ] || [ -f "$top/.github/salesforce-devops.yml" ]
}

protected_branches() {
  top=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 0
  config="$top/.github/salesforce-devops.yml"
  if [ -f "$config" ]; then
    awk '
      { sub(/[[:space:]]+#.*/, "") }
      /^(environments|base):/ {
        key = $0; sub(/:.*/, "", key)
        value = $0; sub(/^[a-z]+:[[:space:]]*/, "", value)
        gsub(/[][,"\047]/, " ", value)
        if (value ~ /[^[:space:]]/) { print value; inlist = 0 } else { inlist = (key == "environments") }
        next
      }
      inlist && /^[[:space:]]*-/ { item = $0; sub(/^[[:space:]]*-[[:space:]]*/, "", item); gsub(/["\047]/, "", item); print item; next }
      inlist && /^[[:space:]]*$/ { next }
      { inlist = 0 }
    ' "$config"
  else
    default=$(git -C "$1" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
    echo "main master ${default#origin/}"
  fi
}

is_protected() {
  # $1 repository directory, $2 branch name
  for branch in $(protected_branches "$1"); do
    [ "$branch" = "$2" ] && return 0
  done
  return 1
}

# A branch switch earlier in the same command (git switch -c x && git commit):
# later segments in that repository are checked against the branch switched to.
switched_dir= switched_branch=

switch_to() {
  # $1 repository directory, $2 branch name ("" when detached or unknown)
  switched_dir=$1
  switched_branch=$2
}

check_git() {
  # $@: the words of one git invocation, without the leading "git"
  dir=$cwd
  while [ $# -gt 0 ]; do
    case $1 in
      -C) case $2 in /*) dir=$2 ;; *) dir=$cwd/$2 ;; esac; shift 2 ;;
      -c) shift 2 ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ $# -gt 0 ] || return 0
  is_salesforce_project "$dir" || return 0

  sub=$1
  shift
  current=$(git -C "$dir" branch --show-current 2>/dev/null)
  if [ -n "$switched_dir" ] && [ "$switched_dir" = "$dir" ]; then
    current=$switched_branch
  fi

  case $sub in
    push)
      remote= refspecs= skip= tags=
      for arg in "$@"; do
        if [ -n "$skip" ]; then skip=; continue; fi
        case $arg in
          --tags | --all) tags=1 ;;
          --force | --force-with-lease* | --force-if-includes | --mirror)
            decide deny "Force pushes are blocked by the DevOps Operator: they overwrite history on GitHub that teammates and the pipeline rely on. Push normally; if GitHub rejects the push, bring the branch up to date with a merge instead. If a force push is really needed, the user has to run it in their own terminal." ;;
          --delete | -d)
            decide ask "This deletes a branch on GitHub. Teammates and open pull requests may still use it. Delete it?" ;;
          -o | --push-option | --repo) skip=1 ;;
          --*) ;;
          -*f*)
            decide deny "Force pushes are blocked by the DevOps Operator: they overwrite history on GitHub that teammates and the pipeline rely on. Push normally; if GitHub rejects the push, bring the branch up to date with a merge instead. If a force push is really needed, the user has to run it in their own terminal." ;;
          -*) ;;
          *)
            if [ -z "$remote" ]; then remote=$arg; else refspecs="$refspecs $arg"; fi ;;
        esac
      done
      # Without a refspec, git pushes the current branch - unless only tags go.
      [ -n "$refspecs" ] || [ -n "$tags" ] || refspecs=$current
      for spec in $refspecs; do
        case $spec in
          +*)
            decide deny "Force pushes are blocked by the DevOps Operator: a refspec starting with + overwrites history on GitHub. Push without the +." ;;
          :*)
            decide ask "This deletes the branch ${spec#:} on GitHub. Teammates and open pull requests may still use it. Delete it?" ;;
        esac
        target=${spec##*:}
        target=${target#refs/heads/}
        [ "$target" = HEAD ] && target=$current
        if is_protected "$dir" "$target"; then
          decide deny "Pushing to $target is blocked by the DevOps Operator: $target is an environment branch, and changes reach it only through a reviewed pull request. Push the work branch instead and open a pull request into $target."
        fi
      done
      ;;
    commit | merge | cherry-pick | revert | am | rebase)
      for arg in "$@"; do
        case $arg in --abort | --quit | --skip) return 0 ;; esac
      done
      if [ -n "$current" ] && is_protected "$dir" "$current"; then
        decide deny "Changing $current directly is blocked by the DevOps Operator: $current is an environment branch, and changes reach it only through a reviewed pull request. Create a work branch first - uncommitted changes move along with git switch -c - and commit there."
      fi
      ;;
    reset)
      for arg in "$@"; do
        case $arg in
          --hard) decide ask "git reset --hard throws away every uncommitted change in this project, and they cannot be recovered. Continue?" ;;
        esac
      done
      ;;
    clean)
      dry=
      for arg in "$@"; do case $arg in -n | --dry-run | -*n*) dry=1 ;; esac; done
      if [ -z "$dry" ]; then
        decide ask "git clean deletes files that were never committed, and they cannot be recovered. Continue?"
      fi
      ;;
    checkout)
      for arg in "$@"; do
        case $arg in
          -- | . | -f | --force)
            decide ask "This checkout throws away uncommitted changes to the files it touches, and they cannot be recovered. Continue?" ;;
        esac
      done
      new= target= positional=
      for arg in "$@"; do
        if [ -n "$new" ]; then target=$arg; new=; continue; fi
        case $arg in
          -b | -B | --orphan) new=1 ;;
          --detach) switch_to "$dir" ""; return 0 ;;
          -) [ -n "$positional" ] || positional=- ;;
          -*) ;;
          *) [ -n "$positional" ] || positional=$arg ;;
        esac
      done
      if [ -n "$target" ]; then
        switch_to "$dir" "$target"
      elif [ "$positional" = - ]; then
        switch_to "$dir" "$(git -C "$dir" rev-parse --abbrev-ref '@{-1}' 2>/dev/null)"
      elif [ -n "$positional" ] && git -C "$dir" show-ref --verify --quiet "refs/heads/$positional"; then
        switch_to "$dir" "$positional"
      fi
      ;;
    restore)
      staged= worktree=
      for arg in "$@"; do
        case $arg in
          --staged | -S) staged=1 ;;
          --worktree | -W) worktree=1 ;;
          -SW | -WS) staged=1 worktree=1 ;;
        esac
      done
      if [ -z "$staged" ] || [ -n "$worktree" ]; then
        decide ask "git restore throws away uncommitted changes to these files, and they cannot be recovered. Continue?"
      fi
      ;;
    switch)
      for arg in "$@"; do
        case $arg in
          --discard-changes | -f | --force)
            decide ask "Switching with --discard-changes throws away uncommitted changes, and they cannot be recovered. Continue?" ;;
        esac
      done
      new= target= positional=
      for arg in "$@"; do
        if [ -n "$new" ]; then target=$arg; new=; continue; fi
        case $arg in
          -c | -C | --create | --force-create | --orphan) new=1 ;;
          --create=* | --force-create=* | --orphan=*) target=${arg#*=} ;;
          -d | --detach) switch_to "$dir" ""; return 0 ;;
          -) [ -n "$positional" ] || positional=- ;;
          -*) ;;
          *) [ -n "$positional" ] || positional=$arg ;;
        esac
      done
      if [ -n "$target" ]; then
        switch_to "$dir" "$target"
      elif [ "$positional" = - ]; then
        switch_to "$dir" "$(git -C "$dir" rev-parse --abbrev-ref '@{-1}' 2>/dev/null)"
      elif [ -n "$positional" ]; then
        switch_to "$dir" "$positional"
      fi
      ;;
    branch)
      for arg in "$@"; do
        case $arg in
          -D | --force | -*D*)
            decide ask "This deletes a branch even if its work was never merged anywhere. Continue?" ;;
        esac
      done
      ;;
    stash)
      case ${1:-} in
        drop | clear) decide ask "This deletes stashed changes for good. Continue?" ;;
      esac
      ;;
  esac
}

check_gh() {
  case "${1:-} ${2:-}" in
    'pr merge')
      is_salesforce_project "$cwd" || return 0
      decide ask "Merging this pull request starts the deployment into the org behind its target branch - in some setups, production. Merge it?"
      ;;
  esac
}

# Drops the bodies of heredocs: they are data - a commit message, an issue text -
# not commands, even when they mention git. Handles <<WORD, <<-WORD and quoted
# delimiters; <<< here-strings stay on their line.
strip_heredocs() {
  delim= strip_tabs=
  re="<<(-?)[[:space:]]*[\"']?([A-Za-z_][A-Za-z0-9_]*)"
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "$delim" ]; then
      check=$line
      if [ -n "$strip_tabs" ]; then
        check=$(printf '%s' "$line" | sed 's/^	*//')
      fi
      [ "$check" = "$delim" ] && delim=
      continue
    fi
    printf '%s\n' "$line"
    plain=${line//<<</ }
    if [[ $plain =~ $re ]]; then
      strip_tabs=${BASH_REMATCH[1]}
      delim=${BASH_REMATCH[2]}
    fi
  done
}

# Split the command into its simple commands and check each git or gh call.
set -f
segments=$(printf '%s\n' "$command" | strip_heredocs | sed -e 's/&&/\
/g' -e 's/||/\
/g' -e 's/[;|]/\
/g')
while IFS= read -r segment; do
  # shellcheck disable=SC2086 # word splitting is the point here
  set -- $segment
  while [ $# -gt 0 ]; do
    case $1 in
      *=* | command | sudo | env | exec | time | '(' | '{') shift ;;
      *) break ;;
    esac
  done
  [ $# -gt 0 ] || continue
  case $1 in
    git) shift; check_git "$@" ;;
    gh) shift; check_gh "$@" ;;
  esac
done <<EOF
$segments
EOF

exit 0
