import { existsSync, readFileSync, unlinkSync } from 'fs';

const STATE_FILE = '.chaos-state.json';

if (existsSync(STATE_FILE)) {
  const raw = readFileSync(STATE_FILE, 'utf-8');
  const state = JSON.parse(raw) as { service?: string; bugType?: string };
  unlinkSync(STATE_FILE);
  console.log(
    `\x1b[32m[chaos-reset]\x1b[0m Cleared \x1b[33m${state.bugType ?? 'unknown'}\x1b[0m` +
    ` from \x1b[36m${state.service ?? 'unknown'}\x1b[0m`,
  );
} else {
  console.log('\x1b[2m[chaos-reset]\x1b[0m No active chaos state found.');
}
