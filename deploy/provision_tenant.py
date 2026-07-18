#!/usr/bin/env python3
"""
Provision a RAGFlow tenant + API token from INSIDE the ragflow container.

This bypasses the HTTP layer (and its RSA password encryption + the
REGISTER_ENABLED gate) by calling RAGFlow's own service functions directly. It
creates a user (which auto-creates a 1:1 tenant) and mints a tenant-scoped API
token, then prints a single JSON line with the ids/token.

Run it like:
    docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python \
        /ragflow/provision_tenant.py --email a@b.com --nickname "Acme" --password 'secret'

Output (stdout, last line): {"ok": true, "tenant_id": "...", "api_token": "..."}
"""
import argparse
import json
import sys

sys.path.insert(0, "/ragflow")

from datetime import datetime

from api.db.services.user_service import UserService, UserTenantService  # noqa: E402
from api.db.joint_services.user_account_service import create_new_user  # noqa: E402
from api.db.services.api_service import APITokenService  # noqa: E402
from api.utils.api_utils import generate_confirmation_token  # noqa: E402
from common.time_utils import current_timestamp, datetime_format  # noqa: E402
from common import settings  # noqa: E402

# When run standalone (not via the server) RAGFlow's settings globals may be
# unpopulated, leaving tenant defaults like PARSERS as None (which violates the
# NOT NULL column). Initialize settings; fall back to a sane default set.
try:
    settings.init_settings()
except Exception:
    pass
if not settings.PARSERS:
    settings.PARSERS = (
        "naive:General,qa:Q&A,resume:Resume,manual:Manual,table:Table,paper:Paper,"
        "book:Book,laws:Laws,presentation:Presentation,picture:Picture,one:One,"
        "audio:Audio,email:Email,tag:Tag"
    )
for _attr in ("CHAT_MDL", "EMBEDDING_MDL", "ASR_MDL", "VISION_MDL", "RERANK_MDL"):
    if getattr(settings, _attr, None) is None:
        setattr(settings, _attr, "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--nickname", required=True)
    ap.add_argument("--password", required=True)
    args = ap.parse_args()

    existing = UserService.query_user_by_email(args.email)
    if existing:
        user_id = existing[0].id
        tenants = UserTenantService.get_user_tenant_relation_by_user_id(user_id)
        owner = [t for t in tenants if t["role"] == "owner"]
        tenant_id = owner[0]["tenant_id"] if owner else user_id
    else:
        res = create_new_user(
            {
                "email": args.email,
                "nickname": args.nickname,
                "password": args.password,
                "login_channel": "password",
                "is_superuser": False,
            }
        )
        if not res.get("success"):
            print(json.dumps({"ok": False, "error": "create_new_user failed"}))
            return 1
        tenant_id = res["user_info"]["id"]

    # Reuse an existing token if the tenant already has one, else mint one.
    existing_tokens = APITokenService.query(tenant_id=tenant_id)
    if existing_tokens:
        token = existing_tokens[0].token
    else:
        token = generate_confirmation_token()
        obj = {
            "tenant_id": tenant_id,
            "token": token,
            "beta": generate_confirmation_token().replace("ragflow-", "")[:32],
            "create_time": current_timestamp(),
            "create_date": datetime_format(datetime.now()),
            "update_time": None,
            "update_date": None,
        }
        if not APITokenService.save(**obj):
            print(json.dumps({"ok": False, "error": "APITokenService.save failed"}))
            return 1

    print(json.dumps({"ok": True, "tenant_id": tenant_id, "api_token": token}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
