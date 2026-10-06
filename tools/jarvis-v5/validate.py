"""Strict local V5 pack/managed-file validation. Does not run candidate code or grant authority."""
from __future__ import annotations
import argparse,json,re,sys,tomllib
from pathlib import Path, PurePosixPath
from urllib.parse import unquote,urlsplit
from common import *
from compile_prompts import compile_all

class Result:
    def __init__(self):self.errors=[];self.warnings=[];self.counts={}
    def require(self,condition,message):
        if not condition:self.errors.append(message)
    def error(self,message):self.errors.append(message)
    def as_dict(self):return {'passed':not self.errors,'errors':self.errors,'warnings':self.warnings,'counts':self.counts,'scope':'structural pack validation; not deployed runtime certification'}

def validate(root:Path,mode='pack',check_index=True):
    r=Result();root=root.resolve()
    try:
        ap=read_json(root,'governance/ARTIFACT_POLICY.json');agents=read_json(root,'governance/AGENT_REGISTRY.json');roadmap=read_json(root,'governance/ROADMAP.json')
        paths=file_paths(root);pathset=set(paths)
        index=read_json(root,'docs/DOC_INDEX.json') if check_index else None
        managed={x['path'] for x in index['files']} if index else pathset
        inspectpaths=paths if mode=='pack' else sorted(managed)
        names={a['name'] for a in agents['agents']};skillnames={s['name'] for s in agents['skills']}
        r.require(len(names)==len(agents['agents']),'Duplicate agent names')
        r.counts['managedFiles']=len(inspectpaths)
        mdcount=0
        for rel in inspectpaths:
            try:
                raw=read_bytes(root,rel)
                if rel.endswith('.json'):read_json(root,rel)
                if rel.endswith('.toml'):tomllib.loads(raw.decode('utf8'))
                if rel.endswith('.md') and not rel.startswith('reference/'):
                    fm,content=frontmatter(raw.decode('utf8'));mdcount+=1
                    for k in ap['requiredMarkdownFields']:r.require(k in fm,f'{rel}: missing {k}')
                    r.require(fm.get('status') in ap['statuses'],f'{rel}: unsupported status')
                    r.require(fm.get('authority_class') in ap['classes'],f'{rel}: unsupported class')
                    r.require(fm.get('owner_role') in names,f'{rel}: unmapped owner role')
                    r.require(bool(fm.get('title')),f'{rel}: empty title')
                    r.require(all(t in ap['triggers'] for t in fm.get('review_triggers',[])),f'{rel}: unknown review trigger')
                    if fm.get('reviewed_at') is not None:r.require(bool(fm.get('review_evidence')),f'{rel}: review date without evidence')
                    # Markdown local links, not prose guesses about source-repo paths.
                    for dest in re.findall(r'(?<!!)\[[^\]]*\]\(([^)]+)\)',content):
                        dest=dest.split(' "',1)[0].strip('<>');u=urlsplit(dest)
                        if u.scheme or u.netloc or not u.path:continue
                        q=(root/rel).parent/unquote(u.path)
                        r.require(q.resolve().is_relative_to(root),f'{rel}: escaping link {dest}')
                        if q.resolve().is_relative_to(root):r.require(q.exists(),f'{rel}: broken local link {dest}')
            except Exception as e:r.error(f'{rel}: {e}')
        r.counts['markdownFiles']=mdcount
        for a in agents['agents']:
            try:
                t=tomllib.loads(read_bytes(root,a['path']).decode())
                r.require(t.get('name')==a['name'],f"Agent name mismatch: {a['path']}")
                for k in ['description','developer_instructions']:r.require(bool(t.get(k)),a['name']+': missing '+k)
                r.require(t.get('sandbox_mode') in ['read-only','workspace-write'],a['name']+': unsafe sandbox default')
                for s in a['skills']:r.require(s in skillnames,a['name']+': unknown skill '+s)
            except Exception as e:r.error(str(e))
        for s in agents['skills']:
            try:
                fm,_=frontmatter(read_bytes(root,s['path']).decode());r.require(fm.get('name')==s['name'],s['path']+': skill name mismatch');r.require(s['leadAgent'] in names,s['path']+': missing lead')
                r.require(bool(fm.get('description')),s['path']+': missing skill description')
            except Exception as e:r.error(str(e))
        r.counts['agents']=len(names);r.counts['skills']=len(skillnames)
        missions={m['id']:m for m in roadmap['missions']}
        r.require(len(missions)==len(roadmap['missions']),'Duplicate mission IDs')
        visited=set();active=set()
        def visit(mid):
            if mid in active:raise ValueError('Roadmap dependency cycle')
            if mid in visited:return
            active.add(mid)
            for dep in missions[mid]['dependsOn']:
                if dep not in missions:raise ValueError('Unknown mission dependency '+dep)
                visit(dep)
            active.remove(mid);visited.add(mid)
        for mid,m in missions.items():
            visit(mid);r.require(m['leadAgent'] in names,mid+': missing lead')
            r.require((root/m['path']).is_file(),mid+': missing prompt')
            for p in m['requiredReading']:r.require((root/p).is_file(),mid+': missing required file '+p)
            if m['runState']=='completed':r.require(bool(m.get('completedRunRef')),mid+': completion without evidence')
        r.counts['missions']=len(missions)
        sr=read_json(root,'governance/SCHEMA_REGISTRY.json');ids=set()
        for c in sr['contracts']:
            s=read_json(root,c['path']);sid=s.get('$id');r.require(bool(sid) and sid not in ids,c['path']+': missing/duplicate $id');ids.add(sid)
            r.require(s.get('$schema')=='https://json-schema.org/draft/2020-12/schema',c['path']+': wrong dialect')
            r.require(s.get('x-lifecycle')==c['status'],c['path']+': lifecycle mismatch')
            r.require(s.get('x-contract-id')==c['contractId'],c['path']+': contract ID mismatch')
            r.require(s.get('x-contract-version')==c['contractVersion'],c['path']+': contract version mismatch')
            if c['status'] in ['migrating','active']:r.require(bool(c['producerPaths']) and bool(c['consumerPaths']) and bool(c['promotionEvidence']),c['path']+': adoption without evidence')
            r.require((root/c['fixture']).is_file(),c['path']+': missing fixture')
        for c in sr['contracts']:
            s=read_json(root,c['path'])
            def refs(v):
                if isinstance(v,dict):
                    if '$ref' in v:r.require(v['$ref'].startswith('#') or v['$ref'] in ids,c['path']+': unregistered ref '+v['$ref'])
                    for x in v.values():refs(x)
                elif isinstance(v,list):
                    for x in v:refs(x)
            refs(s)
        r.counts['draftContracts']=len(sr['contracts'])
        inv=read_json(root,'governance/INVARIANTS.json');r.require(len({i['id'] for i in inv['rules']})==len(inv['rules']),'Duplicate invariant IDs')
        for i in inv['rules']:r.require((root/i['owningDoc']).is_file(),'Missing invariant owning doc '+i['id'])
        compiled=compile_all(root);r.counts['promptAssemblies']=len(compiled)
        for name,(text,manifest) in compiled.items():
            p=root/'generated/prompts'/f'{name}.txt';j=root/'generated/prompts'/f'{name}.json'
            r.require(p.exists() and p.read_text()==text,'Generated prompt drift: '+name)
            r.require(j.exists() and json.loads(j.read_text())==manifest,'Generated prompt manifest drift: '+name)
        if mode=='repository':
            for prefix in ['apps','packages']:
                for p in (root/prefix).rglob('*') if (root/prefix).exists() else []:
                    if p.is_file() and p.suffix in ['.ts','.tsx','.js','.mjs'] and p.stat().st_size<MAX_BYTES:
                        text=p.read_text(errors='replace')
                        if re.search(r'(?:import|require|readFile)[^\n]*[\"\'][^\"\']*(?:schemas/drafts|prompts/runtime/modules)',text):
                            r.error('Draft direct import/reference requires promotion: '+p.relative_to(root).as_posix())
            r.warnings.append('Dynamic contract loading and semantic source-code compatibility require mapped integration tests.')
        if check_index:
            entries=index['files'];seen=[e['path'] for e in entries];r.require(len(seen)==len(set(seen)),'Duplicate index paths')
            if mode=='pack':r.require(set(seen)==pathset,'Pack index coverage mismatch')
            for e in entries:
                rel=e['path'];raw=read_bytes(root,rel)
                if rel in ap['indexExclusions']:r.require(e['sha256'] is None and e['hashExclusionReason'],rel+': missing self-hash exclusion')
                else:r.require(e['sha256']==sha(raw) and e['bytes']==len(raw),'Index checksum mismatch: '+rel)
            checkfile=(root/'SHA256SUMS.txt').read_text().splitlines();seen_sums=set()
            for line in checkfile:
                h,rel=line.split('  ',1);r.require(rel not in seen_sums,'Duplicate checksum path');seen_sums.add(rel);r.require(h==sha(read_bytes(root,rel)),'SHA256SUMS mismatch: '+rel)
            r.require(seen_sums==set(seen)-{'SHA256SUMS.txt'},'SHA256SUMS coverage mismatch')
        # V4.1 structural checks are distinct from enrollment and live admission.
        trust=read_json(root,'governance/TRUST_POLICY.json')
        r.require(trust.get('policyVersion')==2 and trust.get('defaultClassification')=='protected','V4.1 protected-default policy required')
        r.require(trust.get('requireEnrolledKeyForPromotion') is True,'Enrollment cannot be optional for promotion')
        ep=read_json(root,'governance/EVIDENCE_POLICY.json')
        r.require(ep.get('evidencePolicyVersion')==1,'Unsupported evidence policy')
        r.require(type(ep.get('enabled')) is bool,'Evidence enrollment needs explicit boolean')
        ev=read_json(root,'governance/EVAL_CATALOG.json')
        ids={e['id'] for e in ev['entries']}
        im=read_json(root,'governance/IMPLEMENTATION_MAP.json')
        r.require(im.get('mapVersion')==2,'V4.1 implementation map required')
        for area in im['areas']:
            r.require(bool(area.get('requiredEvalIds')) and set(area['requiredEvalIds'])<=ids,'Unregistered/missing required eval for '+area['id'])
        for key,eids in ep['activationRequirements'].items():
            r.require(bool(eids) and set(eids)<=ids,'Invalid activation requirements: '+key)
        for entry in ev['entries']:
            if entry.get('status')!='planned':
                r.require(entry.get('path') in pathset and bool(entry.get('coveragePatterns')),'Eval source mapping missing: '+entry['id'])
        if ep['enabled']:
            r.require(bool(ep.get('signers')) and bool(ep.get('workflows')),'Enabled evidence policy lacks enrollment')
        else:r.warnings.append('Evidence policy not enrolled: local checks pass without granting promotion.')
        # Ensure no implied runtime budget enrollment is shipped accidentally.
        for rel in ['templates/policies/runtime-budget.proposed.json','templates/policies/authority.proposed.json','templates/policies/interruptions.proposed.json']:
            d=read_json(root,rel);r.require(d.get('enabled') is False and d.get('ownerApprovalRef') is None,rel+': proposal incorrectly activated')
        from v5_checks import check as check_v5
        check_v5(root,r,mode)
    except Exception as e:r.error(str(e))
    return r

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--mode',choices=['pack','repository'],default='pack');p.add_argument('--no-index',action='store_true');p.add_argument('--output',type=Path);a=p.parse_args()
    result=validate(a.root,a.mode,not a.no_index).as_dict();text=json.dumps(result,indent=2)
    if a.output:a.output.write_text(text+'\n')
    print(text);sys.exit(0 if result['passed'] else 2)
