import { NextResponse } from 'next/server';
import path from 'path';
import { existsSync } from 'node:fs';

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
  if (!existsSync(dbPath)) return NextResponse.json([]);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare('SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50')
        .all() as IncidentRow[];
      return NextResponse.json(rows);
    } finally {
      db.close();
    }
  } catch {
    return NextResponse.json([]);
  }
}
