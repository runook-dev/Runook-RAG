# Deprecated: custom portal

This `portal/` directory was an earlier approach: a custom Next.js customer
portal (login, knowledge bases, chat) plus a gateway that proxied RAGFlow behind
per-tenant usage quotas, with customer/usage state in DynamoDB.

**We pivoted.** The product is now the RAGFlow engine itself, rebranded to
Runook (see `../branding/` and `../deploy/`). RAGFlow's own UI is more complete
than this portal, and shipping it as a branded Docker image is simpler to build,
run, and keep in sync with upstream.

This code is kept, not deleted, because its **usage-metering gateway** (monthly
token quotas per plan, enforced at a proxy in front of the engine) is a likely
phase-2 need for renting to customers. If/when we want hard per-tenant limits,
this is a working starting point.

Nothing here is deployed anymore. The Amplify app that served it can be removed
once `app.runook.com` is flipped to the engine.
