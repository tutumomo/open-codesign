// Converts zh-CN.json to zh-TW.json using OpenCC (no API key required).
// Run with: pnpm convert:zh-tw
// For AI-based translation from en.json instead, see translate-zh-tw.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../packages/i18n/src/locales/zh-CN.json');
const TARGET_FILE = path.resolve(__dirname, '../packages/i18n/src/locales/zh-TW.json');

type NestedTranslation = { [key: string]: string | NestedTranslation };

const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });

function convertValues(obj: NestedTranslation): NestedTranslation {
  const result: NestedTranslation = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = converter(value);
    } else {
      result[key] = convertValues(value);
    }
  }
  return result;
}

const source = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8')) as NestedTranslation;
const converted = convertValues(source);
fs.writeFileSync(TARGET_FILE, `${JSON.stringify(converted, null, 2)}\n`, 'utf-8');

function countLeaves(o: NestedTranslation): number {
  return Object.values(o).reduce<number>(
    (sum, v) => sum + (typeof v === 'string' ? 1 : countLeaves(v as NestedTranslation)),
    0,
  );
}
const leafCount = countLeaves(converted);
console.log(`Done. Converted ${leafCount} string values to zh-TW.json`);
