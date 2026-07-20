#!/usr/bin/env python3
"""
Fast in-container quota / account tool (pymysql; no heavy RAGFlow import).

  docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/quota_tool.py metrics  <tenant_id>
  docker exec ... quota_tool.py usage    <tenant_id>   # credits only (compat)
  docker exec ... quota_tool.py suspend  <tenant_id>
  docker exec ... quota_tool.py activate <tenant_id>

metrics -> {credits, knowledge_bases, storage_gb, seats}
1 credit == 1000 LLM tokens. tenant_id == owner user id.
"""
import json
import os
import sys

CREDIT_TOKENS = 1000


def connect():
    import pymysql

    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "mysql"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DBNAME", "rag_flow"),
        connect_timeout=8,
        autocommit=True,
    )


def scalar(cur, sql, args):
    cur.execute(sql, args)
    row = cur.fetchone()
    return (row[0] if row and row[0] is not None else 0)


def metrics(tenant_id: str) -> dict:
    conn = connect()
    try:
        with conn.cursor() as cur:
            tokens = scalar(cur, "SELECT COALESCE(SUM(used_tokens),0) FROM tenant_llm WHERE tenant_id=%s", (tenant_id,))
            kbs = scalar(cur, "SELECT COUNT(*) FROM knowledgebase WHERE tenant_id=%s", (tenant_id,))
            seats = scalar(cur, "SELECT COUNT(*) FROM user_tenant WHERE tenant_id=%s AND status='1'", (tenant_id,))
            storage = scalar(
                cur,
                "SELECT COALESCE(SUM(d.size),0) FROM document d "
                "JOIN knowledgebase k ON d.kb_id=k.id WHERE k.tenant_id=%s",
                (tenant_id,),
            )
    finally:
        conn.close()
    return {
        "credits": int(tokens) // CREDIT_TOKENS,
        "knowledge_bases": int(kbs),
        "seats": int(seats),
        "storage_gb": round(int(storage) / 1_000_000_000, 4),
    }


def set_active(tenant_id: str, active: bool) -> bool:
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user SET is_active=%s WHERE id=%s", ("1" if active else "0", tenant_id))
    finally:
        conn.close()
    return True


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: quota_tool.py <metrics|usage|suspend|activate> <tenant_id>"}))
        return 1
    cmd, tid = sys.argv[1], sys.argv[2]
    try:
        if cmd == "metrics":
            print(json.dumps({"ok": True, "tenant_id": tid, **metrics(tid)}))
        elif cmd == "usage":
            print(json.dumps({"ok": True, "tenant_id": tid, "used_credits": metrics(tid)["credits"]}))
        elif cmd in ("suspend", "activate"):
            set_active(tid, cmd == "activate")
            print(json.dumps({"ok": True, "tenant_id": tid, "active": cmd == "activate"}))
        else:
            print(json.dumps({"ok": False, "error": f"unknown command {cmd}"}))
            return 1
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
