import { preparePapers, searchPapers, validPublicationUrl } from './paper-search-core.mjs';

const panel = document.querySelector('[data-paper-search]');
const form = panel.querySelector('form');
const input = panel.querySelector('input[type="search"]');
const results = panel.querySelector('[data-paper-results]');
const status = panel.querySelector('[data-search-status]');
const note = panel.querySelector('[data-index-note]');
const more = panel.querySelector('[data-show-more]');
const clear = panel.querySelector('[data-clear-search]');
const retry = panel.querySelector('[data-retry-search]');
const browse = panel.querySelector('[data-browse-papers]');
const PAGE_SIZE = 12;
let papers = [];
let ready = false;
let failed = false;
let browsing = false;
let limit = PAGE_SIZE;
let debounce;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function card(paper) {
  const item = element('li', 'paper-result');
  const article = element('article');
  if (paper.category) article.append(element('p', 'paper-result-category', paper.category));
  article.append(element('h3', '', paper.title));
  if (paper.summary) article.append(element('p', 'paper-result-summary', paper.summary));
  if (paper.keywords.length) {
    const keywords = element('ul', 'paper-result-keywords');
    keywords.setAttribute('aria-label', 'Keywords');
    paper.keywords.slice(0, 5).forEach((term) => keywords.append(element('li', '', term)));
    article.append(keywords);
  }
  const link = element('a', 'paper-result-link', 'Read on Academia.edu');
  link.href = paper.links.academia;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Read ${paper.title} on Academia.edu (opens a new tab)`);
  article.append(link);
  item.append(article);
  return item;
}

function updateAddress() {
  const url = new URL(window.location.href);
  if (input.value.trim()) url.searchParams.set('q', input.value.trim());
  else url.searchParams.delete('q');
  // replaceState keeps typing from filling the visitor's browser history.
  window.history.replaceState(null, '', url);
}

function render({ focusNew = false } = {}) {
  const query = input.value.trim();
  clear.hidden = !query && !browsing;
  if (!ready) return;
  const oldCount = results.childElementCount;
  results.replaceChildren();
  more.hidden = true;
  if (!query && !browsing) {
    status.textContent = `${papers.length} papers available. Enter a topic, choose an example, or browse all papers.`;
    return;
  }
  const matches = searchPapers(papers, query);
  const visible = matches.slice(0, limit);
  visible.forEach((paper) => results.append(card(paper)));
  if (!matches.length) {
    status.textContent = `No papers found for “${query}”. Try a shorter topic or a different keyword.`;
    return;
  }
  status.textContent = `${matches.length} ${matches.length === 1 ? 'paper' : 'papers'}${query ? ` found for “${query}”` : ' in the database'}. Showing ${visible.length} of ${matches.length}.`;
  more.hidden = visible.length >= matches.length;
  if (focusNew && results.children[oldCount]) {
    const next = results.children[oldCount].querySelector('h3');
    next.tabIndex = -1;
    next.focus();
  }
}

function search() {
  limit = PAGE_SIZE;
  browsing = false;
  updateAddress();
  render();
  if (failed) status.textContent = 'The search index could not load. Retry, or use the selected papers below.';
}

async function loadIndex() {
  ready = false;
  failed = false;
  retry.hidden = true;
  panel.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading the paper database…';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/assets/data/papers.json', { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('Index unavailable');
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.papers) || !data.papers.length) throw new Error('Invalid index');
    const usable = data.papers.filter((paper) => typeof paper.title === 'string' && typeof paper.category === 'string'
      && typeof paper.summary === 'string' && Array.isArray(paper.keywords) && paper.keywords.every((term) => typeof term === 'string')
      && validPublicationUrl(paper.links?.academia));
    if (usable.length !== data.papers.length) throw new Error('Invalid records');
    papers = preparePapers(usable);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt) ? new Date(`${data.updatedAt}T12:00:00Z`) : null;
    if (date && !Number.isNaN(date.valueOf())) {
      const label = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
      note.textContent = `Index refreshed ${label}. Searches titles, topics, keywords, and summaries.`;
    }
    ready = true;
    render();
  } catch {
    failed = true;
    status.textContent = 'The search index could not load. Retry, or use the selected papers below.';
    retry.hidden = false;
  } finally {
    window.clearTimeout(timeout);
    panel.removeAttribute('aria-busy');
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); window.clearTimeout(debounce); search(); });
input.addEventListener('input', () => { window.clearTimeout(debounce); debounce = window.setTimeout(search, 180); });
clear.addEventListener('click', () => { window.clearTimeout(debounce); input.value = ''; search(); input.focus(); });
browse.addEventListener('click', () => { window.clearTimeout(debounce); input.value = ''; browsing = true; limit = PAGE_SIZE; updateAddress(); render(); });
more.addEventListener('click', () => { limit += PAGE_SIZE; render({ focusNew: true }); });
retry.addEventListener('click', loadIndex);
panel.querySelectorAll('[data-search-example]').forEach((button) => {
  button.addEventListener('click', () => { window.clearTimeout(debounce); input.value = button.dataset.searchExample; search(); input.focus(); });
});
window.addEventListener('popstate', () => { input.value = (new URLSearchParams(window.location.search).get('q') || '').slice(0, 200); browsing = false; limit = PAGE_SIZE; render(); });
input.value = (new URLSearchParams(window.location.search).get('q') || '').slice(0, 200);
loadIndex();
