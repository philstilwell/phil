import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeText, preparePapers, searchPapers, validPublicationUrl } from '../assets/js/paper-search-core.mjs';

const fixture = preparePapers([
  { title: 'Faith and public reason', category: 'Religion', keywords: ['faith'], summary: 'A question about evidence.' },
  { title: 'Artificial intelligence and inquiry', category: 'Technology', keywords: ['automation'], summary: 'A practical comparison of models.' },
  { title: 'A problem of public reason', category: 'Philosophy', keywords: ['AI'], summary: 'Tools for inquiry.' },
  { title: 'Free will and choice', category: 'Agency', keywords: ['decisions'], summary: 'An account of free will.' },
  { title: 'A free society', category: 'Politics', keywords: ['agency'], summary: 'It will require judgment.' },
]);

test('AI expands to artificial intelligence and never matches inside faith', () => {
  const result = searchPapers(fixture, 'AI');
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Artificial intelligence and inquiry');
  assert.ok(!result.some((paper) => paper.title.startsWith('Faith')));
});
test('all meaningful words must match, and quoted phrases remain together', () => {
  assert.equal(searchPapers(fixture, 'free will').length, 2);
  assert.deepEqual(searchPapers(fixture, '"free will"').map((p) => p.title), ['Free will and choice']);
  assert.equal(searchPapers(fixture, 'free will impossible').length, 0);
  assert.equal(searchPapers(fixture, 'papers about "free will"').length, 1);
});
test('punctuation, case, diacritics, and prefix searches are normalized', () => {
  assert.equal(normalizeText('  Évidence—BASED! '), 'evidence based');
  assert.equal(searchPapers(fixture, '  ARTIFICIAL intelligence ').length, 1);
  assert.equal(searchPapers(fixture, 'autom').length, 1);
  assert.equal(searchPapers(fixture, 'the and').length, 0);
});
test('publication URLs must point to actual HTTPS Academia records', () => {
  assert.ok(validPublicationUrl('https://www.academia.edu/12345/Paper_Title'));
  for (const url of ['javascript:alert(1)', 'https://academia.edu.evil.test/123', 'https://evil.test/academia.edu/123', 'https://user@academia.edu/123', 'https://www.academia.edu/', 'http://www.academia.edu/123']) {
    assert.equal(validPublicationUrl(url), false, url);
  }
});
test('the real public index has unique links, only approved public fields, and useful topic matches', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/data/papers.json', import.meta.url), 'utf8'));
  assert.equal(data.schemaVersion, 1);
  assert.ok(data.papers.length > 200);
  assert.equal(new Set(data.papers.map((paper) => paper.id)).size, data.papers.length);
  assert.equal(new Set(data.papers.map((paper) => new URL(paper.links.academia).pathname.split('/')[1])).size, data.papers.length);
  for (const paper of data.papers) {
    assert.deepEqual(Object.keys(paper).sort(), ['category', 'id', 'keywords', 'links', 'summary', 'title']);
    assert.deepEqual(Object.keys(paper.links), ['academia']);
    assert.ok(validPublicationUrl(paper.links.academia));
  }
  assert.doesNotMatch(JSON.stringify(data), /\/Users\/|SHA-256|Catalog Notes|Next Action|Superseded Academia IDs/);
  const prepared = preparePapers(data.papers);
  for (const topic of ['credence', 'morality', 'consciousness', 'AI', 'free will', 'Plantinga']) {
    assert.ok(searchPapers(prepared, topic).length > 0, topic);
  }
  assert.equal(searchPapers(prepared, 'zzzznonexistenttopic').length, 0);
});
