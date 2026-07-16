import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getApprovedCards,
  getNextPendingIndex,
  REVIEW_STATUS,
  updateReviewStatus,
} from '../src/reviewState.ts';

type Card = {
  id: string;
  reviewStatus: (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
};

function cards(): Card[] {
  return [
    { id: 'one', reviewStatus: REVIEW_STATUS.Pending },
    { id: 'two', reviewStatus: REVIEW_STATUS.Pending },
    { id: 'three', reviewStatus: REVIEW_STATUS.Pending },
  ];
}

test('only explicitly approved cards cross the sync boundary', () => {
  let reviewed = updateReviewStatus(cards(), 0, REVIEW_STATUS.Approved);
  reviewed = updateReviewStatus(reviewed, 1, REVIEW_STATUS.Rejected);

  assert.deepEqual(getApprovedCards(reviewed).map((card) => card.id), ['one']);
  assert.equal(getNextPendingIndex(reviewed, 1), 2);
});

test('navigation cannot bypass unresolved cards', () => {
  const reviewed = updateReviewStatus(cards(), 2, REVIEW_STATUS.Approved);

  assert.equal(getNextPendingIndex(reviewed, 2), 0);
  assert.equal(getApprovedCards(reviewed).length, 1);
});

test('the review completes only when every card is resolved', () => {
  const reviewed = cards().map((card, index) => ({
    ...card,
    reviewStatus: index === 1 ? REVIEW_STATUS.Rejected : REVIEW_STATUS.Approved,
  }));

  assert.equal(getNextPendingIndex(reviewed, 2), -1);
  assert.deepEqual(getApprovedCards(reviewed).map((card) => card.id), ['one', 'three']);
});
