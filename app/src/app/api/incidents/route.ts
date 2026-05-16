import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

interface IncidentRow {
  id: string;
  service_id: string;
  bug_type: string;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
  root_cause: string | null;
  fix_summary: string | null;
  commit_sha: string | null;
  test_file: string | null;
}

export function GET() {
  const dbPath = path.resolve(process.cwd(), '..', 'sentinel.db');
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare('SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50')
      .all() as IncidentRow[];
    return NextResponse.json(rows);
  } finally {
    db.close();
  }
}
