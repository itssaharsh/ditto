#!/usr/bin/env bash
# Publishes web/dist to the gh-pages branch (GitHub Pages) with an ordinary commit and push.
# Refuses if personal data is found.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build-site.mjs
bash scripts/check-public.sh web/dist
work=.ditto-work/gh-pages
if [ ! -d "$work/.git" ] && [ ! -f "$work/.git" ]; then
  rm -rf "$work"
  if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
    git fetch -q origin gh-pages:gh-pages || true
    git worktree add -q "$work" gh-pages
  else
    git worktree add -q --orphan -b gh-pages "$work"
  fi
fi
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r web/dist/. "$work/"
cd "$work"
git add -A
git commit -q -m "Publish Ditto console $(date -u +%Y-%m-%dT%H:%MZ)" || { echo "nothing to publish"; exit 0; }
git push -q origin gh-pages
echo "published to gh-pages"
