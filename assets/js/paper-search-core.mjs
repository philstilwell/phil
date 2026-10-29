const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with', 'about', 'paper', 'papers']);
const ALIASES = { ai: ['ai', 'artificial intelligence'], llm: ['llm', 'large language model'], llms: ['llms', 'large language model'] };

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function queryTerms(query) {
  const terms = [];
  for (const match of String(query).matchAll(/"([^"]+)"|(\S+)/g)) {
    const text = normalizeText(match[1] || match[2]);
    if (!text || (!match[1] && STOP_WORDS.has(text))) continue;
    terms.push({ text, phrase: Boolean(match[1]), alternatives: match[1] ? [text] : (ALIASES[text] || [text]) });
  }
  return terms.slice(0, 30);
}

function matches(field, term) {
  return term.alternatives.some((word) => {
    // Short terms such as AI must match whole words, never the middle of "faith".
    const prefix = !term.phrase && !word.includes(' ') && word.length >= 4;
    return new RegExp(`(?:^| )${word}${prefix ? '' : '(?: |$)'}`, 'u').test(field);
  });
}

export function preparePapers(papers) {
  return papers.map((paper) => ({
    ...paper,
    searchFields: [paper.title, paper.category, paper.keywords.join(' '), paper.summary].map(normalizeText),
  }));
}

export function searchPapers(papers, query) {
  const terms = queryTerms(query);
  if (!normalizeText(query)) return papers.slice().sort((a, b) => a.title.localeCompare(b.title));
  if (!terms.length) return [];
  const phrase = normalizeText(query);
  return papers.map((paper) => {
    const fields = paper.searchFields;
    if (!terms.every((term) => fields.some((field) => matches(field, term)))) return null;
    let score = fields[0].includes(phrase) ? 40 : 0;
    for (const term of terms) {
      fields.forEach((field, i) => { if (matches(field, term)) score += [12, 6, 8, 2][i]; });
    }
    return { paper, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.paper.title.localeCompare(b.paper.title)).map(({ paper }) => paper);
}

export function validPublicationUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && ['academia.edu', 'www.academia.edu', 'suj.academia.edu'].includes(url.hostname)
      && /^\/\d+(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}
