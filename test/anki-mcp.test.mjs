import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAnkiConnectClient,
  createNote,
  normalizeAnkiConnectUrl,
  sanitizeCardHtml,
  validateCard,
} from '../mcp/anki-connect.mjs';
import { createReviewApprovalStore, reviewedPayloadDigest } from '../mcp/review-approval.mjs';

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

test('sanitizes supported card HTML while preserving MathJax and line breaks', () => {
  assert.equal(
    sanitizeCardHtml('<B onclick="x"><i>term</i></B><br><script>x</script>\n\\(p < 0.05\\) & evidence'),
    '<b><i>term</i></b><br>x<br>\\(p &lt; 0.05\\) &amp; evidence',
  );
  assert.equal(sanitizeCardHtml('<a href="https://example.com">link</a><hr>'), 'link<hr>');
});

test('constructs supported Anki notes and rejects invalid cards', () => {
  assert.deepEqual(
    createNote(
      { modelName: 'Basic', front: 'What is \\(p\\)?', back: 'A probability under the null.', tags: ['all-of-statistics::ch-01'] },
      'prob',
    ),
    {
      deckName: 'prob',
      modelName: 'Basic',
      tags: ['all-of-statistics::ch-01'],
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
  assert.throws(
    () => validateCard({ modelName: 'Basic', front: 'x', back: 'y', tags: ['not valid'] }),
    /invalid Anki tag/,
  );
});

test('constructs Anki notes with sanitized formatting and no executable attributes', () => {
  assert.deepEqual(
    createNote(
      {
        modelName: 'Basic',
        front: 'What is an <b onclick="alert(1)">event</b>?',
        back: 'A set of outcomes.<br><img src=x onerror="alert(1)">',
        tags: [],
      },
      'prob',
    ).fields,
    {
      Front: 'What is an <b>event</b>?',
      Back: 'A set of outcomes.<br>',
    },
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

test('rejects duplicate novel notes before contacting AnkiConnect', async () => {
  const actions = [];
  const client = createAnkiConnectClient({
    fetchImpl: async (_url, options) => {
      actions.push(JSON.parse(options.body).action);
      return jsonResponse([]);
    },
  });

  await assert.rejects(
    client.addReviewedNotes(
      [
        { modelName: 'Basic', front: 'novel front', back: 'first answer' },
        { modelName: 'Basic', front: 'novel front', back: 'second answer' },
      ],
      'prob',
    ),
    /duplicate cards/,
  );
  assert.deepEqual(actions, []);
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

test('binds a one-time approval token to the exact reviewed payload', () => {
  const cards = [{ modelName: 'Basic', front: 'front', back: 'back', tags: ['all-of-statistics::ch-01'] }];
  const store = createReviewApprovalStore({
    now: () => 1_000,
    createToken: () => 'token',
  });
  store.issue('prob', cards);

  assert.throws(() => store.consume('token', 'prob', [{ ...cards[0], back: 'changed' }]), /changed/);
  assert.throws(() => store.consume('token', 'prob', [{ ...cards[0], tags: ['all-of-statistics::ch-02'] }]), /changed/);
  store.consume('token', 'prob', cards);
  assert.throws(() => store.consume('token', 'prob', cards), /already been used/);
  assert.notEqual(reviewedPayloadDigest('prob', cards), reviewedPayloadDigest('other', cards));
});

test('expires reviewed-card approval tokens', () => {
  let currentTime = 1_000;
  const cards = [{ modelName: 'Basic', front: 'front', back: 'back', tags: [] }];
  const store = createReviewApprovalStore({
    ttlMs: 100,
    now: () => currentTime,
    createToken: () => 'token',
  });
  store.issue('prob', cards);
  currentTime = 1_101;

  assert.throws(() => store.consume('token', 'prob', cards), /expired/);
});
