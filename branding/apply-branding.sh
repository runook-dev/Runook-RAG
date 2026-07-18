#!/usr/bin/env bash
# Apply the Runook branding overlay onto a RAGFlow web checkout.
#
# Design goal: keep our changes as a small, idempotent, re-appliable overlay so
# upstream RAGFlow updates stay easy to merge. We only touch:
#   - the logo asset + favicon
#   - the browser <title> + conf.json appName
#   - a handful of hardcoded "RAGFlow" brand-name spots in the UI
#   - the accent color + brand gradient
# We deliberately do NOT scrub every i18n help string (low value, high churn).
#
# Usage: bash branding/apply-branding.sh /path/to/ragflow
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGFLOW_DIR="${1:-$HERE/../ragflow}"
WEB="$RAGFLOW_DIR/web"

if [[ ! -d "$WEB" ]]; then
  echo "web dir not found: $WEB" >&2
  exit 1
fi

BRAND="Runook"
# Runook accent #00b5ff -> space-separated RGB used by RAGFlow's CSS vars.
ACCENT_RGB="0 181 255"
# Runook brand gradient stops (from marketing site).
GRAD_FROM="#2dd4ff"
GRAD_TO="#0066ff"

echo "==> Logo + favicon"
cp "$HERE/logo.svg" "$WEB/public/logo.svg"
[[ -f "$HERE/favicon.ico" ]] && cp "$HERE/favicon.ico" "$WEB/public/favicon.ico" || true

echo "==> Browser title + app name"
sed -i.bak "s#<title>RAGFlow</title>#<title>${BRAND}</title>#" "$WEB/index.html"
sed -i.bak "s#\"appName\": \"RAGFlow\"#\"appName\": \"${BRAND}\"#" "$WEB/src/conf.json"

echo "==> Hardcoded brand-name spots"
# next-search logo <h1>RAGFlow</h1>
sed -i.bak "s#>RAGFlow<#>${BRAND}<#g" "$WEB/src/pages/next-search/ragflow-logo.tsx"
# login brand text
sed -i.bak "s#>RAGFlow</div>#>${BRAND}</div>#g" "$WEB/src/pages/login-next/index.tsx"
# admin login brand text (if present)
[[ -f "$WEB/src/pages/admin/login.tsx" ]] && sed -i.bak "s#>RAGFlow<#>${BRAND}<#g" "$WEB/src/pages/admin/login.tsx" || true
# home banner: "Welcome to RAGFlow" and gradient brand word
sed -i.bak "s#Welcome to RAGFlow#Welcome to ${BRAND}#g" "$WEB/src/pages/home/banner.tsx"
sed -i.bak "s#>RAGFlow<#>${BRAND}<#g" "$WEB/src/pages/home/banner.tsx"

echo "==> admin.title in locales (best-effort)"
for f in "$WEB"/src/locales/*.ts; do
  [[ -f "$f" ]] || continue
  sed -i.bak "s#title: 'RAGFlow'#title: '${BRAND}'#g" "$f" || true
done

echo "==> Accent color + brand gradient"
sed -i.bak "s#--accent-primary: 0 190 180;#--accent-primary: ${ACCENT_RGB};#g" "$WEB/tailwind.css"
# Rebrand the two hardcoded gradient spots (login/search/home wordmark).
grep -rl "from-\[#40EBE3\] to-\[#4A51FF\]" "$WEB/src" 2>/dev/null | while read -r f; do
  sed -i.bak "s|from-\[#40EBE3\] to-\[#4A51FF\]|from-[${GRAD_FROM}] to-[${GRAD_TO}]|g" "$f"
done

echo "==> Cleaning up .bak files"
find "$WEB" -name "*.bak" -type f -delete

echo "==> Runook branding applied to $WEB"
