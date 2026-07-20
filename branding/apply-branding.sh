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

echo "==> In-product tier badge"
# Self-contained script: reads the logged-in user's email from localStorage and
# shows their Runook plan as a pill near the logo. Same-origin /runook/plan is
# served by the billing service via Caddy. Idempotent (guarded by a marker).
if ! grep -q "RUNOOK_TIER_BADGE" "$WEB/index.html"; then
  perl -0777 -pi -e '
    my $s = q{  <script>
  /* RUNOOK_TIER_BADGE */
  (function(){
    function email(){try{return (JSON.parse(localStorage.getItem("userInfo")||"{}").email||"").toLowerCase();}catch(e){return "";}}
    function bar(label,used,limit){
      var unl = !limit || limit<=0;
      var pct = unl?0:Math.min(100,Math.round(used/limit*100));
      var right = unl?"unlimited":(used+" / "+limit);
      return "<div style=\"margin:8px 0\"><div style=\"display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa\"><span>"+label+"</span><span>"+right+"</span></div><div style=\"height:6px;background:#1f2023;border-radius:999px;margin-top:4px;overflow:hidden\"><div style=\"height:100%;width:"+pct+"%;background:linear-gradient(90deg,#2dd4ff,#0066ff)\"></div></div></div>";
    }
    var done=false, panel=null;
    async function openPanel(e,anchor){
      if(panel){panel.remove();panel=null;return;}
      var r=await fetch("/runook/usage?email="+encodeURIComponent(e));
      var d=await r.json();
      if(!d||!d.plan)return;
      panel=document.createElement("div");
      panel.style.cssText="position:fixed;top:58px;left:16px;z-index:9999;width:300px;background:#0a0a0a;border:1px solid #1f2023;border-radius:14px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.5);color:#fafafa;font-family:system-ui,sans-serif";
      var u=d.usage,l=d.limits;
      var gb=(u.storage_gb||0);
      var html="<div style=\"font-weight:600;margin-bottom:6px\">"+d.label+" plan</div>";
      html+=bar("Credits this month",u.credits,l.credits);
      html+=bar("Knowledge bases",u.knowledge_bases,l.knowledge_bases);
      html+=bar("Storage (GB)",gb,l.storage_gb);
      html+=bar("Seats",u.seats,l.seats);
      if(d.manageable){html+="<button id=\"runook-manage\" style=\"margin-top:10px;width:100%;padding:8px;border:0;border-radius:8px;font-size:13px;font-weight:600;color:#fff;background:linear-gradient(135deg,#2dd4ff,#0066ff);cursor:pointer\">Manage subscription</button>";}
      else{html+="<a href=\"https://pay.runook.com\" target=\"_blank\" style=\"display:block;margin-top:10px;text-align:center;font-size:13px;color:#00b5ff\">Upgrade plan</a>";}
      panel.innerHTML=html;
      document.body.appendChild(panel);
      var mb=document.getElementById("runook-manage");
      if(mb){mb.onclick=async function(){var pr=await fetch("/runook/portal?email="+encodeURIComponent(e));var pd=await pr.json();if(pd.url)window.location.href=pd.url;};}
      document.addEventListener("click",function h(ev){if(panel&&!panel.contains(ev.target)&&ev.target!==anchor){panel.remove();panel=null;document.removeEventListener("click",h);}});
    }
    async function place(){
      if(done)return;
      var e=email(); if(!e)return;
      var logo=document.querySelector("img[src=\"/logo.svg\"]"); if(!logo)return;
      done=true;
      try{
        var r=await fetch("/runook/plan?email="+encodeURIComponent(e));
        var d=await r.json();
        if(!d||!d.label){done=false;return;}
        var pill=document.createElement("button");
        pill.textContent=d.label+" plan";
        pill.style.cssText="margin-left:10px;padding:3px 12px;border:0;border-radius:999px;font-size:12px;font-weight:600;color:#fff;background:linear-gradient(135deg,#2dd4ff,#0066ff);white-space:nowrap;align-self:center;cursor:pointer";
        pill.onclick=function(ev){ev.stopPropagation();openPanel(e,pill);};
        var host=logo.closest("a")||logo.parentElement;
        var target=(host&&host.parentElement)?host.parentElement:host;
        if(target&&!target.querySelector("[data-runook-pill]")){pill.setAttribute("data-runook-pill","1");target.appendChild(pill);}
        else{done=false;}
      }catch(err){done=false;}
    }
    document.addEventListener("DOMContentLoaded",function(){place();new MutationObserver(place).observe(document.body,{childList:true,subtree:true});});
  })();
  </script>
};
    s{</body>}{$s</body>};
  ' "$WEB/index.html"
fi

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
echo "==> Login page: tagline, background, Google logo"
LOGIN="$WEB/src/pages/login-next/index.tsx"
# Our own tagline (replaces RAGFlow's "A leading RAG engine for LLM context").
for f in "$WEB"/src/locales/*.ts; do
  [[ -f "$f" ]] || continue
  sed -i.bak "s#A leading RAG engine for LLM context#Private, grounded AI over your business knowledge#g" "$f"
done
# Replace RAGFlow's circuit background with a Runook radial-gradient backdrop
# (distinct dark + blue-glow look, closer to runook.com).
if [[ -f "$LOGIN" ]]; then
  perl -0777 -pi -e "s|<BgSvg isPaused />|<div className=\"pointer-events-none absolute inset-0 -z-10\" style={{ background: 'radial-gradient(60% 55% at 50% 0%, rgba(0,181,255,0.20), transparent 70%), radial-gradient(45% 45% at 12% 15%, rgba(0,102,255,0.16), transparent 70%), radial-gradient(45% 45% at 88% 12%, rgba(45,212,255,0.12), transparent 70%), #000000' }} />|g" "$LOGIN"
fi
# Real Google "G" logo for the "Sign in with Google" button (upstream ships a
# SerpApi logo under this filename).
[[ -f "$HERE/google.svg" ]] && cp "$HERE/google.svg" "$WEB/src/assets/svg/google.svg" || true
# Remove the boxed border around the OAuth buttons (cleaner look).
if [[ -f "$LOGIN" ]]; then
  perl -0777 -pi -e "s/\\? 'py-8' : 'mt-3 border'/? 'py-8' : 'mt-3'/g" "$LOGIN"
fi

echo "==> Settings sidebar: Billing entry"
SIDEBAR="$WEB/src/pages/user-setting/sidebar/index.tsx"
if [[ -f "$SIDEBAR" ]]; then
python3 - "$SIDEBAR" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p).read()
if "runook/account" not in s:
    s = s.replace("  Columns3Cog,", "  Columns3Cog,\n  LucideCreditCard,", 1)
    li = (
        '              <li className="w-full md:w-auto">\n'
        '                <Button block variant="ghost" aria-label="Billing" className="relative h-10 text-base max-md:size-10 max-md:p-0 max-md:justify-center justify-start gap-2.5 px-2 md:px-3" onClick={() => window.open("/runook/account?email=" + encodeURIComponent(userInfo?.email || ""), "_blank")}>\n'
        '                  <span className="flex items-center gap-2.5 max-md:gap-0"><LucideCreditCard className="size-[1em]" /><span className="hidden md:inline">Billing</span></span>\n'
        '                </Button>\n'
        '              </li>\n'
        '        </ul>'
    )
    s = s.replace("        </ul>", li, 1)
    open(p, "w").write(s)
PYEOF
fi

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
