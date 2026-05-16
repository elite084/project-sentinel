import { NextResponse } from 'next/server';
import path from 'path';
import { existsSync } from 'node:fs';

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
  if (!existsSync(dbPath)) return NextResponse.json([]);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db.prepare('SELECT * FROM services ORDER BY id').all() as ServiceRow[];
      return NextResponse.json(rows);
    } finally {
      db.close();
    }
  } catch {
    return NextResponse.json([]);
  }
}
