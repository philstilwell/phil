import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sync_state', Path(__file__).resolve().parents[1] / 'scripts/paper-index-sync-state.py')
sync_state = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_state)


class SyncStateTests(unittest.TestCase):
    def test_checkpoint_skips_unchanged_source_but_detects_changes_and_weekly_rechecks(self):
        now = datetime(2026, 10, 29, tzinfo=timezone.utc)
        prior = {'sourceId': sync_state.SOURCE_ID, 'sourceModifiedTime': 'modified-1',
                 'indexSha256': 'hash-1', 'verifiedAt': now.isoformat()}
        self.assertFalse(sync_state.needs_refresh(prior, 'modified-1', 'hash-1', now + timedelta(days=2)))
        self.assertTrue(sync_state.needs_refresh(prior, 'modified-2', 'hash-1', now))
        self.assertTrue(sync_state.needs_refresh(prior, 'modified-1', 'hash-2', now))
        self.assertTrue(sync_state.needs_refresh(prior, 'modified-1', 'hash-1', now + timedelta(days=8)))
        self.assertTrue(sync_state.needs_refresh({}, 'modified-1', 'hash-1', now))
        self.assertTrue(sync_state.needs_refresh(prior, '', 'hash-1', now))
        self.assertTrue(sync_state.needs_refresh({**prior, 'verifiedAt': 'bad-date'}, 'modified-1', 'hash-1', now))


if __name__ == '__main__':
    unittest.main()
