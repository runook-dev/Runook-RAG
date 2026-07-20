#!/usr/bin/env bash
# Apply the Runook RAG branding overlay onto a RAGFlow web checkout.
#
# Idempotent, re-appliable overlay. Covers:
#   1. Remove/neutralize entry points that lead to RAGFlow's own properties
#      (Discord, GitHub, ragflow.io docs, "Powered by RAGFlow", version string).
#   2. Rename every USER-VISIBLE "RAGFlow" -> "Runook RAG" (locales + hardcoded
#      JSX + title/appName), while leaving code identifiers untouched.
#   3. Switch the whole theme to Runook blue (CSS vars incl. dark-mode purple
#      core tokens, LESS vars, and hardcoded hexes across components/SVGs).
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

BRAND="Runook RAG"

# ---------------------------------------------------------------------------
# Logo + favicon
# ---------------------------------------------------------------------------
echo "==> Logo + favicon"
cp "$HERE/logo.svg" "$WEB/public/logo.svg"
[[ -f "$HERE/favicon.ico" ]] && cp "$HERE/favicon.ico" "$WEB/public/favicon.ico" || true

# ---------------------------------------------------------------------------
# Browser title + embed app name
# ---------------------------------------------------------------------------
echo "==> Browser title + app name"
sed -i.bak "s#<title>RAGFlow</title>#<title>${BRAND}</title>#" "$WEB/index.html"
sed -i.bak "s#\"appName\": \"RAGFlow\"#\"appName\": \"${BRAND}\"#" "$WEB/src/conf.json"

# ---------------------------------------------------------------------------
# 1. Remove entry points to RAGFlow properties
# ---------------------------------------------------------------------------
echo "==> Removing RAGFlow nav/community/help links"

# Desktop header: drop Discord + GitHub <a> icons and the ragflow.io Help button.
perl -0777 -pi -e '
  s{<a\b[^>]*href="https://discord\.com[^"]*"[^>]*>.*?</a>}{}s;
  s{<a\b[^>]*href="https://github\.com/infiniflow/ragflow[^"]*"[^>]*>.*?</a>}{}s;
  s{<Button\b[^>]*to="https://ragflow\.io[^"]*"[^>]*>.*?</Button>}{}s;
' "$WEB/src/layouts/components/header.tsx"

# Mobile menu footer: it is nothing but Discord/GitHub/Help links -> render empty.
cat > "$WEB/src/layouts/components/mobile-menu-footer.tsx" <<'TSX'
type MobileMenuFooterProps = {
  onClose: () => void;
};

// Runook: upstream RAGFlow community/help links removed for white-label.
export function MobileMenuFooter(_props: MobileMenuFooterProps) {
  return null;
}
TSX

