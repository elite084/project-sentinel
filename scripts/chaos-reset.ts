/**
 * Chaos Reset — restores all files mutated by chaos.ts.
 * Usage: pnpm chaos:reset
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const REPO_ROOT   = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(__dirname, '.chaos-backups');
const INCIDENT_LOG = path.join(REPO_ROOT, 'docs', 'incident-history.log');

interface BackupEntry {
  incidentId:      string;
  timestamp:       string;
  service:         string;
  bugType:         string;
  filePath:        string;
  originalContent: string;
}

if (!existsSync(BACKUPS_DIR)) {
  console.log('No chaos backups found — nothing to reset.');
  process.exit(0);
}

const backupFiles = readdirSync(BACKUPS_DIR)
  .filter(f => f.endsWith('.json'))
  // Newest incident ID first — critical when the same file was mutated multiple
  // times, so each layer is unwound in reverse injection order.
  .sort()
  .reverse();

if (backupFiles.length === 0) {
  console.log('No chaos backups found — nothing to reset.');
  process.exit(0);
}

mkdirSync(path.dirname(INCIDENT_LOG), { recursive: true });

let restored = 0;
const failures: string[] = [];

for (const file of backupFiles) {
  const backupPath = path.join(BACKUPS_DIR, file);
  try {
    const backup: BackupEntry = JSON.parse(readFileSync(backupPath, 'utf-8'));

    writeFileSync(backup.filePath, backup.originalContent);

    const resetEntry = {
      incidentId: backup.incidentId,
      timestamp:  new Date().toISOString(),
      service:    backup.service,
      bugType:    backup.bugType,
      filePath:   path.relative(REPO_ROOT, backup.filePath).replace(/\\/g, '/'),
      status:     'RESET',
    };
    appendFileSync(INCIDENT_LOG, JSON.stringify(resetEntry) + '\n');

    unlinkSync(backupPath);

    console.log(
      `  ✓ ${backup.incidentId}  ${backup.bugType.padEnd(16)}` +
      `  services/${backup.service}/src/index.ts`,
    );
    restored++;
  } catch (err) {
    console.error(`  ✗ ${file}: ${(err as Error).message}`);
    failures.push(file);
  }
}

const failNote = failures.length > 0 ? `  ${failures.length} failure(s).` : '';
console.log(`\n  Reset ${restored} incident(s).${failNote}`);
