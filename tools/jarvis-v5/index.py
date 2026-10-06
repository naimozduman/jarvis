"""Refresh a standalone pack or an explicit managed inventory. Never sweep a live repo by default."""
import argparse,json,sys
from pathlib import Path
from common import make_index,sha,file_paths,read_json,read_bytes,safe_path

def refresh(root,managed=False,add=()):
    if any((root/x).exists() for x in ['apps','packages']):
        raise ValueError('Legacy standalone V5 index cannot write an application checkout; use tools/jarvis-docs/manage.py.')
    if not managed and ((root/'apps').exists() or (root/'packages').exists()):
        raise ValueError('Application checkout detected. Use --managed to refresh only the existing reviewed inventory.')
    if managed:
        records=read_json(root,'docs/DOC_INDEX.json')['files'];paths={e['path'] for e in records}|set(add)
    else:paths=set(file_paths(root))|set(add)
    paths|={'docs/DOC_INDEX.json','SHA256SUMS.txt'}
    # No environment, key, session or credential files are valid managed pack inputs.
    for rel in paths:
        parts=Path(rel).parts;name=parts[-1]
        if name.startswith('.env') or name.endswith('.pem') or any(x in parts for x in ['.git','node_modules','.venv']):raise ValueError('Sensitive or dependency path refused: '+rel)
        safe_path(root,rel)
    (root/'docs').mkdir(exist_ok=True);(root/'docs/DOC_INDEX.json').touch(exist_ok=True);(root/'SHA256SUMS.txt').touch(exist_ok=True)
    index=make_index(root,paths);(root/'docs/DOC_INDEX.json').write_text(json.dumps(index,indent=2,ensure_ascii=False)+'\n')
    lines=[sha(read_bytes(root,rel))+'  '+rel for rel in sorted(paths) if rel!='SHA256SUMS.txt']
    (root/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n')
    return {'indexedFiles':len(paths),'mode':'managed' if managed else 'pack','selfHashExclusions':['docs/DOC_INDEX.json','SHA256SUMS.txt']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--managed',action='store_true');p.add_argument('--add',action='append',default=[]);a=p.parse_args()
    try:print(json.dumps(refresh(a.root.resolve(),a.managed,a.add)))
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
