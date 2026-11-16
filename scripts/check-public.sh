#!/usr/bin/env bash
# Fails if anything about to be published contains the Kane account's email or org id.
# The values are read from your local Kane/git config at run time and never written to the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
patterns=()
email=$(git config user.email || true)
[ -n "$email" ] && patterns+=("$email")
# Account details as Kane writes them into evidence packs (result.yaml), read from your newest pack.
pack=$(ls -t "$HOME"/.testmuai/kaneai/sessions/*/evidence/*.evidence 2>/dev/null | head -1 || true)
if [ -n "$pack" ]; then
  while read -r v; do [ -n "$v" ] && patterns+=("$v"); done < <(unzip -p "$pack" '*/result.yaml' 'result.yaml' 2>/dev/null | grep -E '^\s*(user_email|org_id|user_name):' | sed -E "s/^[^:]+:\s*'?([^']*)'?\s*$/\1/" | sort -u)
fi
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(cases web/dist $(git ls-files))
hits=0
for p in "${patterns[@]}"; do
  [ ${#p} -ge 5 ] || continue
  if grep -rIl --exclude-dir=node_modules -F "$p" "${targets[@]}" 2>/dev/null | grep -v '^scripts/check-public.sh$'; then hits=1; fi
done
# Local home paths name the account too (also partial ones like ".../<user>/").
patterns+=("/$(basename "$HOME")/")
if grep -rIl --exclude-dir=node_modules -F "$HOME/" "${targets[@]}" 2>/dev/null | grep -v '^scripts/check-public.sh$'; then hits=1; fi
if [ $hits -ne 0 ]; then echo "check-public: personal data found in the files above" >&2; exit 1; fi
echo "check-public: clean (${#patterns[@]} patterns, ${#targets[@]} targets)"
