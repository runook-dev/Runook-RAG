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
import base64
import json
import os
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


def _encode_password(raw: str) -> str:
    """
    RAGFlow's web login RSA-decrypts the submitted password and the result is
    base64(raw_password) (see api/utils/crypt.py + user_api.login). The stored
    hash must therefore be generate_password_hash(base64(raw)). We mirror that
    here so accounts created by this script can log in via the web UI.
    """
    return base64.b64encode(raw.encode("utf-8")).decode("utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--nickname", required=True)
    ap.add_argument("--password", required=True)
    args = ap.parse_args()

    encoded_password = _encode_password(args.password)

    existing = UserService.query_user_by_email(args.email)
    if existing:
        user_id = existing[0].id
        # Reset password so it matches the web-login encoding scheme.
        UserService.update_user_password(user_id, encoded_password)
        tenants = UserTenantService.get_user_tenant_relation_by_user_id(user_id)
        owner = [t for t in tenants if t["role"] == "owner"]
        tenant_id = owner[0]["tenant_id"] if owner else user_id
    else:
        res = create_new_user(
            {
                "email": args.email,
                "nickname": args.nickname,
                "password": encoded_password,
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

    # Model provider is user-selected, consistent with RAGFlow: new tenants land
    # on the "Model providers" page and add whatever provider/key they want. We
    # only auto-configure a default provider when explicitly opted in via
    # RUNOOK_DEFAULT_LLM=gemini (off by default). Idempotent.
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    gemini_ready = False
    if gemini_key and os.environ.get("RUNOOK_DEFAULT_LLM", "").strip().lower() == "gemini":
        gemini_ready = _configure_gemini(token, gemini_key)

    print(json.dumps({"ok": True, "tenant_id": tenant_id, "api_token": token, "gemini": gemini_ready}))
    return 0


def _configure_gemini(token: str, api_key: str) -> bool:
    import urllib.request

    base = "http://localhost:9380/api/v1"
    hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def call(method: str, path: str, payload: dict) -> bool:
        try:
            req = urllib.request.Request(
                base + path, data=json.dumps(payload).encode(), headers=hdr, method=method
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode())
                return body.get("code") == 0
        except Exception:
            return False

    call("PUT", "/providers", {"provider_name": "Gemini"})
    call(
        "POST",
        "/providers/Gemini/instances",
        {"instance_name": "prod", "api_key": api_key, "base_url": "", "region": "", "model_info": []},
    )
    ok_chat = call(
        "PATCH",
        "/models/default",
        {"model_type": "chat", "model_provider": "Gemini", "model_instance": "prod", "model_name": "gemini-2.5-flash"},
    )
    ok_embed = call(
        "PATCH",
        "/models/default",
        {
            "model_type": "embedding",
            "model_provider": "Gemini",
            "model_instance": "prod",
            "model_name": "gemini-embedding-001",
        },
    )
    # Vision / image2text: gemini-2.5-flash is multimodal, so reuse it for image
    # understanding (PDF images, picture chunking, multimodal chat). The default
    # endpoint uses the model_type "vision" for this slot. Best-effort.
    call(
        "PATCH",
        "/models/default",
        {
            "model_type": "vision",
            "model_provider": "Gemini",
            "model_instance": "prod",
            "model_name": "gemini-2.5-flash",
        },
    )
    return ok_chat and ok_embed


if __name__ == "__main__":
    raise SystemExit(main())
