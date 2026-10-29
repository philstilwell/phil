#!/usr/bin/env python3
"""Keep the private refresh checkpoint in Git's local metadata, never on the site."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = '15TsWKIXBBhNwAxu18vuMkNlY_pqd_2Gp2EatF5Te6uE'


def needs_refresh(previous, modified_time, index_hash, now):
    if not modified_time or previous.get('sourceId') != SOURCE_ID:
        return True
    if (previous.get('sourceModifiedTime') != modified_time
            or previous.get('indexSha256') != index_hash):
        return True
    try:
        age = now - datetime.fromisoformat(previous['verifiedAt'])
        return age < timedelta(0) or age >= timedelta(days=7)
    except (KeyError, ValueError, TypeError):
        return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'record'])
    parser.add_argument('--modified-time', required=True)
    args = parser.parse_args()
    git_path = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--git-path',
                                       'paper-index-sync-state.json'], text=True).strip()
    state_path = Path(git_path)
    if not state_path.is_absolute():
        state_path = ROOT / state_path
    index_hash = hashlib.sha256((ROOT / 'assets/data/papers.json').read_bytes()).hexdigest()
    now = datetime.now(timezone.utc)
    if args.action == 'check':
        try:
            previous = json.loads(state_path.read_text())
            if not isinstance(previous, dict):
                previous = {}
        except (FileNotFoundError, json.JSONDecodeError):
            previous = {}
        print(json.dumps({'needsRefresh': needs_refresh(previous, args.modified_time, index_hash, now)}))
    else:
        state = {'sourceId': SOURCE_ID, 'sourceModifiedTime': args.modified_time,
                 'indexSha256': index_hash, 'verifiedAt': now.isoformat()}
        state_path.write_text(json.dumps(state, indent=2) + '\n')
        print('Recorded the verified refresh checkpoint locally.')
