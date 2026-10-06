"""Data-only changed-area coverage check. Evidence references are not proof tests ran."""
from __future__ import annotations
import argparse, json, re, subprocess, sys, os
from pathlib import Path

SHA=re.compile(r'^[0-9a-f]{40}$')
def git(repo,*args):
    p=subprocess.run(['git','--no-pager','-c','core.hooksPath='+os.devnull,'-c','core.fsmonitor=false',*args],cwd=repo,capture_output=True,check=True,timeout=30,env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':os.devnull,'GIT_NO_REPLACE_OBJECTS':'1','GIT_TERMINAL_PROMPT':'0'})
    return p.stdout.decode('utf8')
def changed_paths(repo,base,head):
    if not SHA.fullmatch(base) or not SHA.fullmatch(head):raise ValueError('Use immutable full commit SHAs')
    # --no-ext-diff and no text conversion: candidate code must not execute.
    return [x for x in git(repo,'diff','--no-ext-diff','--no-textconv','--name-only','-z',base,head,'--').split('\0') if x]
def pattern_match(pattern,path):
    # Same small glob dialect as the trusted JS classifier. '*' never crosses '/'.
    out='^';i=0
    while i<len(pattern):
        c=pattern[i]
        if c=='*':
            if i+1<len(pattern) and pattern[i+1]=='*':out+='.*';i+=1
            else:out+='[^/]*'
        elif c=='?':out+='[^/]'
        elif pattern[i:i+5]=='[0-9]':out+='[0-9]';i+=4
        else:out+=re.escape(c)
        i+=1
    return re.fullmatch(out+'$',path) is not None

def matching(path,patterns):return any(pattern_match(p,path) for p in patterns)

def operational_paths(repo,base,head,policy_path):
    # Reuse mode-aware exact-tree classification, never candidate frontmatter.
    tool=Path(__file__).resolve().parent/'trust-gate.mjs'
    r=subprocess.run(['node',str(tool),'--repo',str(repo),'--base',base,'--head',head,
        '--policy',str(policy_path),'--inspect-only'],capture_output=True,text=True,timeout=60)
    if r.returncode:raise ValueError('Trusted path classification failed')
    data=json.loads(r.stdout)
    if data.get('base')!=base or data.get('head')!=head or data.get('auditOnly') is not True:raise ValueError('Bad classification result')
    return data['operationalPaths']
def evaluate(paths,mapping,record,base,head):
    errors=[];impacted=[];unknown=[]
    if record.get('schemaVersion')!=1 or record.get('baseSha')!=base or record.get('headSha')!=head:errors.append('Change-impact record must bind to exact base and head; keep it detached from the commit it names.')
    declarations=record.get('areas',[])
    if not isinstance(declarations,list):return {'passed':False,'errors':['areas must be an array']}
    byid={a.get('id'):a for a in declarations if isinstance(a,dict)}
    if len(byid)!=len(declarations):errors.append('Duplicate or invalid area declarations')
    for path in paths:
        areaids=[a['id'] for a in mapping['areas'] if matching(path,a['codePatterns'])]
        if (mapping.get('mapVersion')==2 or matching(path,mapping['sourceRoots'])) and not areaids:unknown.append(path)
        impacted.extend(areaids)
    for aid in sorted(set(impacted)):
        spec=next(a for a in mapping['areas'] if a['id']==aid);decl=byid.get(aid)
        if not decl:errors.append('Missing impact declaration: '+aid);continue
        updated=decl.get('docsUpdated',[]);reason=decl.get('noContractImpactReason')
        if not isinstance(updated,list):errors.append(aid+': docsUpdated must be an array');updated=[]
        if updated:
            if not any(p in spec['owningDocs'] and p in paths for p in updated):errors.append(aid+': owning document was not changed as declared')
        elif not isinstance(reason,str) or len(reason.strip())<20:errors.append(aid+': owning-doc update or meaningful no-contract-impact reason required')
        ev=decl.get('testEvidence',[])
        if not isinstance(ev,list) or not ev:errors.append(aid+': test evidence is required')
        else:
            for test in ev:
                if not isinstance(test,dict) or test.get('headSha')!=head or not test.get('runRef') or not isinstance(test.get('testPaths'),list) or not any(matching(p,spec['testPatterns']) for p in test.get('testPaths',[])):
                    errors.append(aid+': evidence must name exact head, run reference and a mapped test path')
    if unknown:errors.append('Unmapped source paths require a reviewed implementation-map update: '+', '.join(unknown))
    return {'passed':not errors,'errors':errors,'impactedAreas':sorted(set(impacted)),'unmappedPaths':unknown,'scope':'coverage declarations only; independent runner must authenticate evidence and execute relevant tests'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--base',required=True);p.add_argument('--head',required=True);p.add_argument('--map',type=Path,required=True);p.add_argument('--record',type=Path,required=True);p.add_argument('--policy',type=Path);a=p.parse_args()
    try:
        paths=changed_paths(a.repo,a.base,a.head)
        if a.policy:
            exempt=set(operational_paths(a.repo,a.base,a.head,a.policy));paths=[p for p in paths if p not in exempt]
        result=evaluate(paths,json.loads(a.map.read_text()),json.loads(a.record.read_text()),a.base,a.head)
        print(json.dumps(result,indent=2));sys.exit(0 if result['passed'] else 2)
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
