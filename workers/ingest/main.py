#!/usr/bin/env python3
"""Job Signal ingestion workers — poll ATS boards + optional JSearch."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import yaml

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("JOB_SIGNAL_DB", ROOT / "data" / "job-signal.db"))
YAML_PATH = ROOT / "data" / "companies.yaml"

ROLE_RULES = [
    ("machine_learning", r"machine learning|ml engineer|mlops|llm|genai|ai engineer|deep learning"),
    ("data_science", r"data scientist|data science|analytics engineer|data analyst"),
    ("devops_sre", r"devops|sre|site reliability|platform engineer|infrastructure engineer"),
    ("security", r"security engineer|appsec|infosec|cybersecurity"),
    ("product_management", r"product manager|product owner|group product"),
    ("design", r"product designer|ux designer|ui designer"),
    ("software_engineering", r"software engineer|backend|frontend|full[\s-]?stack|staff engineer|principal engineer"),
    ("sales", r"account executive|\bsales\b|\bsdr\b|\bbdr\b"),
    ("marketing", r"marketing|growth|demand gen"),
    ("customer_success", r"customer success|solutions engineer|technical account"),
    ("finance", r"finance|accountant|fp&a"),
    ("people_hr", r"recruiter|people ops|human resources|talent"),
    ("operations", r"operations|bizops|chief of staff"),
    ("legal", r"counsel|attorney|legal|compliance"),
    ("research", r"research scientist|research engineer"),
]

DOMAIN_HINTS = {
    "ai_ml",
    "fintech",
    "healthcare",
    "infrastructure",
    "observability",
    "consumer",
    "enterprise",
    "marketplace",
    "media",
    "defense",
    "retail",
    "productivity",
    "design_tools",
    "creative_tools",
    "climate",
    "other",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def week_key() -> str:
    dt = datetime.now(timezone.utc)
    return f"{dt.strftime('%G')}-W{dt.strftime('%V')}"


def month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def quarter_key() -> str:
    dt = datetime.now(timezone.utc)
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def classify_role(title: str) -> str:
    for family, pat in ROLE_RULES:
        if re.search(pat, title, re.I):
            return family
    return "other"


def classify_domain(title: str, hint: str | None) -> str:
    if hint in DOMAIN_HINTS:
        return hint  # type: ignore
    blob = f"{title} {hint or ''}"
    checks = [
        ("ai_ml", r"\b(ai|ml|llm|machine learning)\b"),
        ("fintech", r"fintech|payments|banking"),
        ("infrastructure", r"cloud|infra|kubernetes"),
        ("defense", r"defense|aerospace"),
        ("media", r"streaming|media|gaming"),
    ]
    for domain, pat in checks:
        if re.search(pat, blob, re.I):
            return domain
    return "other"


class Client:
    def __init__(self) -> None:
        self.http = httpx.Client(
            timeout=30.0,
            headers={"User-Agent": "job-signal/1.0 (personal research)", "Accept": "application/json"},
        )

    def greenhouse(self, slug: str) -> list[dict[str, Any]]:
        r = self.http.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", params={"content": "true"})
        r.raise_for_status()
        out = []
        for j in r.json().get("jobs", []):
            loc = (j.get("location") or {}).get("name")
            out.append(
                {
                    "source": "greenhouse",
                    "external_id": str(j["id"]),
                    "title": j["title"],
                    "location": loc,
                    "remote": bool(re.search(r"remote", f"{loc or ''} {j['title']}", re.I)),
                    "url": j.get("absolute_url"),
                }
            )
        return out

    def lever(self, slug: str) -> list[dict[str, Any]]:
        r = self.http.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"})
        r.raise_for_status()
        out = []
        for j in r.json():
            loc = (j.get("categories") or {}).get("location")
            out.append(
                {
                    "source": "lever",
                    "external_id": j["id"],
                    "title": j["text"],
                    "location": loc,
                    "remote": bool(re.search(r"remote", f"{j.get('workplaceType','')} {loc or ''}", re.I)),
                    "url": j.get("hostedUrl"),
                }
            )
        return out

    def ashby(self, slug: str) -> list[dict[str, Any]]:
        r = self.http.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}", params={"includeCompensation": "true"})
        r.raise_for_status()
        out = []
        for j in r.json().get("jobs", []):
            out.append(
                {
                    "source": "ashby",
                    "external_id": j["id"],
                    "title": j["title"],
                    "location": j.get("location"),
                    "remote": bool(j.get("isRemote")),
                    "url": j.get("jobUrl") or f"https://jobs.ashbyhq.com/{slug}/{j['id']}",
                }
            )
        return out

    def workday(self, board_url: str) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        offset = 0
        limit = 20
        base = re.sub(r"/wday/cxs/.*$", "", board_url)
        for _ in range(10):
            r = self.http.post(
                board_url,
                json={"appliedFacets": {}, "limit": limit, "offset": offset, "searchText": ""},
                headers={"Content-Type": "application/json"},
            )
            r.raise_for_status()
            postings = r.json().get("jobPostings", [])
            if not postings:
                break
            for p in postings:
                ext = (p.get("bulletFields") or [None])[0] or p.get("externalPath") or p.get("title")
                path = p.get("externalPath") or ""
                loc = p.get("locationsText")
                title = p.get("title") or "Untitled"
                out.append(
                    {
                        "source": "workday",
                        "external_id": str(ext),
                        "title": title,
                        "location": loc,
                        "remote": bool(re.search(r"remote", f"{loc or ''} {title}", re.I)),
                        "url": f"{base}{path}" if path else None,
                    }
                )
            offset += limit
            if len(postings) < limit:
                break
        return out

    def jsearch(self, query: str, api_key: str) -> list[dict[str, Any]]:
        r = self.http.get(
            "https://jsearch.p.rapidapi.com/search",
            params={"query": query, "page": "1", "num_pages": "1"},
            headers={"x-rapidapi-key": api_key, "x-rapidapi-host": "jsearch.p.rapidapi.com"},
        )
        r.raise_for_status()
        out = []
        for j in r.json().get("data") or []:
            loc = ", ".join(x for x in [j.get("job_city"), j.get("job_country")] if x)
            out.append(
                {
                    "source": "jsearch",
                    "external_id": j["job_id"],
                    "title": j["job_title"],
                    "company_name": j.get("employer_name") or "Unknown",
                    "location": loc or None,
                    "remote": bool(j.get("job_is_remote")),
                    "url": j.get("job_apply_link"),
                }
            )
        return out


def ensure_schema(conn: sqlite3.Connection) -> None:
    # Tables created by TS migrate; create minimal if missing
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          ats_type TEXT NOT NULL,
          board_slug TEXT,
          board_url TEXT,
          domain_hint TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS job_postings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          external_id TEXT NOT NULL,
          company_id INTEGER,
          company_name TEXT NOT NULL,
          title TEXT NOT NULL,
          role_family TEXT NOT NULL,
          domain TEXT NOT NULL,
          location TEXT,
          remote INTEGER DEFAULT 0,
          url TEXT,
          first_seen TEXT NOT NULL,
          last_seen TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          UNIQUE(source, external_id)
        );
        CREATE TABLE IF NOT EXISTS job_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period_type TEXT NOT NULL,
          period_key TEXT NOT NULL,
          source TEXT NOT NULL,
          company_id INTEGER,
          company_name TEXT,
          role_family TEXT NOT NULL,
          domain TEXT NOT NULL,
          active_count INTEGER NOT NULL DEFAULT 0,
          new_count INTEGER NOT NULL DEFAULT 0,
          captured_at TEXT NOT NULL,
          UNIQUE(period_type, period_key, source, company_id, role_family, domain)
        );
        """
    )


