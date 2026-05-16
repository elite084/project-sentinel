import { writeFileSync } from 'fs';
import type { ServiceName, BugType } from '@sentinel/shared';

const SERVICES: ServiceName[] = ['auth', 'payments', 'inventory'];
const BUG_TYPES: BugType[] = [
  'LATENCY',
  'ERROR_RATE',
  'MEMORY_LEAK',
  'CRASH',
  'CORRUPT_RESPONSE',
];

function pickRandom<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('cannot pick from an empty array');
  return item;
}

const service = pickRandom(SERVICES);
const bugType = pickRandom(BUG_TYPES);

const state = {
  active: true,
  service,
  bugType,
  injectedAt: new Date().toISOString(),
};

writeFileSync('.chaos-state.json', JSON.stringify(state, null, 2));

console.log(`\x1b[31m[chaos]\x1b[0m Injected \x1b[33m${bugType}\x1b[0m into \x1b[36m${service}\x1b[0m`);
console.log('        Run \x1b[2mpnpm chaos:reset\x1b[0m to restore normal operation.');
