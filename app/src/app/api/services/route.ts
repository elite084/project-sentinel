import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

interface ServiceRow {
  id: string;
  port: number;
  status: string;
  last_check: string | null;
  uptime_seconds: number;
}

export function GET() {
  const dbPath = path.resolve(process.cwd(), '..', 'sentinel.db');
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare('SELECT * FROM services ORDER BY id').all() as ServiceRow[];
    return NextResponse.json(rows);
  } finally {
    db.close();
  }
}
