import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAnkiConnectClient,
  createNote,
  escapeCardText,
  normalizeAnkiConnectUrl,
  validateCard,
} from '../mcp/anki-connect.mjs';

function jsonResponse(result, error = null, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { result, error };
    },
  };
}

test('normalizes localhost AnkiConnect URLs and rejects remote URLs', () => {
  assert.equal(normalizeAnkiConnectUrl('http://127.0.0.1:8765/'), 'http://127.0.0.1:8765');
  assert.equal(normalizeAnkiConnectUrl('http://localhost:8765'), 'http://localhost:8765');
  assert.throws(() => normalizeAnkiConnectUrl('https://127.0.0.1:8765'), /must use HTTP/);
  assert.throws(() => normalizeAnkiConnectUrl('http://example.com:8765'), /localhost/);
  assert.throws(() => normalizeAnkiConnectUrl('http://127.0.0.1:8765/path'), /must not include a path/);
});

test('escapes HTML while preserving MathJax delimiters and line breaks', () => {
  assert.equal(
    escapeCardText('<script>x</script>\n\\(p < 0.05\\) & evidence'),
    '&lt;script&gt;x&lt;/script&gt;<br>\\(p &lt; 0.05\\) &amp; evidence',
  );
});

test('constructs supported Anki notes and rejects invalid cards', () => {
  assert.deepEqual(
    createNote(
      { modelName: 'Basic', front: 'What is \\(p\\)?', back: 'A probability under the null.' },
      'prob',
    ),
    {
      deckName: 'prob',
      modelName: 'Basic',
      fields: {
        Front: 'What is \\(p\\)?',
        Back: 'A probability under the null.',
      },
      options: { allowDuplicate: false },
    },
  );
  assert.throws(
    () => validateCard({ modelName: 'Cloze', front: 'x', back: 'y' }),
    /unsupported model/,
  );
  assert.throws(
    () => validateCard({ modelName: 'Basic', front: ' ', back: 'y' }),
    /empty front/,
  );
});

test('validates exact notes without writing them', async () => {
  const actions = [];
  const fetchImpl = async (_url, options) => {
    const payload = JSON.parse(options.body);
    actions.push(payload.action);
    const results = {
      deckNames: ['prob'],
      modelNames: ['Basic'],
      canAddNotes: [true],
    };
    return jsonResponse(results[payload.action]);
  };
  const client = createAnkiConnectClient({ fetchImpl });
  const canAdd = await client.canAddNotes(
    [{ modelName: 'Basic', front: 'front', back: 'back' }],
    'prob',
  );

  assert.deepEqual(canAdd, [true]);
  assert.deepEqual(actions.sort(), ['canAddNotes', 'deckNames', 'modelNames'].sort());
  assert.ok(!actions.includes('addNotes'));
});

test('preflights the whole batch before a reviewed write', async () => {
  const actions = [];
  const fetchImpl = async (_url, options) => {
    const payload = JSON.parse(options.body);
    actions.push(payload.action);
    const results = {
      deckNames: ['prob'],
      modelNames: ['Basic'],
      canAddNotes: [false],
    };
    return jsonResponse(results[payload.action]);
  };
  const client = createAnkiConnectClient({ fetchImpl });

  await assert.rejects(
    client.addReviewedNotes([{ modelName: 'Basic', front: 'duplicate', back: 'back' }], 'prob'),
    /No notes were added/,
  );
  assert.ok(!actions.includes('addNotes'));
});

test('adds reviewed notes only after a successful preflight', async () => {
  const actions = [];
  const fetchImpl = async (_url, options) => {
    const payload = JSON.parse(options.body);
    actions.push(payload.action);
    const results = {
      deckNames: ['prob'],
      modelNames: ['Basic'],
      canAddNotes: [true],
      addNotes: [12345],
    };
    return jsonResponse(results[payload.action]);
  };
  const client = createAnkiConnectClient({ fetchImpl });
  const noteIds = await client.addReviewedNotes(
    [{ modelName: 'Basic', front: 'front', back: 'back' }],
    'prob',
  );

  assert.deepEqual(noteIds, [12345]);
  assert.equal(actions.at(-1), 'addNotes');
});

test('fails closed on malformed AnkiConnect envelopes', async () => {
  const client = createAnkiConnectClient({
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { value: 6 }; } }),
  });
  await assert.rejects(client.checkConnection(), /invalid response envelope/);
});
