#!/usr/bin/env bash
# Fast sanity checks that do not need a Hugo build. Run from anywhere; used by CI and handy locally:
#   bash scripts/check-site.sh
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
err() { echo "ERROR: $*" >&2; fail=1; }

# 1. Every image referenced by data/homelab.yaml must exist in static/images/homelab/.
while read -r img; do
  [[ -f "static/images/homelab/$img" ]] || err "data/homelab.yaml references a missing image: $img"
done < <(grep -E '^\s*image:' data/homelab.yaml | sed -E 's/^\s*image:\s*//; s/\s+#.*$//')

# 2. Every entry in data/projects.yaml needs a name, an https url, a description and tags.
names=$(grep -cE '^\s*- name:' data/projects.yaml)
for key in url desc tags; do
  count=$(grep -cE "^\s+$key:" data/projects.yaml)
  [[ "$count" -eq "$names" ]] || err "data/projects.yaml: $names entries but $count '$key' fields"
done
grep -E '^\s+url:' data/projects.yaml | grep -vqE 'url:\s+https://' && err "data/projects.yaml: every url must start with https://" || true

# 3. JavaScript syntax (the Homelab hero is a hand-written canvas script).
if command -v node >/dev/null; then
  for f in static/js/*.js; do
    node --check "$f" || err "syntax error in $f"
  done
else
  echo "node not found, skipping the JavaScript syntax check"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Site checks failed." >&2
  exit 1
fi
echo "Site checks passed."
