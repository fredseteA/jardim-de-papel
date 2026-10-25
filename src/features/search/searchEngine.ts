import type { DurationFilterId, SearchFilters, SearchStory } from './types';

const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'em']);
export function normalizeSearchText(value: string) { return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function distance(a: string, b: string) { const grid = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_v, j) => i === 0 ? j : j === 0 ? i : 0)); for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost, i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? grid[i - 2][j - 2] + cost : Infinity); } return grid[a.length][b.length]; }
function tolerance(token: string) { return token.length <= 3 ? 0 : token.length <= 6 ? 1 : 2; }
function tokenScore(token: string, words: string[], lowWeightWords: string[]) { const all = [...words, ...lowWeightWords]; let best = -1; for (const word of all) { const multiplier = words.includes(word) ? 1 : .45; if (token === word) best = Math.max(best, 100 * multiplier); else if (word.startsWith(token)) best = Math.max(best, 78 * multiplier); else if (word.includes(token)) best = Math.max(best, 62 * multiplier); else if (distance(token, word) <= tolerance(token)) best = Math.max(best, 42 * multiplier); } return best; }
function matchesDuration(duration: number | undefined, filter: DurationFilterId) { if (filter === 'any') return true; if (duration === undefined) return false; if (filter === 'up-to-5') return duration <= 5; if (filter === '6-to-10') return duration >= 6 && duration <= 10; if (filter === '11-to-20') return duration >= 11 && duration <= 20; return duration > 20; }
export function searchStoriesByFilters(stories: readonly SearchStory[], filters: SearchFilters) {
  const normalizedQuery = normalizeSearchText(filters.query); const required = normalizedQuery.split(' ').filter((token) => token && !stopWords.has(token));
  return stories.map((story, originalIndex) => {
    if (filters.categoryId !== 'todos' && story.categoryId !== filters.categoryId) return null;
    if (!matchesDuration(story.durationMin, filters.durationId)) return null;
    const title = normalizeSearchText(story.title); const titleWords = title.split(' '); const secondaryWords = normalizeSearchText(`${story.categoryLabel} ${story.description ?? ''}`).split(' ');
    const scores = required.map((token) => tokenScore(token, titleWords, secondaryWords)); if (scores.some((score) => score < 0)) return null;
    let score = scores.reduce((sum, item) => sum + item, 0); if (normalizedQuery && title === normalizedQuery) score += 500; else if (normalizedQuery && title.startsWith(normalizedQuery)) score += 250; if (required.length > 1) score += 40;
    return { story, score, originalIndex };
  }).filter((item): item is { story: SearchStory; score: number; originalIndex: number } => item !== null).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex).map((item) => item.story);
}
