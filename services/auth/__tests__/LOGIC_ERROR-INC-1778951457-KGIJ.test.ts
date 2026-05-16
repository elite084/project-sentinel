import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = path.resolve(__dirname, '..', 'src', 'index.ts');

describe('INC-1778951457-KGIJ LOGIC_ERROR regression', () => {
  it('login guard uses || so requests missing either field are rejected', () => {
    const content = readFileSync(SOURCE, 'utf-8');
    // Must use || not && — && allows username-only or password-only requests
    expect(content).toMatch(/if\s*\(\s*!username\s*\|\|\s*!password\s*\)/);
  });
});
