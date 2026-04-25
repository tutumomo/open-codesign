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

const keyCount = JSON.stringify(converted).match(/"[^"]+"\s*:/g)?.length ?? 0;
console.log(`Done. Converted ${keyCount} keys to zh-TW.json`);
