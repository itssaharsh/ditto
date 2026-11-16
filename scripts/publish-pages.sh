#!/usr/bin/env bash
# Publishes web/dist to the gh-pages branch (GitHub Pages). Refuses if personal data is found.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build-site.mjs
bash scripts/check-public.sh web/dist
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
cp -r web/dist/. "$tmp/"
cd "$tmp"
git init -q -b gh-pages
git add -A
git commit -q -m "Publish Ditto console $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$remote" gh-pages
echo "published to gh-pages"
