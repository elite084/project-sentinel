/**
 * Chaos Monkey — injects real source-level bugs into service files.
 * Usage: pnpm chaos:run
 */
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ServiceName, BugType } from '@sentinel/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(__dirname, '.chaos-backups');
const INCIDENT_LOG = path.join(REPO_ROOT, 'docs', 'incident-history.log');

// ── Utilities ──────────────────────────────────────────────────────────────

function generateIncidentId(): string {
  const epoch = Math.floor(Date.now() / 1000);
  const rand  = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INC-${epoch}-${rand}`;
}

function pickRandom<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('Cannot pick from empty array');
  return item;
}

function parseSource(content: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.ES2022, /* setParentNodes */ true);
}

// ── Mutation strategies ────────────────────────────────────────────────────

/**
 * SYNTAX_ERROR — remove the last closing brace so the file becomes
 * unparseable: "'}' expected" at the point where app.listen closes.
 */
function applySyntaxError(content: string): string {
  const idx = content.lastIndexOf('}');
  if (idx === -1) throw new Error('no closing brace found');
  return content.slice(0, idx) + content.slice(idx + 1);
}

/**
 * TYPE_MISMATCH — swap the numeric `uptime` in the explicitly-typed health
 * response for a string literal, triggering:
 *   Type 'string' is not assignable to type 'number'
 */
function applyTypeMismatch(content: string): string {
  const mutated = content.replace(
    /uptime: Math\.floor\([^)]+\)/,
    'uptime: "forever"',
  );
  if (mutated === content) throw new Error('uptime pattern not found');
  return mutated;
}

/**
 * LOGIC_ERROR — use the TypeScript AST to locate a binary operator and invert
 * it. Prefers runtime-visible comparisons (||, &&, <, >, <=, >=) over
 * identity checks so the misbehaviour is obvious at request time.
 */
function applyLogicError(content: string, filePath: string): string {
  const source = parseSource(content, path.basename(filePath));

  const INVERSIONS: Partial<Record<string, string>> = {
    '||': '&&', '&&': '||',
    '<=': '>=', '>=': '<=',
    '>':  '<',  '<':  '>',
    '===': '!==', '!==': '===',
  };
  const PREFERRED = new Set(['||', '&&', '<=', '>=', '>', '<']);

  interface Candidate { start: number; end: number; replacement: string; preferred: boolean }
  const candidates: Candidate[] = [];

  function visit(node: ts.Node): void {
    if (ts.isBinaryExpression(node)) {
      const op     = node.operatorToken;
      const opText = content.slice(op.getStart(source), op.getEnd());
      const inv    = INVERSIONS[opText];
      if (inv !== undefined) {
        candidates.push({
          start:       op.getStart(source),
          end:         op.getEnd(),
          replacement: inv,
          preferred:   PREFERRED.has(opText),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  if (candidates.length === 0) throw new Error('no invertible binary operator found');

  const pool   = candidates.filter(c => c.preferred);
  const target = pickRandom(pool.length > 0 ? pool : candidates);
  return content.slice(0, target.start) + target.replacement + content.slice(target.end);
}

/**
 * RENAME_VAR — use the TypeScript AST to find a local const whose identifier
 * appears ≥ 2 times (declaration + usage), then rename only the declaration.
 * All existing usages become "Cannot find name 'X'" errors.
 */
function applyRenameVar(content: string, filePath: string): string {
  const source = parseSource(content, path.basename(filePath));

  // Variables that are too broad or too load-bearing to rename usefully
  const SKIP = new Set([
    'PORT', 'SERVICE', 'app', 'logger', 'startedAt', 'err', 'res', 'req',
  ]);

  interface Candidate { name: string; declStart: number; declEnd: number }
  const candidates: Candidate[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.length >= 3 &&
      !SKIP.has(node.name.text)
    ) {
      const name        = node.name.text;
      const occurrences = (content.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
      if (occurrences >= 2) {
        candidates.push({
          name,
          declStart: node.name.getStart(source),
          declEnd:   node.name.getEnd(),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  if (candidates.length === 0) throw new Error('no suitable variable found (need name ≥3 chars, ≥2 occurrences)');

  const target = pickRandom(candidates);
  const broken = `_CHAOS_${target.name}`;

  // Only rename the declaration; usages still reference the original name.
  return content.slice(0, target.declStart) + broken + content.slice(target.declEnd);
}

/**
 * DELETE_IMPORT — strip the `createLogger` value import so the logger
 * construction call becomes "Cannot find name 'createLogger'".
 */
function applyDeleteImport(content: string): string {
  const mutated = content.replace(
    /^import \{ createLogger \} from '@sentinel\/shared';\r?\n/m,
    '',
  );
  if (mutated === content) throw new Error('createLogger import line not found');
  return mutated;
}

// ── Dispatch table ─────────────────────────────────────────────────────────

type Mutator = (content: string, filePath: string) => string;

const MUTATORS: Record<BugType, Mutator> = {
  SYNTAX_ERROR:  (c)     => applySyntaxError(c),
  TYPE_MISMATCH: (c)     => applyTypeMismatch(c),
  LOGIC_ERROR:   (c, fp) => applyLogicError(c, fp),
  RENAME_VAR:    (c, fp) => applyRenameVar(c, fp),
  DELETE_IMPORT: (c)     => applyDeleteImport(c),
};

// ── Main ───────────────────────────────────────────────────────────────────

const SERVICES: ServiceName[] = ['auth', 'payments', 'inventory'];
const BUG_TYPES: BugType[]    = [
  'SYNTAX_ERROR', 'TYPE_MISMATCH', 'LOGIC_ERROR', 'RENAME_VAR', 'DELETE_IMPORT',
];

const incidentId      = generateIncidentId();
const service         = pickRandom(SERVICES);
const filePath        = path.join(REPO_ROOT, 'services', service, 'src', 'index.ts');
const originalContent = readFileSync(filePath, 'utf-8');

// Try the chosen type first; fall back to others in order if the pattern is absent.
const preferredType = pickRandom(BUG_TYPES);
const orderedTypes  = [preferredType, ...BUG_TYPES.filter(b => b !== preferredType)];

let mutatedContent: string | undefined;
let actualBugType:  BugType | undefined;

for (const bugType of orderedTypes) {
  try {
    const result = MUTATORS[bugType]!(originalContent, filePath);
    if (result === originalContent) throw new Error('mutation produced no change');
    mutatedContent = result;
    actualBugType  = bugType;
    break;
  } catch (err) {
    process.stderr.write(`  [warn] ${bugType} skipped: ${(err as Error).message}\n`);
  }
}

if (mutatedContent === undefined || actualBugType === undefined) {
  process.stderr.write('All mutation strategies failed — aborting.\n');
  process.exit(1);
}

// Snapshot original to backup before touching the file
mkdirSync(BACKUPS_DIR, { recursive: true });
const backup = {
  incidentId,
  timestamp: new Date().toISOString(),
  service,
  bugType: actualBugType,
  filePath,            // absolute so restore is path-independent
  originalContent,
};
writeFileSync(path.join(BACKUPS_DIR, `${incidentId}.json`), JSON.stringify(backup, null, 2));

// Write mutated source
writeFileSync(filePath, mutatedContent);

// Append INJECTED event to incident log
const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
const logEntry = {
  incidentId,
  timestamp: backup.timestamp,
  service,
  bugType: actualBugType,
  filePath: relPath,
  status: 'INJECTED',
};
mkdirSync(path.dirname(INCIDENT_LOG), { recursive: true });
appendFileSync(INCIDENT_LOG, JSON.stringify(logEntry) + '\n');

console.log(`
  Incident ID : ${incidentId}
  Service     : ${service}
  Bug Type    : ${actualBugType}
  File        : ${relPath}
  Backup      : scripts/.chaos-backups/${incidentId}.json

  Run \`pnpm chaos:reset\` to restore, or hand the incident ID to Claude.
`);
