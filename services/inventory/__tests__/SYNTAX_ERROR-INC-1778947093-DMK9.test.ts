import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SOURCE = path.resolve(__dirname, '..', 'src', 'index.ts');

describe('INC-1778947093-DMK9 SYNTAX_ERROR regression', () => {
  it('source file has no TypeScript parse errors', () => {
    const content = readFileSync(SOURCE, 'utf-8');
    const sf = ts.createSourceFile('index.ts', content, ts.ScriptTarget.ES2022, true);
    // parseDiagnostics are populated for syntax errors
    const diags = (sf as any).parseDiagnostics as ts.Diagnostic[] | undefined;
    const errors = (diags ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
    expect(errors, `Parse errors found: ${errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('; ')}`).toHaveLength(0);
  });
});
