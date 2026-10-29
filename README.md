# Phil

This repository hosts Phil Stilwell's GitHub Pages site.

The site is a static, no-build personal home for the public parts of Phil's
life: philosophy, writing, teaching, projects, and archives.

## Local Preview

Open `index.html` directly in a browser, or run a small local server:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Paper topic search

The Papers page searches `assets/data/papers.json` in the visitor's browser. It
covers titles, subject categories, keywords, and summaries, with direct Academia.edu
links. Queries do not go to Google Sheets or an AI service. The original selected
papers remain available if JavaScript or the index cannot load.

The source is the private **Insights** Google spreadsheet, ID
`15TsWKIXBBhNwAxu18vuMkNlY_pqd_2Gp2EatF5Te6uE`. Read the **Papers** master tab
(`gid=104694488`), not the File Inventory tab or the category views. The views
repeat the master records. Do not change the spreadsheet's sharing permissions.

The index is a dated public snapshot of selected fields from the private source.
Codex checks for changes **every other day at 9:20 a.m. America/New_York** through
the existing private Google Drive connection. The automation needs Codex available
on the user's Mac and uses the normal Codex allowance. It publishes only when public
contents change, so private-note edits do not change the website or refresh date.
The procedure and recovery steps are in
[`scripts/PAPER_INDEX_SYNC.md`](scripts/PAPER_INDEX_SYNC.md).

To refresh it manually:

1. Use the connected Google Drive tools to read spreadsheet metadata and confirm
   the current Papers column headings and grid bounds.
2. Read the bounded master range including columns A through AC and all populated
   rows (currently `Papers!A1:AC400`). Use formatted cell values: some cells still
   have stale hyperlink metadata pointing to superseded publications.
3. Pass the values response (`{"values": [...]}` or the connector's
   `{"structuredContent": {"values": [...]}}`) directly to the builder's standard
   input. Do not save the raw private response in the repository:

   ```sh
   python3 scripts/build-paper-index.py --as-of YYYY-MM-DD < /path/to/temporary-values.json
   ```

   The filename above is an alternative for an already-created temporary response;
   delete it after the refresh. Prefer piping the response without a disk copy.
4. Run the checks below, review the changed public index, commit, and push to
   publish. The site automatically displays the refreshed date from the JSON.

The builder exports only current records marked as published and of type Paper.
It copies only the ID, canonical title, category, keywords, summary, and current
Academia.edu URL. It excludes archived entries, local-only drafts, books, private
file paths, workflow notes, approval details, hashes, and superseded links. Platform
verification status is not represented as a guarantee that every external URL will
remain available. The source currently has Academia links for every included paper;
PhilPeople profile links remain elsewhere on the page.

No credentials or private Sheets export endpoints belong in the browser code.
The scheduled refresh does not change spreadsheet sharing. Its checkpoint stays
in Git's local metadata directory and is never published. A failed source read or
validation leaves the last valid public index in place.

### Search checks

```sh
node --test tests/paper-search.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```
