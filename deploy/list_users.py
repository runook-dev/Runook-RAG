#!/usr/bin/env python3
"""
List all RAGFlow users as JSON (for account reconciliation / admin roster).

  docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/list_users.py

Output: JSON array of {id, email, nickname, is_active, login_channel, is_superuser, create_date}.
Note: id == owner tenant id for accounts created via provisioning.
"""
import json
import sys

sys.path.insert(0, "/ragflow")

from api.db.db_models import DB, User  # noqa: E402


def main() -> int:
    out = []
    with DB.connection_context():
        for u in User.select():
            out.append(
                {
                    "id": u.id,
                    "email": (u.email or "").lower(),
                    "nickname": u.nickname,
                    "is_active": str(u.is_active),
                    "login_channel": u.login_channel,
                    "is_superuser": bool(u.is_superuser),
                    "create_date": str(u.create_date),
                }
            )
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
