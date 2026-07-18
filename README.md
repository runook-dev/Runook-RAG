# Runook RAG

Runook RAG is the [RAGFlow](https://github.com/infiniflow/ragflow) engine
(Apache-2.0) shipped as a **Runook-branded product**. We treat RAGFlow as the
engine and apply a thin branding overlay (logo, name, favicon, colors), then
bake it into our own Docker image. RAGFlow itself is kept essentially
unmodified so upstream updates stay easy to adopt.

## Architecture

```
Customer browser
  → app.runook.com              Caddy (HTTPS) on EC2
  → RAGFlow nginx (branded UI + REST API, one origin)
  → docker compose stack        engine + MySQL + Elasticsearch + MinIO + Redis
  → LLM / embedding provider    Google Gemini (per-tenant cost tracked)
```

- One customer = one RAGFlow tenant (data isolated by `tenant_id`).
- The product UI is RAGFlow's own, rebranded to Runook. No separate frontend to
  maintain.

## Repository layout

| Path         | What it is                                                          |
|--------------|---------------------------------------------------------------------|
| `branding/`  | The Runook overlay: logo + `apply-branding.sh` (small, mergeable)   |
| `deploy/`    | Image build (`Dockerfile.runook`, `build-image.sh`), engine startup, provisioning, and `WORKFLOW.md` |
| `ragflow/`   | Upstream RAGFlow clone — gitignored; build source + reference       |
| `portal/`    | **Deprecated.** Earlier custom Next.js portal + usage-metering gateway. Kept for reference / possible future metering layer. See `portal/DEPRECATED.md`. |

## Quick start

Build the branded image and run the stack (see `deploy/WORKFLOW.md` for the full
dev/build/ship loop and upstream-upgrade steps):

```bash
bash deploy/build-image.sh local          # apply branding + build runook-rag:local
cd deploy && cp engine.env.example engine.env   # set RAG_DOMAIN, first boot uses defaults
sudo bash start-engine.sh                 # start stack + Caddy HTTPS
```

Provision a customer tenant + API token:

```bash
docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python \
  /ragflow/provision_tenant.py --email a@b.com --nickname "Acme" --password 'secret'
```

## LLM provider

Default is **Google Gemini** (`gemini-2.5-flash` chat, `gemini-embedding-001`
embeddings), configured per tenant via RAGFlow's provider API. One company key
is used; per-tenant token usage is tracked in RAGFlow.

## Live environment (current)

- Engine host: EC2 `i-0aed99c285de295b3`, Elastic IP `44.213.154.112`
- Test URL: `https://rag-internal.runook.com` (branded UI + API)
- Production URL: `app.runook.com` (to be flipped from the old portal to this engine)

See `SETUP-AWS.md` for the AWS resources and what still needs a human.
