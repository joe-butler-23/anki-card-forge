export const REVIEW_STATUS = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

interface ReviewableCard {
  reviewStatus: ReviewStatus;
}

export function updateReviewStatus<T extends ReviewableCard>(
  cards: T[],
  index: number,
  reviewStatus: ReviewStatus,
): T[] {
  return cards.map((card, cardIndex) =>
    cardIndex === index ? { ...card, reviewStatus } : card,
  );
}

export function getApprovedCards<T extends ReviewableCard>(cards: T[]): T[] {
  return cards.filter((card) => card.reviewStatus === REVIEW_STATUS.Approved);
}

export function getNextPendingIndex<T extends ReviewableCard>(cards: T[], afterIndex: number): number {
  const laterIndex = cards.findIndex(
    (card, index) => index > afterIndex && card.reviewStatus === REVIEW_STATUS.Pending,
  );

  return laterIndex >= 0
    ? laterIndex
    : cards.findIndex((card) => card.reviewStatus === REVIEW_STATUS.Pending);
}
