#!/usr/bin/env bash
# PreToolUse hook on Bash: refuse the git commands that publish to the wrong
# place or stage more than was meant. Exit 2 blocks the call and hands the
# message on stderr back to the agent.
#
# - a push to main or master (`git push origin main`, `HEAD:main`, `+master`):
#   work goes on a branch and reaches main through a pull request;
# - `git add -A`, `--all`, `.` or `*`: stage files by name, so nothing nobody
#   read (a secret, another session's work) rides along;
# - `git add` of an env file: `.env`, `.env.local`, `.env.<anything>`, except
#   the committed `.env.example`, which documents them.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[[ -z "$cmd" ]] && exit 0

block() {
  echo "BLOCKED: $1" >&2
  exit 2
}

if grep -qE '(^|[^[:alnum:]_-])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([[:space:]]+[^[:space:]]+)*[[:space:]]+\+?([^[:space:]]*:)?(refs/heads/)?(main|master)([[:space:];&|)]|$)' <<<"$cmd"; then
  block 'Do not push to main or master. Push a branch and open a pull request (the steward skill).'
fi

# Walk the words of every `git add` in the command, up to the next separator.
read -ra words <<<"$cmd"
in_add=0
prev=''
for word in "${words[@]}"; do
  case "$word" in
    '&&' | '||' | ';' | '|' | '&')
      in_add=0
      prev=''
      continue
      ;;
  esac
  if [[ $in_add -eq 0 ]]; then
    [[ "$prev" == git && "$word" == add ]] && in_add=1
    prev=$word
    continue
  fi
  token=${word%;}
  token=${token//\"/}
  token=${token//\'/}
  case "$token" in
    -A | --all | . | ./ | '*')
      block 'Do not stage everything (git add -A / --all / . / *). Stage the files you changed by path.'
      ;;
  esac
  name=${token##*/}
  if [[ "$name" == .env || "$name" == .env.* ]] && [[ "$name" != .env.example ]]; then
    block "Do not stage $token: env files hold secrets. Only .env.example is committed."
  fi
  [[ "$word" == *';' ]] && in_add=0
done
exit 0
