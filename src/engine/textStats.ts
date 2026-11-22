import { Passage, StoryProject } from '../types/story';

/**
 * Counts words in narrative prose, stripping inline image tokens and link markup.
 * Handles both space-delimited Latin/alphabetical words and CJK characters.
 */
export function countWords(text: string): number {
  if (!text) return 0;

  // Strip [[img:...]] tokens completely
  let cleaned = text.replace(/\[\[img:[^\]]*\]\]/gi, ' ');
  // Convert [[label|target]] or [[target]] to just its visible label
  cleaned = cleaned.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$1');
  cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Strip {{var}} placeholders or keep? Replace punctuation/markdown markers
  cleaned = cleaned.replace(/[*_`>#]/g, ' ');

  // Count CJK characters individually (Japanese kanji/kana, Korean hangul syllables, Chinese hanzi)
  const cjkMatches = cleaned.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK chars and count remaining space-separated word tokens
  const withoutCjk = cleaned.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g, ' ').trim();
  const latinWords = withoutCjk ? withoutCjk.split(/\s+/).filter(Boolean).length : 0;

  return cjkCount + latinWords;
}

export function getPassageWordCount(passage: Passage): number {
  return countWords(passage.body);
}

export function getProjectWordStats(project: StoryProject): {
  totalWords: number;
  readingMinutes: number;
} {
  let totalWords = 0;
  for (const p of Object.values(project.passages)) {
    totalWords += getPassageWordCount(p);
  }
  const readingMinutes = totalWords > 0 ? Math.max(1, Math.ceil(totalWords / 200)) : 0;
  return { totalWords, readingMinutes };
}
