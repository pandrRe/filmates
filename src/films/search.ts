export type TitleMatch = { status: "matched"; relevance: number } | { status: "unmatched" };

const TITLE_START_RELEVANCE = 100;
const WORD_START_RELEVANCE = 50;
const CONTAINED_RELEVANCE = 10;

const WORD_CHARACTER = /[\p{Letter}\p{Number}]/u;

function relevanceOfOccurrence(title: string, index: number): number {
  if (index === 0) {
    return TITLE_START_RELEVANCE;
  }
  return WORD_CHARACTER.test(title.charAt(index - 1)) ? CONTAINED_RELEVANCE : WORD_START_RELEVANCE;
}

function bestRelevance(title: string, word: string): number | null {
  let best: number | null = null;
  let index = title.indexOf(word);
  while (index !== -1) {
    const relevance = relevanceOfOccurrence(title, index);
    if (relevance === TITLE_START_RELEVANCE) {
      return relevance;
    }
    best = best === null ? relevance : Math.max(best, relevance);
    index = title.indexOf(word, index + 1);
  }
  return best;
}

export function matchTitle(title: string, query: string): TitleMatch {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return { status: "matched", relevance: 0 };
  }

  const haystack = title.toLowerCase();
  let relevance = 0;
  for (const word of words) {
    const wordRelevance = bestRelevance(haystack, word);
    if (wordRelevance === null) {
      return { status: "unmatched" };
    }
    relevance += wordRelevance;
  }
  return { status: "matched", relevance };
}
