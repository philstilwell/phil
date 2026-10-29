import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('builder', Path(__file__).resolve().parents[1] / 'scripts/build-paper-index.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PaperIndexTests(unittest.TestCase):
    def setUp(self):
        self.row = {'Paper ID': 'P1', 'Record Type': 'Paper', 'Canonical Title': 'A published paper',
                    'Current State': 'Published — verification pending', 'Current/Archived': 'Current',
                    'Academia URL': 'https://www.academia.edu/123/Paper', 'General Category': 'Epistemology',
                    'Key Terms': 'evidence; judgment, confidence', 'Summary': 'A public summary.',
                    'Current PDF Path': '/Users/private/document.pdf', 'Catalog Notes': 'Private note'}

    def payload(self, rows):
        headers = list(self.row)
        return {'values': [headers] + [[r.get(h, '') for h in headers] for r in rows]}

    def test_export_is_allowlisted(self):
        data = builder.build_index(self.payload([self.row]), '2026-10-29')
        paper = data['papers'][0]
        self.assertEqual(tuple(paper), builder.PUBLIC_FIELDS)
        self.assertEqual(paper['keywords'], ['evidence', 'judgment', 'confidence'])
        self.assertNotIn('Private note', str(data))
        self.assertNotIn('/Users/', str(data))

    def test_archived_unpublished_and_books_are_not_exported(self):
        rows = [self.row]
        for key, value in [('Current/Archived', 'Archived'), ('Current State', 'Local file only'), ('Record Type', 'Book/Manual')]:
            rows.append({**self.row, key: value})
        data = builder.build_index(self.payload(rows), '2026-10-29')
        self.assertEqual(len(data['papers']), 1)

    def test_bad_links_and_duplicate_records_fail_instead_of_shipping(self):
        for url in ['https://evil.test/123', 'javascript:alert(1)', 'https://www.academia.edu/']:
            with self.assertRaises(ValueError):
                builder.build_index(self.payload([{**self.row, 'Academia URL': url}]), '2026-10-29')
        with self.assertRaises(ValueError):
            builder.build_index(self.payload([self.row, self.row]), '2026-10-29')

    def test_missing_and_duplicate_ids_are_rejected(self):
        with self.assertRaises(ValueError):
            builder.build_index(self.payload([{**self.row, 'Paper ID': ''}]), '2026-10-29')
        with self.assertRaises(ValueError):
            builder.build_index(self.payload([self.row, {**self.row, 'Academia URL': 'https://www.academia.edu/456/Other'}]), '2026-10-29')

    def test_unchanged_public_contents_do_not_create_daily_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'papers.json'
            first = builder.build_index(self.payload([self.row]), '2026-10-29')
            self.assertTrue(builder.write_index(first, output))
            original = output.read_bytes()
            changed_private_note = {**self.row, 'Catalog Notes': 'New private workflow note'}
            next_day = builder.build_index(self.payload([changed_private_note]), '2026-10-30')
            self.assertFalse(builder.write_index(next_day, output))
            self.assertEqual(output.read_bytes(), original)
            changed_summary = {**self.row, 'Summary': 'An updated public summary.'}
            updated = builder.build_index(self.payload([changed_summary]), '2026-10-30')
            self.assertTrue(builder.write_index(updated, output))
            self.assertEqual(json.loads(output.read_text())['updatedAt'], '2026-10-30')
            self.assertEqual(list(Path(directory).iterdir()), [output])


if __name__ == '__main__':
    unittest.main()
