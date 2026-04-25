// Alternative to convert-zh-cn-to-zh-tw.ts: translates directly from en.json using Claude API.
// Use when zh-CN is not available or when higher translation quality is needed.
// Requires ANTHROPIC_API_KEY environment variable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../packages/i18n/src/locales/en.json');
const TARGET_FILE = path.resolve(__dirname, '../packages/i18n/src/locales/zh-TW.json');
const BATCH_SIZE = 50;

// Nested JSON type - values can be strings or nested objects
type NestedTranslation = { [key: string]: string | NestedTranslation };
type FlatMap = Record<string, string>;
type TranslationMap = FlatMap;

function loadJson(filePath: string): NestedTranslation {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** Flatten nested JSON to dotted-key map */
function flatten(obj: NestedTranslation, prefix = ''): FlatMap {
  const result: FlatMap = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(result, flatten(v as NestedTranslation, key));
    } else {
      result[key] = v as string;
    }
  }
  return result;
}

/** Reconstruct nested JSON from dotted-key flat map */
function unflatten(flat: FlatMap): NestedTranslation {
  const result: NestedTranslation = {};
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split('.');
    let current: NestedTranslation = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as NestedTranslation;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

function getMissingKeys(sourceFlat: FlatMap, targetFlat: FlatMap): FlatMap {
  return Object.fromEntries(Object.entries(sourceFlat).filter(([key]) => !(key in targetFlat)));
}

function chunk<T>(entries: [string, T][], size: number): [string, T][][] {
  const result: [string, T][][] = [];
  for (let i = 0; i < entries.length; i += size) {
    result.push(entries.slice(i, i + size));
  }
  return result;
}

async function translateBatch(batch: TranslationMap, attempt = 1): Promise<TranslationMap> {
  try {
    const prompt = `You are a professional translator specializing in Traditional Chinese (Taiwan, zh-TW).

Translate the following JSON key-value pairs from English to Traditional Chinese (台灣繁體中文用語).
Rules:
- Keep JSON keys exactly as-is
- Translate only the values
- Use Taiwan Mandarin conventions (e.g., 軟體 not 軟件, 檔案 not 文件, 設定 not 設置)
- Preserve any placeholders like {{variable}}, {0}, %s exactly
- Return valid JSON only, no explanation

Input:
${JSON.stringify(batch, null, 2)}

Output (valid JSON only):`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    return JSON.parse(jsonMatch[0]) as TranslationMap;
  } catch (err) {
    if (attempt >= 3) throw err;
    const delay = 1000 * 2 ** attempt;
    console.warn(`Batch failed (attempt ${attempt}/3), retrying in ${delay}ms...`, err);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return translateBatch(batch, attempt + 1);
  }
}

async function main() {
  console.log('Loading source (en.json) and target (zh-TW.json)...');
  const source = loadJson(SOURCE_FILE);
  const target = loadJson(TARGET_FILE);

  const sourceFlat = flatten(source);
  const targetFlat = flatten(target);

  const missing = getMissingKeys(sourceFlat, targetFlat);
  const missingCount = Object.keys(missing).length;

  if (missingCount === 0) {
    console.log('zh-TW.json is already complete. Nothing to translate.');
    return;
  }

  console.log(`Found ${missingCount} keys to translate. Processing in batches of ${BATCH_SIZE}...`);

  const batches = chunk(Object.entries(missing), BATCH_SIZE);
  const translatedFlat: FlatMap = { ...targetFlat };

  for (let i = 0; i < batches.length; i++) {
    const batch = Object.fromEntries(batches[i]);
    console.log(`Batch ${i + 1}/${batches.length}...`);
    const result = await translateBatch(batch);
    Object.assign(translatedFlat, result);
    const returnedKeys = Object.keys(result);
    const expectedKeys = Object.keys(batch);
    const droppedKeys = expectedKeys.filter((k) => !returnedKeys.includes(k));
    if (droppedKeys.length > 0) {
      console.warn(
        `Warning: LLM dropped ${droppedKeys.length} keys in batch ${i + 1}:`,
        droppedKeys,
      );
    }
    // Reconstruct nested JSON and write after each batch to avoid losing progress on failure
    const nested = unflatten(translatedFlat);
    fs.writeFileSync(TARGET_FILE, `${JSON.stringify(nested, null, 2)}\n`, 'utf-8');
  }

  console.log(`Done. Wrote ${Object.keys(translatedFlat).length} leaf keys to ${TARGET_FILE}`);
}

main().catch(console.error);
