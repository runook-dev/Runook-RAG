# Runook RAG — build & iterate workflow

Runook RAG = the RAGFlow engine + a thin **Runook branding overlay**, shipped as
our own Docker image `runook-rag`. We keep RAGFlow itself essentially unmodified
so upstream updates stay easy to adopt.

```
branding/            # the entire Runook overlay (small, reviewable)
  logo.svg           # Runook logo (used for nav, favicon, login, chat avatar)
  favicon.ico
  apply-branding.sh  # patches a RAGFlow web checkout: logo, title, name, colors
deploy/
  Dockerfile.runook  # rebuilds branded web, layers onto official image
  build-image.sh     # one-click: apply branding + docker build runook-rag
  start-engine.sh    # runs the stack + Caddy HTTPS (serves branded UI + API)
  provision_tenant.py# create a customer tenant + API token inside the container
ragflow/             # upstream clone (gitignored; reference + build source)
```

## Three ways to work, fastest first

### 1. Fast UI iteration (seconds) — dev hot-reload

For tweaking branding/UI without rebuilding Docker. Run RAGFlow's web dev server
against the live engine API:

```bash
cd ragflow
bash ../branding/apply-branding.sh .     # apply Runook overlay to the checkout
cd web
npm install                              # first time only
# point the dev server at the running engine:
VITE_BASE_URL=https://rag-internal.runook.com npm run dev
# open http://localhost:5173  — edits hot-reload instantly
```

Adjust the overlay in `branding/` (or the files directly to experiment), see it
live, then fold the change back into `branding/apply-branding.sh`.

### 2. Build the branded image (a few minutes)

When the branding is where you want it:

```bash
bash deploy/build-image.sh local
# -> builds runook-rag:local (branded web layered on infiniflow/ragflow)
```

### 3. Ship it (on the EC2 engine host)

```bash
cd Runook-RAG
git pull
bash deploy/build-image.sh local        # rebuild image with latest branding
cd deploy && sudo bash start-engine.sh  # restart stack on the new image
```

No external CI pipeline; deploy is "build image + restart", fully under our
control. (The agent can run all of this remotely via AWS SSM on the EC2 host.)

## Upgrading to a newer RAGFlow release

```bash
cd ragflow && git fetch --tags && git checkout vX.Y.Z && cd ..
# bump the base image tag used by the build:
RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z bash deploy/build-image.sh local
cd deploy && sudo bash start-engine.sh
```

`apply-branding.sh` re-applies cleanly on the new source. If upstream moved a
branded string/file, the script's `sed` for that spot becomes a no-op — check
the build output and update that one line in `apply-branding.sh`.

## What the overlay touches (for merge awareness)

- `web/public/logo.svg`, `web/public/favicon.ico`
- `web/index.html` (`<title>`), `web/src/conf.json` (`appName`)
- Hardcoded brand text: `login-next/index.tsx`, `admin/login.tsx`,
  `home/banner.tsx`, `next-search/ragflow-logo.tsx`, locale `admin.title`
- `web/tailwind.css` accent color + the two brand-gradient spots

Everything else in RAGFlow is untouched.
