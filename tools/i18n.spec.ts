/**
 * Keeps the translation files in step with each other and with the code:
 * - en.json and da.json have exactly the same keys, and no empty values
 * - every literal key used in src/app (e.g. `'settings.title' | translate`) exists
 * Runs with the Node-side tests: `npm run functions:test`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (lang: string) => JSON.parse(readFileSync(join(root, 'public/i18n', `${lang}.json`), 'utf8')) as object;

/** Flattens nested JSON to `a.b.c` -> value. */
const flatten = (obj: object, prefix = ''): Map<string, unknown> =>
  new Map(
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? [...flatten(v as object, `${prefix}${k}.`)] : [[`${prefix}${k}`, v] as const],
    ),
  );

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

const en = flatten(load('en'));
const da = flatten(load('da'));

describe('translations', () => {
  it('have the same keys in English and Danish', () => {
    expect([...da.keys()].filter(k => !en.has(k))).toEqual([]);
    expect([...en.keys()].filter(k => !da.has(k))).toEqual([]);
  });

  it('have no empty values', () => {
    const empty = [...en, ...da].filter(([, v]) => typeof v !== 'string' || !v.trim());
    expect(empty.map(([k]) => k)).toEqual([]);
  });

  it('contain every key used in the app', () => {
    const topLevel = new Set([...en.keys()].map(k => k.split('.')[0]));
    const used = new Set<string>();
    for (const file of files(join(root, 'src/app'))) {
      if (!/\.(ts|html)$/.test(file) || file.endsWith('.spec.ts')) continue;
      for (const [, key] of readFileSync(file, 'utf8').matchAll(/'([a-z][A-Za-z]*(?:\.[A-Za-z_]+)+)'/g)) {
        if (topLevel.has(key.split('.')[0])) used.add(key);
      }
    }
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter(k => !en.has(k))).toEqual([]);
  });
});
