#!/usr/bin/env python3
"""
In-container quota tool for Runook RAG. Runs inside the RAGFlow container:

  docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/quota_tool.py usage <tenant_id>
  docker exec ... quota_tool.py suspend <tenant_id>
  docker exec ... quota_tool.py activate <tenant_id>

- usage:   prints JSON {"tenant_id","used_credits"} where 1 credit ~= 1000 tokens.
- suspend: deactivates the owner user so the tenant can no longer sign in / use APIs.
- activate: reactivates the owner user.

NOTE: tenant_id == owner user id for accounts created via provision_tenant.py.
Monthly reset is handled by the caller (compares against the plan's monthly
allowance and re-activates at cycle start). This is intentionally simple and
should be validated against your RAGFlow version on first deploy.
"""
import json
import sys

sys.path.insert(0, "/ragflow")

from api.db.services.tenant_llm_service import TenantLLMService  # noqa: E402
from api.db.services.user_service import UserService  # noqa: E402

CREDIT_TOKENS = 1000  # 1 credit == 1000 LLM tokens


def get_used_credits(tenant_id: str) -> int:
    total_tokens = 0
    try:
        for row in TenantLLMService.query(tenant_id=tenant_id):
            total_tokens += int(getattr(row, "used_tokens", 0) or 0)
    except Exception:
        pass
    return total_tokens // CREDIT_TOKENS


def set_active(user_id: str, active: bool) -> bool:
    try:
        # is_active uses "1" (active) / "0" (inactive) in RAGFlow.
        UserService.update_by_id(user_id, {"is_active": "1" if active else "0"})
        return True
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        return False


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: quota_tool.py <usage|suspend|activate> <tenant_id>"}))
        return 1
    cmd, tenant_id = sys.argv[1], sys.argv[2]
    if cmd == "usage":
        print(json.dumps({"ok": True, "tenant_id": tenant_id, "used_credits": get_used_credits(tenant_id)}))
        return 0
    if cmd in ("suspend", "activate"):
        ok = set_active(tenant_id, cmd == "activate")
        if ok:
            print(json.dumps({"ok": True, "tenant_id": tenant_id, "active": cmd == "activate"}))
        return 0 if ok else 1
    print(json.dumps({"ok": False, "error": f"unknown command {cmd}"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