def upsert_job(conn: sqlite3.Connection, job: dict[str, Any], company: dict[str, Any] | None) -> int:
    ts = now_iso()
    company_id = company["id"] if company else None
    company_name = company["name"] if company else job.get("company_name") or "Unknown"
    hint = company.get("domain_hint") if company else None
    role = classify_role(job["title"])
    domain = classify_domain(job["title"], hint)
    cur = conn.execute(
        "SELECT id FROM job_postings WHERE source=? AND external_id=?",
        (job["source"], job["external_id"]),
    ).fetchone()
    if cur:
        conn.execute(
            """UPDATE job_postings SET title=?, company_id=?, company_name=?, role_family=?, domain=?,
               location=?, remote=?, url=?, last_seen=?, is_active=1 WHERE id=?""",
            (
                job["title"],
                company_id,
                company_name,
                role,
                domain,
                job.get("location"),
                1 if job.get("remote") else 0,
                job.get("url"),
                ts,
                cur[0],
            ),
        )
        return int(cur[0])
    cur = conn.execute(
        """INSERT INTO job_postings
           (source, external_id, company_id, company_name, title, role_family, domain, location, remote, url, first_seen, last_seen, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)""",
        (
            job["source"],
            job["external_id"],
            company_id,
            company_name,
            job["title"],
            role,
            domain,
            job.get("location"),
            1 if job.get("remote") else 0,
            job.get("url"),
            ts,
            ts,
        ),
    )
    return int(cur.lastrowid)


