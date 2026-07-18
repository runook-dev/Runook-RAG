# Runook RAG — Engine deployment (EC2)

This directory deploys the **RAGFlow engine** on a single EC2 instance. The
engine is internal: only the Runook portal (`app.runook.com`) talks to it, using
per-tenant API tokens. Customers never reach it directly.

## Architecture

```
Customer browser
  → app.runook.com            (Next.js portal on AWS Amplify — Runook brand)
  → /api/rag/* gateway        (auth + quota check + usage metering)
  → rag-internal.runook.com   (Caddy HTTPS on EC2)
  → RAGFlow /api/v1           (docker compose: engine + MySQL + ES + MinIO + Redis)
  → LLM / embedding provider  (your OpenAI/DeepSeek key, billed per tenant)
```

## EC2 requirements

- Instance: **x86_64** (RAGFlow images are amd64 only). `t3.xlarge` (4 vCPU /
  16 GB) minimum; `m6i.xlarge` recommended.
- Disk: 100 GB gp3 EBS.
- OS: Ubuntu 22.04/24.04 LTS.
- Security group inbound: `443` from anywhere (Caddy), `22` from your IP only.
  Do **not** expose port 80/9380 (RAGFlow) publicly.

## One-time setup

1. Launch the EC2 instance, point `rag-internal.runook.com` (Route 53 A record)
   at its Elastic IP.
2. SSH in, then:

   ```bash
   git clone https://github.com/runook-dev/Runook-RAG.git
   cd Runook-RAG/deploy
   sudo bash setup-ec2.sh
   ```

3. Configure secrets:

   ```bash
   cp engine.env.example engine.env
   # edit engine.env: set your LLM API key, MinIO/MySQL passwords, domain
   bash start-engine.sh
   ```

4. Verify: `curl -sk https://rag-internal.runook.com/api/v1/system/config` should
   respond once the stack is healthy.

## Provisioning a customer

After the engine is up, create a RAGFlow tenant + API token and register the
customer in the portal store. See `../portal/scripts/create-customer.mjs`.
