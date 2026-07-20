#!/usr/bin/env python3
"""
List all RAGFlow users as JSON, for account reconciliation / admin roster.

Runs INSIDE the ragflow container and connects to MySQL using the same env
credentials RAGFlow uses (MYSQL_HOST/MYSQL_PASSWORD/...). Uses pymysql directly
(no heavy RAGFlow import) so it returns in ~1s.

  docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/list_users.py
"""
import json
import os
import sys


def main() -> int:
    import pymysql

    conn = pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "mysql"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DBNAME", "rag_flow"),
        connect_timeout=8,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, nickname, is_active, login_channel, is_superuser, create_date FROM user"
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "email": (r["email"] or "").lower(),
                "nickname": r["nickname"],
                "is_active": str(r["is_active"]),
                "login_channel": r["login_channel"],
                "is_superuser": bool(r["is_superuser"]),
                "create_date": str(r["create_date"]),
            }
        )
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
