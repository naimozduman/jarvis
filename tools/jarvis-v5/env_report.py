"""Read-only environment-reference inventory. Heuristic findings are not a complete AST proof."""
import argparse,json,re,sys
from pathlib import Path

def inventory(root):
    refs={};examples=set();dynamic=[]
    p=root/'.env.example'
    if p.exists():examples=set(re.findall(r'^([A-Z][A-Z0-9_]*)=',p.read_text(),re.M))
    for directory in ['apps','packages','convex','scripts']:
        for f in (root/directory).rglob('*') if (root/directory).exists() else []:
            if f.is_symlink() or not f.is_file() or f.suffix not in ['.ts','.tsx','.js','.mjs'] or f.stat().st_size>2_000_000:continue
            text=f.read_text(errors='replace');rel=f.relative_to(root).as_posix()
            names=set(re.findall(r'process\.env\.([A-Z][A-Z0-9_]*)',text))|set(re.findall(r'process\.env\[["\']([A-Z][A-Z0-9_]*)["\']\]',text))
            # Common validated config schemas own keys even when accessed through an alias.
            if rel.startswith('packages/config/'):
                names|=set(re.findall(r'^\s*([A-Z][A-Z0-9_]{2,})\s*:',text,re.M))
            for name in names:refs.setdefault(name,[]).append(rel)
            if re.search(r'process\.env\[(?!["\'])',text):dynamic.append(rel)
    platform={'CI','NODE_ENV','PATH','HOME','PORT','VERCEL','VERCEL_ENV','VERCEL_URL','VERCEL_OIDC_TOKEN'}
    missing=sorted(set(refs)-examples-platform)
    return {'referenced':refs,'missingFromExample':missing,'documentedNotStaticallyReferenced':sorted(examples-set(refs)),'dynamicReferences':dynamic,'platformKeysExcluded':sorted(platform),'scope':'heuristic inventory only; validate configuration schema and dynamic keys manually'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--fail-on-missing',action='store_true');a=p.parse_args();r=inventory(a.repo);print(json.dumps(r,indent=2));sys.exit(2 if a.fail_on_missing and r['missingFromExample'] else 0)
