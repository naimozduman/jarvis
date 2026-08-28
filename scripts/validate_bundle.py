from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

required = [
    'AGENTS.md',
    'docs/PRD.md',
    'docs/ARCHITECTURE.md',
    'docs/SECURITY.md',
    '.codex/config.toml',
    'schemas/event.schema.json',
    'schemas/agent-decision.schema.json',
    'prompts/codex/00-bootstrap.md',
    'prompts/runtime/core-system.md',
]

for rel in required:
    if not (ROOT / rel).exists():
        errors.append(f'missing required file: {rel}')

for path in ROOT.rglob('*.json'):
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'invalid JSON {path.relative_to(ROOT)}: {exc}')

for path in ROOT.rglob('*.toml'):
    try:
        tomllib.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'invalid TOML {path.relative_to(ROOT)}: {exc}')

frontmatter_re = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
for skill in (ROOT / '.agents' / 'skills').glob('*/SKILL.md'):
    text = skill.read_text(encoding='utf-8')
    match = frontmatter_re.match(text)
    if not match:
        errors.append(f'missing frontmatter: {skill.relative_to(ROOT)}')
        continue
    meta = match.group(1)
    if not re.search(r'^name:\s*\S+', meta, re.MULTILINE):
        errors.append(f'missing skill name: {skill.relative_to(ROOT)}')
    if not re.search(r'^description:\s*\S+', meta, re.MULTILINE):
        errors.append(f'missing skill description: {skill.relative_to(ROOT)}')

for agent in (ROOT / '.codex' / 'agents').glob('*.toml'):
    data = tomllib.loads(agent.read_text(encoding='utf-8'))
    for key in ('name', 'description', 'developer_instructions'):
        if not data.get(key):
            errors.append(f'{agent.relative_to(ROOT)} missing {key}')

bad_patterns = {
    'private key marker': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'OpenAI key': r'\bsk-[A-Za-z0-9_-]{20,}\b',
    'Plaid secret assignment': r'PLAID_SECRET[ \t]*=[ \t]*[^\r\n# \t][^\r\n]*',
    'Google secret assignment': r'GOOGLE_CLIENT_SECRET[ \t]*=[ \t]*[^\r\n# \t][^\r\n]*',
}

for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix.lower() in {'.docx', '.pdf', '.zip', '.png', '.jpg', '.jpeg'}:
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    for label, pattern in bad_patterns.items():
        if re.search(pattern, text):
            errors.append(f'possible {label} in {path.relative_to(ROOT)}')

if errors:
    print('Bundle validation failed:')
    for error in errors:
        print(f'- {error}')
    sys.exit(1)

print('Bundle validation passed.')
print(f'Checked {sum(1 for p in ROOT.rglob("*") if p.is_file())} files.')
