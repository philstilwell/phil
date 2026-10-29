#!/usr/bin/env python3
"""Build the public search index from a Google Sheets values response on stdin.

Read-only source: Insights / Papers. Raw spreadsheet rows are never written out.
"""
import argparse
import json
import re
import sys
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

PUBLIC_FIELDS = ('id', 'title', 'category', 'keywords', 'summary', 'links')
REQUIRED = ('Paper ID', 'Record Type', 'Canonical Title', 'Current State',
            'Current/Archived', 'Academia URL', 'General Category', 'Key Terms', 'Summary')


def build_index(payload, as_of):
    payload = payload.get('structuredContent', payload)
    values = payload.get('values', [])
    if not values:
        raise ValueError('The source contains no rows.')
    headers = values[0]
    if any(name not in headers for name in REQUIRED):
        raise ValueError('The source is missing required Papers column headers.')
    papers, seen, seen_ids = [], set(), set()
    for values_row in values[1:]:
        row = dict(zip(headers, values_row))
        value = lambda key: str(row.get(key, '')).strip()
        if (value('Record Type') != 'Paper' or value('Current/Archived') != 'Current'
                or not value('Current State').startswith('Published')):
            continue
        paper_id = value('Paper ID')
        if not paper_id or paper_id in seen_ids:
            raise ValueError('Published papers must have nonempty, unique Paper IDs.')
        seen_ids.add(paper_id)
        title = re.sub(r'^[◉✶★\s]+', '', value('Canonical Title'))
        url = value('Academia URL')
        parsed = urlsplit(url)
        if (not title or parsed.scheme != 'https' or parsed.username or parsed.password
                or parsed.hostname not in ('academia.edu', 'www.academia.edu', 'suj.academia.edu')
                or not re.match(r'^/\d+(?:/|$)', parsed.path)):
            raise ValueError(f'Published paper {value("Paper ID")} has no valid Academia record URL.')
        record = re.match(r'^/(\d+)', parsed.path).group(1)
        if record in seen:
            raise ValueError(f'Duplicate Academia record {record}.')
        seen.add(record)
        paper = dict(zip(PUBLIC_FIELDS, [
            value('Paper ID'), title, value('General Category'),
            [term.strip() for term in re.split(r'[;,]', value('Key Terms')) if term.strip()],
            value('Summary'), {'academia': url}
        ]))
        if any(marker in json.dumps(paper) for marker in ('/Users/', 'file://', 'SHA-256')):
            raise ValueError('Private file metadata was found in a public field.')
        papers.append(paper)
    if not papers:
        raise ValueError('No current published papers have usable publication links.')
    papers.sort(key=lambda paper: paper['title'].casefold())
    return {'schemaVersion': 1, 'updatedAt': as_of, 'papers': papers}


def write_index(index, output):
    """Preserve the date and file when public contents have not changed."""
    output = Path(output)
    if output.exists():
        previous = json.loads(output.read_text(encoding='utf-8'))
        if (previous.get('schemaVersion') == index['schemaVersion']
                and previous.get('papers') == index['papers']):
            return False
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent,
                                         prefix='.paper-index-', suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--as-of', required=True, help='Refresh date, YYYY-MM-DD')
    parser.add_argument('--output', default='assets/data/papers.json')
    args = parser.parse_args()
    date.fromisoformat(args.as_of)
    index = build_index(json.load(sys.stdin), args.as_of)
    changed = write_index(index, args.output)
    print(f'{"Updated" if changed else "Unchanged"}: {len(index["papers"])} current published papers in {args.output}.')
