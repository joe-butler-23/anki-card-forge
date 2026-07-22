import { createHash, randomUUID } from 'node:crypto';

export function reviewedPayloadDigest(deckName, cards) {
  const canonicalPayload = {
    deckName,
    cards: cards.map(({ modelName, front, back, tags = [] }) => ({ modelName, front, back, tags })),
  };

  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

export function createReviewApprovalStore({
  ttlMs = 15 * 60 * 1_000,
  now = Date.now,
  createToken = randomUUID,
} = {}) {
  const approvals = new Map();

  return {
    issue(deckName, cards) {
      const token = createToken();
      const expiresAt = now() + ttlMs;
      approvals.set(token, {
        digest: reviewedPayloadDigest(deckName, cards),
        expiresAt,
      });

      return { token, expiresAt };
    },

    consume(token, deckName, cards) {
      const approval = approvals.get(token);

      if (!approval) {
        throw new Error('The reviewed-card approval token is unknown or has already been used.');
      }

      if (now() > approval.expiresAt) {
        approvals.delete(token);
        throw new Error('The reviewed-card approval token has expired. Validate the cards again.');
      }

      if (approval.digest !== reviewedPayloadDigest(deckName, cards)) {
        throw new Error('The deck or card content changed after validation. Review and validate it again.');
      }

      approvals.delete(token);
    },
  };
}
