"""Materialize a candidate Git tree as inert files. Ignores export rules, filters and hooks."""
from __future__ import annotations
import argparse,json,re,subprocess,sys,os
from pathlib import Path, PurePosixPath

def run(repo,args):
    p=subprocess.run(['git','--no-pager','-c','core.hooksPath='+os.devnull,'-c','core.fsmonitor=false',*args],cwd=repo,check=True,capture_output=True,timeout=30,env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':os.devnull,'GIT_TERMINAL_PROMPT':'0','GIT_NO_REPLACE_OBJECTS':'1'})
    return p.stdout

def snapshot(repo,commit,destination,max_files=20000,max_bytes=100_000_000,exclude_paths=frozenset()):
    if not re.fullmatch('[a-f0-9]{40}',commit):raise ValueError('Full immutable SHA required')
    if destination.exists():raise ValueError('Destination must not exist')
    rows=run(repo,['ls-tree','-rz','--full-tree',commit]).split(b'\0');spec=[];total=0
    for row in filter(None,rows):
        meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split(' ');rel=path.decode('utf8');parts=PurePosixPath(rel).parts
        if kind!='blob' or mode not in ['100644','100755']:raise ValueError('Symlinks/submodules are not admitted to a data-only snapshot')
        if not parts or rel.startswith('/') or '\\' in rel or any(p in ['..','.git'] for p in parts):raise ValueError('Unsafe path')
        if rel in exclude_paths:continue
        n=int(run(repo,['cat-file','-s',oid]));total+=n
        if n>2_000_000 or total>max_bytes:raise ValueError('Candidate size limit exceeded')
        spec.append((rel,oid))
        if len(spec)>max_files:raise ValueError('Candidate file limit exceeded')
    destination.mkdir(parents=True)
    for rel,oid in spec:
        p=destination/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(run(repo,['cat-file','blob',oid]));p.chmod(0o600)
    return {'files':len(spec),'bytes':total,'commit':commit,'candidateExecuted':False}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--commit',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    try:print(json.dumps(snapshot(a.repo,a.commit,a.out),indent=2))
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
