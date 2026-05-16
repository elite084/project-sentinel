import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = path.resolve(__dirname, '..', 'src', 'index.ts');

describe('INC-1778950451-F48W DELETE_IMPORT regression', () => {
  it('source file imports createLogger from @sentinel/shared', () => {
    const content = readFileSync(SOURCE, 'utf-8');
    expect(content).toMatch(/import\s*\{\s*createLogger\s*\}\s*from\s*['"]@sentinel\/shared['"]/);
  });
});
