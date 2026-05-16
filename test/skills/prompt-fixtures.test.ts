import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PROMPTS_DIR = path.resolve(import.meta.dirname, 'prompts');
const README = path.resolve(import.meta.dirname, 'README.md');

describe('Boss skill behavior prompt fixtures', () => {
  it('keeps deterministic prompt fixtures for future headless skill tests', () => {
    const expected = [
      'boss-natural-trigger.txt',
      'boss-explicit-request.txt',
      'methodology-skill-load.txt',
      'qa-attack-unverified.txt'
    ];

    for (const fileName of expected) {
      const content = fs.readFileSync(path.join(PROMPTS_DIR, fileName), 'utf8').trim();
      expect(content.length, `${fileName} should not be empty`).toBeGreaterThan(20);
      expect(content, `${fileName} should not contain placeholders`).not.toMatch(/\b(TBD|TODO|FIXME)\b/i);
    }
  });

  it('explicit boss prompt requires skill loading before implementation actions', () => {
    const content = fs.readFileSync(path.join(PROMPTS_DIR, 'boss-explicit-request.txt'), 'utf8');

    expect(content).toMatch(/\bboss\b/i);
    expect(content).toMatch(/Load the boss skill/i);
    expect(content).toMatch(/before making code changes/i);
  });

  it('QA attack prompt requires honest unverified critical path reporting', () => {
    const content = fs.readFileSync(path.join(PROMPTS_DIR, 'qa-attack-unverified.txt'), 'utf8');

    expect(content).toMatch(/critical path/i);
    expect(content).toMatch(/unverified/i);
    expect(content).toMatch(/instead of passed/i);
  });

  it('documents deterministic and opt-in headless skill test commands', () => {
    const content = fs.readFileSync(README, 'utf8');

    expect(content).toContain('npm run test:skills');
    expect(content).toContain('run-skill-test.sh');
    expect(content).toContain('run-headless-skill-test.sh');
    expect(content).toContain('intentionally opt-in');
  });
});
