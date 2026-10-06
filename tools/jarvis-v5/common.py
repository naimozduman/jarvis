"""Data-only helpers. No imports, commands or plugins are read from a candidate pack."""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path, PurePosixPath

MAX_BYTES=2_000_000
SKIP_DIRS={'.git','__pycache__','.venv','node_modules'}

def safe_path(root: Path, rel: str) -> Path:
    p=PurePosixPath(rel)
    if not rel or p.is_absolute() or '..' in p.parts or '\\' in rel or ':' in p.parts[0]:
        raise ValueError(f'Unsafe relative path: {rel!r}')
    q=root
    for part in p.parts:
        q=q/part
        if q.is_symlink(): raise ValueError(f'Symlink refused: {rel}')
    if not q.resolve().is_relative_to(root.resolve()): raise ValueError('Path escapes root')
    return q

def read_bytes(root: Path, rel: str) -> bytes:
    p=safe_path(root,rel)
    if p.stat().st_size>MAX_BYTES: raise ValueError(f'Oversized data file: {rel}')
    return p.read_bytes()

def read_json(root: Path, rel: str):
    def unique(items):
        d={}
        for k,v in items:
            if k in d: raise ValueError(f'Duplicate JSON key {k} in {rel}')
            d[k]=v
        return d
    return json.loads(read_bytes(root,rel),object_pairs_hook=unique,parse_constant=lambda v: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))

def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest()

def frontmatter(text: str) -> tuple[dict,str]:
    """Strict generated V4 subset: one JSON value per YAML key. It is valid YAML, not a general YAML parser."""
    if not text.startswith('---\n'): raise ValueError('Frontmatter delimiter must start at byte zero')
    end=text.find('\n---\n',4)
    if end<0: raise ValueError('Unclosed frontmatter')
    fields={}
    for line in text[4:end].splitlines():
        if not line: continue
        m=re.fullmatch(r'([a-z_][a-z0-9_]*): (.+)',line)
        if not m: raise ValueError('Expected one unindented JSON-compatible YAML field per line')
        k,val=m.groups()
        if k in fields: raise ValueError('Duplicate frontmatter key')
        fields[k]=json.loads(val)
    return fields,text[end+5:].lstrip()

def file_paths(root: Path):
    result=[]
    for p in root.rglob('*'):
        rel=p.relative_to(root)
        if any(x in SKIP_DIRS for x in rel.parts): continue
        if p.is_symlink(): raise ValueError('Symlink in candidate: '+rel.as_posix())
        if p.is_file(): result.append(rel.as_posix())
    return sorted(result)

def infer_class(path: str) -> str:
    if path.startswith('reference/'): return 'archival_source'
    if path.startswith('schemas/'): return 'draft_contract' if path.endswith('.json') else 'schema_guidance'
    if path.startswith('governance/'): return 'governance_registry'
    if path.startswith('tools/'): return 'executable_or_test_tool'
    if path.startswith('tests/'): return 'synthetic_fixture'
    if path.startswith('.codex/'): return 'coding_agent'
    if path.startswith('integration/'): return 'integration_example'
    if path.startswith('generated/'): return 'generated_preview'
    return 'document_or_template'

def make_index(root: Path, paths=None):
    records=[]
    for rel in (file_paths(root) if paths is None else sorted(paths)):
        p=safe_path(root,rel)
        meta={}
        if rel.endswith('.md') and not rel.startswith('reference/'):
            meta,_=frontmatter(p.read_text(encoding='utf8'))
        exclusions=rel in ['docs/DOC_INDEX.json','SHA256SUMS.txt']
        records.append({'path':rel,'title':meta.get('title',p.name),'kind':meta.get('authority_class',infer_class(rel)),
                        'status':meta.get('status','reference' if rel.startswith('reference/') else 'pack_artifact'),
                        'sha256':None if exclusions else sha(p.read_bytes()),'bytes':None if exclusions else p.stat().st_size,
                        'hashExclusionReason':'recursive self/index boundary' if exclusions else None})
    return {'indexVersion':1,'scope':'V5 managed engineering files, not untouched application source','packVersion':'5.0.0','files':records}