def write_snapshots(conn: sqlite3.Connection) -> None:
    ts = now_iso()
    today = day_key()
    rows = conn.execute(
        "SELECT source, company_id, company_name, role_family, domain, first_seen FROM job_postings WHERE is_active=1"
    ).fetchall()
    buckets: dict[tuple, dict[str, int]] = {}
    for source, company_id, company_name, role_family, domain, first_seen in rows:
        key = (source, company_id, company_name, role_family, domain)
        b = buckets.setdefault(key, {"active": 0, "new": 0})
        b["active"] += 1
        if (first_seen or "")[:10] == today:
            b["new"] += 1
    periods = [("day", day_key()), ("week", week_key()), ("month", month_key()), ("quarter", quarter_key())]
    for period_type, period_key in periods:
        for (source, company_id, company_name, role_family, domain), counts in buckets.items():
            conn.execute(
                """INSERT INTO job_snapshots
                   (period_type, period_key, source, company_id, company_name, role_family, domain, active_count, new_count, captured_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(period_type, period_key, source, company_id, role_family, domain)
                   DO UPDATE SET active_count=excluded.active_count, new_count=excluded.new_count,
                     captured_at=excluded.captured_at, company_name=excluded.company_name""",
                (
                    period_type,
                    period_key,
                    source,
                    company_id,
                    company_name,
                    role_family,
                    domain,
                    counts["active"],
                    counts["new"],
                    ts,
                ),
            )


def seed_companies_if_empty(conn: sqlite3.Connection) -> None:
    n = conn.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    if n:
        return
    if not YAML_PATH.exists():
        return
    doc = yaml.safe_load(YAML_PATH.read_text())
    ts = now_iso()
    for c in doc.get("companies", []):
        conn.execute(
            """INSERT OR IGNORE INTO companies
               (name, ats_type, board_slug, board_url, domain_hint, enabled, created_at, updated_at)
               VALUES (?,?,?,?,?,1,?,?)""",
            (c["name"], c["ats_type"], c.get("board_slug"), c.get("board_url"), c.get("domain_hint"), ts, ts),
        )


def main() -> int:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    ensure_schema(conn)
    seed_companies_if_empty(conn)
    conn.commit()

    client = Client()
    companies = conn.execute(
        "SELECT id, name, ats_type, board_slug, board_url, domain_hint FROM companies WHERE enabled=1"
    ).fetchall()

    seen: set[int] = set()
    errors: list[str] = []
    upserted = 0

    for row in companies:
        company = {
            "id": row[0],
            "name": row[1],
            "ats_type": row[2],
            "board_slug": row[3],
            "board_url": row[4],
            "domain_hint": row[5],
        }
        try:
            jobs: list[dict[str, Any]] = []
            if company["ats_type"] == "greenhouse" and company["board_slug"]:
                jobs = client.greenhouse(company["board_slug"])
            elif company["ats_type"] == "lever" and company["board_slug"]:
                jobs = client.lever(company["board_slug"])
            elif company["ats_type"] == "ashby" and company["board_slug"]:
                jobs = client.ashby(company["board_slug"])
            elif company["ats_type"] == "workday" and company["board_url"]:
                jobs = client.workday(company["board_url"])
            else:
                continue
            for job in jobs:
                jid = upsert_job(conn, job, company)
                seen.add(jid)
                upserted += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"{company['name']} ({company['ats_type']}): {e}")

    # deactivate missing ATS jobs
    if seen:
        active = conn.execute("SELECT id, source FROM job_postings WHERE is_active=1").fetchall()
        ats = {"greenhouse", "lever", "ashby", "workday"}
        for jid, source in active:
            if source in ats and jid not in seen:
                conn.execute("UPDATE job_postings SET is_active=0 WHERE id=?", (jid,))

    api_key = os.environ.get("JSEARCH_API_KEY")
    if api_key:
        queries = []
        if YAML_PATH.exists():
            doc = yaml.safe_load(YAML_PATH.read_text())
            queries = doc.get("jsearch_queries") or []
        if not queries:
            queries = ["software engineer remote", "machine learning engineer", "product manager"]
        try:
            for q in queries:
                for job in client.jsearch(q, api_key):
                    jid = upsert_job(conn, job, None)
                    seen.add(jid)
                    upserted += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"jsearch: {e}")

    write_snapshots(conn)
    conn.commit()
    print(json.dumps({"upserted": upserted, "seen": len(seen), "errors": errors, "db": str(DB_PATH)}, indent=2))
    return 0 if not errors or upserted else 1


if __name__ == "__main__":
    sys.exit(main())
