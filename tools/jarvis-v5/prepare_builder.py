"""Operator-side committed-source snapshot. No reset, checkout, hook, or provider call.

Dirty files are reported by name but NOT silently copied. Review and transfer deliberate
local changes separately. Pattern screening is not a secret scanner or proof of safety.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from common import sha, file_paths
from git_snapshot import snapshot

DENIED_NAMES = {'auth.json', 'credentials', 'credentials.json', 'id_rsa', 'id_ed25519', '.netrc', '.npmrc'}
DENIED_PARTS = {'.ssh', '.aws', '.azure', '.gcloud', '.vercel', '.neon', '.docker', 'sessions', '.git'}


def source_path_allowed(path: str) -> bool:
    parts = Path(path).parts
    name = parts[-1].lower()
    if any(p.lower() in DENIED_PARTS for p in parts): return False
    if name in DENIED_NAMES: return False
    if name.startswith('.env') and name not in {'.env.example', '.env.template'}: return False
    if name.endswith(('.pem', '.key', '.p12', '.pfx', '.keystore')): return False
    return True


def git_read(repo, args):
    env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'GIT_CONFIG_NOSYSTEM': '1',
           'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_TERMINAL_PROMPT': '0', 'GIT_NO_REPLACE_OBJECTS': '1',
           'GIT_OPTIONAL_LOCKS': '0'}
    p = subprocess.run(['git', '--no-pager', '-c', 'core.hooksPath='+os.devnull, '-c', 'core.fsmonitor=false', *args],
                       cwd=repo, env=env, capture_output=True, timeout=30)
    if p.returncode: raise ValueError('Read-only Git inspection failed')
    if len(p.stdout) > 8_000_000: raise ValueError('Repository metadata exceeds limit')
    return p.stdout


def prepare(repo: Path, commit: str, out: Path) -> dict:
    if not re.fullmatch('[a-f0-9]{40}', commit): raise ValueError('Full immutable source commit required')
    if out.exists(): raise ValueError('Output must be a fresh scratch directory')
    rows = git_read(repo, ['ls-tree', '-rz', '--full-tree', commit]).split(b'\0')
    omitted = []
    for row in filter(None, rows):
        path = row.split(b'\t', 1)[1].decode('utf8')
        if not source_path_allowed(path): omitted.append(path)
    # Audit needs to see the omission, not silently treat the sanitized copy as a full checkout.
    out.mkdir(parents=True, mode=0o700)
    src = out / 'source'
    stats = snapshot(repo, commit, src, exclude_paths=set(omitted))
    for path in src.rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
    src.chmod(0o755)
    dirty_raw = git_read(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=normal'])
    # Preserve machine status records, not contents. Rename source/destination remain visible.
    dirty = [part.decode('utf8', 'replace') for part in dirty_raw.split(b'\0') if part]
    paths = file_paths(src)
    manifest = {p: sha((src/p).read_bytes()) for p in paths}
    report = {'format': 'jarvis-source-snapshot-v1', 'sourceCommit': commit,
              'sourceFiles': manifest, 'sourceDigest': sha(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()),
              'omittedSensitivePaths': sorted(omitted), 'dirtyStatusRecords': dirty,
              'dirtyBytesCopied': False, 'secretsProvenAbsent': False, 'isolationEstablished': False,
              'limitations': ['Tracked secrets with innocent names require owner inspection.',
                              'This is committed source only, without Git history or credential directories.',
                              'Prepare is an operator-side read, not a builder command in a live credentialed checkout.']}
    (out/'SOURCE_SNAPSHOT.json').write_text(json.dumps(report, indent=2)+'\n')
    return {'prepared': str(out), 'sourceCommit': commit, 'files': stats['files'],
            'omittedPaths': len(omitted), 'dirtyRecords': len(dirty), 'isolationEstablished': False}


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo', type=Path, required=True);p.add_argument('--commit', required=True);p.add_argument('--out', type=Path, required=True);a=p.parse_args()
    try: print(json.dumps(prepare(a.repo.resolve(), a.commit, a.out.resolve()), indent=2))
    except Exception as e: print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
