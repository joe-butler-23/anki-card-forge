import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { __test__ } from '../electron/codex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flashcardsSchemaPath = path.join(__dirname, '..', 'electron', 'schemas', 'flashcards.schema.json');

test('normalizes fenced Codex flashcard JSON', () => {
  const normalized = __test__.normalizeCardsResponse(`\n\`\`\`json\n{"cards":[{"cardType":"Basic","front":"Q","back":"A"}]}\n\`\`\`\n`);

  assert.equal(normalized, '[{"cardType":"Basic","front":"Q","back":"A"}]');
});

test('rejects invalid Codex card JSON', () => {
  assert.throws(
    () => __test__.normalizeCardsResponse('{"cards":[{"cardType":"Cloze","front":"Q","back":"A"}]}'),
    /invalid cardType/,
  );
});

test('materializes image data URLs for Codex CLI image input', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acf-codex-test-'));
  try {
    const imagePath = await __test__.materializeImageDataUrl(tmpDir, 'data:image/png;base64,iVBORw0KGgo=');
    const bytes = await fs.readFile(imagePath);

    assert.equal(path.basename(imagePath), 'attachment.png');
    assert.equal(bytes.toString('base64'), 'iVBORw0KGgo=');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('builds modern codex exec args with schema output and optional image', () => {
  const args = __test__.buildCodexArgs({
    cwd: '/tmp/acf',
    outputPath: '/tmp/acf/response.json',
    schemaPath: '/tmp/acf/schema.json',
    imagePath: '/tmp/acf/attachment.png',
  });

  assert.deepEqual(args.slice(0, 3), ['--ask-for-approval', 'never', 'exec']);
  assert.equal(args.includes('--ephemeral'), true);
  assert.equal(args.includes('--ignore-user-config'), true);
  assert.equal(args.includes('--ignore-rules'), true);
  assert.equal(args.includes('--output-schema'), true);
  assert.equal(args.includes('-i'), true);
  assert.equal(args[args.indexOf('-i') - 1], '-');
});

test('runs Codex through a non-shell executable and reads the output file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acf-fake-codex-'));
  const fakeCodexPath = path.join(tmpDir, 'fake-codex.mjs');

  try {
    await fs.writeFile(fakeCodexPath, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
if (args[0] !== '--ask-for-approval' || args[1] !== 'never' || args[2] !== 'exec') process.exit(2);
if (!args.includes('--sandbox') || !args.includes('read-only')) process.exit(3);
if (!args.includes('--output-schema')) process.exit(4);
let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { stdin += chunk; });
process.stdin.on('end', () => {
  if (!stdin.includes('make cards')) process.exit(5);
  fs.writeFileSync(outputIndex >= 0 ? args[outputIndex + 1] : 'missing-output.json', '{"cards":[{"cardType":"Basic","front":"Q","back":"A"}]}');
});
`);
    await fs.chmod(fakeCodexPath, 0o755);

    const output = await __test__.runCodexExec({
      prompt: 'make cards',
      schemaPath: flashcardsSchemaPath,
      codexCommand: fakeCodexPath,
    });

    assert.equal(output, '{"cards":[{"cardType":"Basic","front":"Q","back":"A"}]}');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