# Hide the RAGFlow version string in the settings sidebar by treating our own
# host as the "managed" host (upstream only fetches/show version when the host
# differs from this constant).
sed -i.bak "s#export const Domain = 'cloud.ragflow.io'#export const Domain = 'rag.runook.com'#" \
  "$WEB/src/constants/common.ts" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Neutralize remaining ragflow.io / cloud.ragflow.io / github URLs (help
# tooltips, embed dialog, provider doc links) so no brand leaks through.
# These are lowercase, so they are untouched by the "RAGFlow" word rename below.
# ---------------------------------------------------------------------------
echo "==> Rewriting ragflow.io / github URLs"
URL_FILES=$(grep -rlE "ragflow\.io|github\.com/infiniflow/ragflow" "$WEB/src" 2>/dev/null || true)
if [[ -n "$URL_FILES" ]]; then
  # URL char class excludes whitespace, backtick(\x60), apostrophe(\x27),
  # doublequote(\x22), comma, parens and angle brackets, so we never consume the
  # closing delimiter of a JS string / template literal.
  perl -0777 -pi -e '
    my $u = qr/[^\s\x60\x27\x22,()<>]*/;
    s{https?://cloud\.ragflow\.io$u}{https://rag.runook.com}g;
    s{https?://ragflow\.io$u}{https://runook.com}g;
    s{https?://github\.com/infiniflow/ragflow$u}{https://runook.com}g;
    s{cloud\.ragflow\.io}{rag.runook.com}g;
    s{ragflow\.io}{runook.com}g;
  ' $URL_FILES
fi

# ---------------------------------------------------------------------------
# 2. Rename user-visible "RAGFlow" -> "Runook RAG"
#    Protects code identifiers: not preceded by [.\w], not followed by \w,
#    and never the internal "RAGFlow-Prompt" tag.
# ---------------------------------------------------------------------------
echo "==> Renaming RAGFlow -> ${BRAND} (locales + hardcoded UI)"
RENAME_FILES=$(ls "$WEB"/src/locales/*.ts 2>/dev/null)
RENAME_FILES="$RENAME_FILES
$WEB/src/pages/login-next/index.tsx
$WEB/src/pages/home/banner.tsx
$WEB/src/pages/admin/login.tsx
$WEB/src/pages/next-search/ragflow-logo.tsx
$WEB/src/components/embed-dialog/index.tsx
$WEB/src/components/api-service/chat-overview-modal/backend-service-api.tsx
$WEB/src/layouts/components/header.tsx
$WEB/src/layouts/components/global-navbar.tsx
$WEB/src/pages/user-setting/data-source/constant/jira-constant.tsx
$WEB/src/pages/skills/components/upload-modal.tsx"

for f in $RENAME_FILES; do
  [[ -f "$f" ]] || continue
  perl -0777 -pi -e 's/(?<![.\w])RAGFlow(?!\w)(?!-Prompt)/Runook RAG/g' "$f"
done

# ---------------------------------------------------------------------------
# 3. Theme -> Runook blue
#    Palette: primary #00b5ff (rgb 0 181 255), bright #2dd4ff (45 212 255),
#    deep #0066ff (0 102 255).
# ---------------------------------------------------------------------------
echo "==> Accent + sidebar CSS variables"
sed -i.bak \
  -e "s#--accent-primary: 0 190 180;#--accent-primary: 0 181 255;#g" \
  -e "s#--sidebar-primary: 224.3 76.3% 48%;#--sidebar-primary: 199 100% 50%;#g" \
  -e "s#--sidebar-ring: 217.2 91.2% 59.8%;#--sidebar-ring: 199 100% 50%;#g" \
  "$WEB/tailwind.css"

echo "==> LESS brand variables"
if [[ -f "$WEB/src/less/variable.less" ]]; then
  perl -0777 -pi -e '
    s/rgba\(22,\s*119,\s*255/rgba(0, 181, 255/g;
    s/rgba\(127,\s*86,\s*217/rgba(0, 181, 255/g;
    s/rgba\(239,\s*248,\s*255/rgba(0, 181, 255/g;
  ' "$WEB/src/less/variable.less"
fi

echo "==> Global brand-color hex/rgb replacement"
COLOR_FILES=$(find "$WEB/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.less' -o -name '*.svg' \) 2>/dev/null)
COLOR_FILES="$COLOR_FILES $WEB/tailwind.css $WEB/public/iconfont.js $WEB/public/logo.svg"
# shellcheck disable=SC2086
perl -0777 -pi -e '
  # teal -> Runook blue
  s/#00BEB4/#00b5ff/gi;
  s/#01BEB3/#00b5ff/gi;
  s/#02bcdd/#2dd4ff/gi;
  s/#80FFF8/#2dd4ff/gi;
  # old cyan->indigo gradients -> Runook bright->deep
  s/#40EBE3/#2dd4ff/gi;
  s/#4A51FF/#0066ff/gi;
  s/#43CDE9/#2dd4ff/gi;
  s/#4E40EC/#0066ff/gi;
  # purples -> blues
  s/#7561ff/#0066ff/gi;
  s/#7F69FF/#00b5ff/gi;
  s/#897EFF/#00b5ff/gi;
  s/#654BF8/#0066ff/gi;
  s/#9276FF/#2dd4ff/gi;
  # legacy antd/generic blues -> Runook
  s/#1677ff/#00b5ff/gi;
  s/#338AFF/#00b5ff/gi;
  s/#4CACFF/#2dd4ff/gi;
  # rgb/rgba forms
  s/rgb\(128,\s*255,\s*248\)/rgb(45, 212, 255)/gi;
  s/rgba\(127,\s*105,\s*255/rgba(0, 181, 255/gi;
  s/rgba\(146,\s*118,\s*255/rgba(45, 212, 255/gi;
  s/rgba\(137,\s*126,\s*255/rgba(0, 181, 255/gi;
  s/rgb\(137,\s*126,\s*255\)/rgb(0, 181, 255)/gi;
  s/rgb\(101,\s*75,\s*248\)/rgb(0, 102, 255)/gi;
  s/rgb\(22,\s*119,\s*255\)/rgb(0, 181, 255)/gi;
  s/rgba\(22,\s*119,\s*255/rgba(0, 181, 255/gi;
  s/rgb\(127,\s*86,\s*217\)/rgb(0, 181, 255)/gi;
  s/rgba\(76,\s*164,\s*231/rgba(0, 181, 255/gi;
  s/(?<!-)\b0,\s*190,\s*180\b/0, 181, 255/g;
' $COLOR_FILES 2>/dev/null || true

echo "==> Cleaning up .bak files"
find "$WEB" -name "*.bak" -type f -delete

echo "==> Runook RAG branding applied to $WEB"
