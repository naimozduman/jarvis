"""Data-only canonical PRD rendering and an explicitly managed document index.

No application imports, installs, providers, signers, Git operations or directory sweep.
Legacy standalone V5 generators remain fenced from the application root.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys

SPEC = 'governance/PRODUCT_SPEC.json'
PRD = 'docs/product/JARVIS_PRD_V5.md'
MANAGED = 'governance/DOCUMENTATION_MANAGED_PATHS.json'
INDEX = 'docs/DOC_INDEX.json'
SUMS = 'docs/DOC_SHA256SUMS.txt'

def safe(root: Path, relative: str) -> Path:
    p = PurePosixPath(relative)
    if not relative or p.is_absolute() or '..' in p.parts or '\\' in relative or ':' in relative:
        raise ValueError('Unsafe managed path')
    if any(part in {'.git', 'node_modules', '.venv'} for part in p.parts):
        raise ValueError('Private/dependency path refused')
    if p.name.startswith('.env') or p.suffix in {'.pem', '.key', '.p12'}:
        raise ValueError('Credential path refused')
    target = root
    for part in p.parts:
        target = target / part
        if target.is_symlink():
            raise ValueError('Symlink refused')
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('Managed path escapes root')
    return target

def read_json(root: Path, relative: str):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Duplicate JSON key')
            result[key] = value
        return result
    return json.loads(safe(root, relative).read_text(encoding='utf-8'), object_pairs_hook=unique)

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def product_view(root: Path) -> str:
    spec = read_json(root, SPEC)
    if spec.get('canonicalProductSource') != SPEC or spec.get('generatedReference') != PRD:
        raise ValueError('Canonical product source/output must match the fixed allowlist')
    ids = [r['id'] for section in spec['sections'] for r in section['requirements']]
    if len(ids) != len(set(ids)) or not ids:
        raise ValueError('Empty or duplicate product requirement identity')
    rows = ['# JARVIS Personal Operating System: V5 product specification',
            'Generated from [PRODUCT_SPEC](../../governance/PRODUCT_SPEC.json). Source SHA-256: ' + sha(safe(root, SPEC)) + '. Edit the structured source and regenerate this single human view.',
            'Canonical product intent was adopted under the October 5, 2026 owner reconciliation instruction. Requirements describe intended behavior; their original pack implementationStatus fields do not assert current application completion. [Current implementation](../architecture/CURRENT_IMPLEMENTATION.md) owns source evidence, and [decisions](DECISIONS.md) resolves supersession.',
            'Product adoption does not enroll trust, accept pending ADRs, choose a budget, activate draft consumers or grant runtime/deployment authority. [Linux executable validation](../../DEFERRED_VALIDATION.md) remains pending.',
            '## Contents']
    rows += ['- ' + section['title'] for section in spec['sections']]
    for number, section in enumerate(spec['sections'], 1):
        rows += ['## ' + str(number) + '. ' + section['title'],
                 'Origin: ' + section['origin'], section['intent']]
        for requirement in section['requirements']:
            if not all(isinstance(requirement.get(field), str) and requirement[field].strip()
                       for field in ('id', 'requirement', 'acceptance')):
                raise ValueError('Incomplete product requirement')
            rows += ['### ' + requirement['id'], requirement['requirement'],
                     'Acceptance: ' + requirement['acceptance']]
    rows += ['## Adoption and implementation boundary',
             'V5 wins newer product intent and architecture. Reconciled working implementation is preserved unless explicitly superseded. Later source-backed contracts and scoped accepted ADRs retain their role. Draft schemas, prompt modules, reference tooling, policy examples and mission definitions retain their documented adoption gates.',
             'All original V5 material is accounted in [the reconciliation manifest](../missions/V5_RECONCILIATION_MANIFEST.json) and recoverable from [the exact source archive](../archive/v5-source/JARVIS_V5_SOURCE_467_FILES.zip). Superseded V2 sources remain [archived](../archive/v2/README.md).']
    return '\n\n'.join(rows) + '\n'

def managed_paths(root: Path) -> list[str]:
    registry = read_json(root, MANAGED)
    paths = registry['paths']
    if not isinstance(paths, list) or any(not isinstance(p, str) for p in paths):
        raise ValueError('Invalid explicit managed inventory')
    if len(paths) != len(set(paths)):
        raise ValueError('Duplicate managed path')
    if INDEX not in paths or SUMS not in paths or PRD not in paths:
        raise ValueError('Managed output entries missing')
    for relative in paths:
        safe(root, relative)
    return sorted(paths)

def index_view(root: Path):
    entries = []
    for relative in managed_paths(root):
        path = safe(root, relative)
        excluded = relative in {INDEX, SUMS}
        if not excluded and not path.is_file():
            raise ValueError('Missing managed artifact: ' + relative)
        if relative.startswith('docs/archive/'):
            role = 'historical_source'
        elif relative.startswith(('templates/v5/', 'schemas/drafts/', 'prompts/runtime/modules/', 'integration/')):
            role = 'staged_design_or_example'
        elif relative.startswith('tools/jarvis-v5/'):
            role = 'reference_tooling'
        elif relative.startswith('docs/design/reference-skills/'):
            role = 'design_reference'
        elif relative.startswith('governance/') and relative != SPEC:
            role = 'governance_design_or_descriptive_registry'
        elif relative.startswith(('.agents/', '.codex/')):
            role = 'engineering_guidance'
        else:
            role = 'canonical_documentation_or_support'
        entries.append({'path': relative, 'role': role,
                        'sha256': None if excluded else sha(path),
                        'bytes': None if excluded else path.stat().st_size,
                        'hashExclusionReason': 'recursive index/checksum boundary' if excluded else None})
    return {'indexVersion': 2, 'scope': 'Explicit reviewed canonical documentation and V5 artifacts; application files use FINAL_TREE_MANIFEST.json.',
            'sourcePackFiles': 467, 'runtimeAdoptionImplied': False, 'files': entries}

def render(root: Path):
    content = product_view(root)
    target = safe(root, PRD)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8', newline='\n')

def index(root: Path):
    view = index_view(root)
    target = safe(root, INDEX)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(view, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    rows = [entry['sha256'] + '  ' + entry['path'] for entry in view['files']
            if entry['sha256'] is not None]
    rows.append(sha(target) + '  ' + INDEX)
    safe(root, SUMS).write_text('\n'.join(rows) + '\n', encoding='utf-8', newline='\n')

def check(root: Path):
    failures = []
    if safe(root, PRD).read_text(encoding='utf-8') != product_view(root):
        failures.append('PRD drift from PRODUCT_SPEC')
    actual = read_json(root, INDEX)
    if actual != index_view(root):
        failures.append('Managed document index drift')
    expected_sums = [entry['sha256'] + '  ' + entry['path'] for entry in actual['files']
                     if entry['sha256'] is not None]
    expected_sums.append(sha(safe(root, INDEX)) + '  ' + INDEX)
    if safe(root, SUMS).read_text(encoding='utf-8') != '\n'.join(expected_sums) + '\n':
        failures.append('Checksum inventory drift or missing entry')
    for line in safe(root, SUMS).read_text(encoding='utf-8').splitlines():
        value, relative = line.split('  ', 1)
        if sha(safe(root, relative)) != value:
            failures.append('Checksum mismatch: ' + relative)
    return {'pass': not failures, 'failures': failures, 'managedFiles': len(actual['files']),
            'applicationTestsRun': False, 'authorityGranted': False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('mode', choices=['render', 'index', 'check'])
    args = parser.parse_args()
    root = args.root.resolve()
    if args.mode == 'render':
        render(root)
    elif args.mode == 'index':
        index(root)
    else:
        result = check(root)
        print(json.dumps(result))
        if not result['pass']:
            return 1
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyError, TypeError, ValueError, OSError) as error:
        print(json.dumps({'pass': False, 'error': str(error)}))
        sys.exit(2)
