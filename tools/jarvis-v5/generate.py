"""Deterministic V5 human views and artifact/requirement registries.

Run on the standalone pack or an explicitly managed inventory. Does not accept
requirements, mark missions complete, or scan an application checkout by default.
"""
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
from common import read_json,read_bytes,file_paths,frontmatter,infer_class,safe_path
GENERATED = ['docs/PRD.md','docs/BUILD_PLAN.md','BUILD_ORDER.md','docs/WORKING_STATE.md',
             'docs/ENFORCEMENT_STATUS.md','governance/REQUIREMENT_TRACE.json',
             'governance/ARTIFACT_REGISTRY.json','MANIFEST.md']

def md(title,body,owner='architecture_planner'):
    meta={'title':title,'document_id':title.lower().replace(' ','-'),'status':'generated',
          'authority_class':'generated','owner_role':owner,'created_at':'2026-09-26',
          'reviewed_at':None,'review_evidence':None,'review_triggers':['scope_change','contract_change'],
          'pack_version':'5.0.0'}
    return '---\n'+''.join(k+': '+json.dumps(v,ensure_ascii=False)+'\n' for k,v in meta.items())+'---\n\n'+body.rstrip()+'\n'

def views(root:Path,managed=False):
    root=root.resolve()
    if any((root/x).exists() for x in ['apps','packages']):
        raise ValueError('Legacy standalone V5 generator cannot write an application checkout; use tools/jarvis-docs/manage.py.')
    if not managed and any((root/x).exists() for x in ['apps','packages']):
        raise ValueError('Application checkout detected: use the reviewed managed inventory')
    existing=(set(e['path'] for e in read_json(root,'docs/DOC_INDEX.json')['files'])
              if managed else set(file_paths(root)))
    paths=existing|set(GENERATED)|{'docs/DOC_INDEX.json','SHA256SUMS.txt'}
    spec=read_json(root,'governance/PRODUCT_SPEC.json')
    missions=read_json(root,'governance/ROADMAP.json')['missions']
    reqs={r['id']:r for s in spec['sections'] for r in s['requirements']}
    if len(reqs)!=sum(len(s['requirements']) for s in spec['sections']):raise ValueError('Duplicate requirement')
    body=['# JARVIS Personal Operating System: V5 product specification',
          'Generated from `governance/PRODUCT_SPEC.json`. Use bounded task context for routine work. The complete original V2 source remains in `reference/source/`. Historical implementation claims are not current state.',
          'Product direction does not grant execution authority. Repository acceptance and owner policy enrollment are separate steps.',
          '## Contents']+['- '+s['title'] for s in spec['sections']]
    for number,s in enumerate(spec['sections'],1):
        body += [f"## {number}. {s['title']}",'Origin: '+s['origin'],s['intent']]
        for r in s['requirements']:body += ['### '+r['id'],r['requirement'],'Acceptance: '+r['acceptance']]
    body += ['## Adoption and decisions',
             'This product reference is a candidate for repository adoption. No section accepts an ADR, enables a connector, grants a lease or chooses a paid budget. Values for spending, notifications, retention, recovery custody and optional authority-expansion delays remain owner decisions. Engineering evidence does not substitute for those decisions.',
             '## Completeness boundary',
             'The reference covers the requested product direction and engineering program. Each mission still needs a bounded implementation design for its real code and providers. Current provider limits, device restrictions, model IDs and local machine state need verification before use.']
    out={'docs/PRD.md':md('JARVIS V5 complete product specification','\n\n'.join(body))}
    rows=['# Implementation roadmap','', 'Source: `governance/ROADMAP.json`. Mission identifiers are stable. Filenames and former phase numbers do not authorize work.', '', '| Mission | Work | Prerequisites | Entry |', '| --- | --- | --- | --- |']
    for m in missions:
        rows.append(f"| {m['id']} | {m['title']} | {', '.join(m['dependsOn']) or 'None'} | [{m['id']}](../{m['path']}) |")
    rows+=['','M00 reads a sanitized snapshot. M01 prepares and installs trust. Neither claims installation merely by existing. Every implementation admission requires authentic prerequisites. A completed mission is recertified, not blindly rerun, when its definition or trust epoch changes.',
           '', 'M09 defines the proposed 30-day evidence window for unattended expansion. Control-center and read-only feature work need not wait for that window. M18 gates external writers. Android is not a prerequisite for a web/API executor. Browser organization work does not imply browser write authority.',
           '', 'The full old-to-new mission mapping is `governance/MISSION_TRANSITION.json`. No V4 completion automatically becomes V5 evidence.']
    out['docs/BUILD_PLAN.md']=md('V5 generated build plan','\n'.join(rows))
    out['BUILD_ORDER.md']=md('V5 build order','# Build order\n\nThe owning sequence is [ROADMAP](governance/ROADMAP.json). Read [the generated plan](docs/BUILD_PLAN.md) for all 24 missions and [START_HERE](START_HERE.md) for integration.\n\nPreserve the repository, install trust, reconcile existing code, then expand one bounded feature at a time. There is no automatic run-all command. Mission status in a file is descriptive; trusted receipts determine admission.')
    state=read_json(root,'governance/STATE.json')
    out['docs/WORKING_STATE.md']=md('Current engineering handoff','# Engineering handoff\n\nGenerated from `governance/STATE.json`. This file is descriptive and grants no runtime or deployment authority.\n\n```json\n'+json.dumps(state,indent=2,ensure_ascii=False)+'\n```')
    controls=read_json(root,'governance/CONTROL_MATRIX.json')['controls']
    rows=['# Enforcement status','','`implemented_pack` means delivered tooling with local tests. `reference_only` means a synthetic model or draft contract. `specified_not_implemented` means a requirement. None means deployed automatically.', '', '| Control | Status | Delivered artifact | Remaining installation or implementation | Before |','| --- | --- | --- | --- | --- |']
    for c in controls:rows.append(f"| {c['id']} | {c['status']} | `{c['artifact']}` | {c['remaining']} | {c['beforeMission']} |")
    rows+=['','Current test evidence is in `VALIDATION_REPORT.md`. Source observations are in `governance/RECONCILIATION.json`. Pack tests do not certify actual database transactions, local Docker isolation, privileged provider calls or branch protection.']
    out['docs/ENFORCEMENT_STATUS.md']=md('V5 enforcement status','\n'.join(rows),'security_reviewer')
    trace=[]
    for s in spec['sections']:
        for r in s['requirements']:
            owners=[m['id'] for m in missions if r['id'] in m['requirementIds']]
            trace.append({'requirementId':r['id'],'section':s['id'],'missions':owners,'acceptance':r['acceptance'],'runtimeProof':None})
    out['governance/REQUIREMENT_TRACE.json']=json.dumps({'traceVersion':1,'source':'governance/PRODUCT_SPEC.json','entries':trace},indent=2,ensure_ascii=False)+'\n'
    consumers={p:[] for p in paths}
    def link(path,label):
        if path in consumers and label not in consumers[path]:consumers[path].append(label)
    for m in missions:
        for p in [m['path'],*m['requiredReading']]:link(p,m['id'])
    for t in read_json(root,'governance/CONTEXT_REGISTRY.json')['topics']:
        for p in t['requiredFiles']+t.get('optionalFiles',[]):link(p,'context:'+t['id'])
    for p in read_json(root,'governance/CONTEXT_REGISTRY.json')['alwaysFiles']:link(p,'context:always')
    for c in read_json(root,'governance/SCHEMA_REGISTRY.json')['contracts']:
        for p in [c['path'],c['fixture']]:link(p,c['contractId'])
    ag=read_json(root,'governance/AGENT_REGISTRY.json')
    for a in ag['agents']+ag['skills']:link(a['path'],'agent-registry:'+a['name'])
    for a in read_json(root,'governance/PROMPT_REGISTRY.json')['modules']:link(a['path'],'prompt:'+a['id'])
    for e in read_json(root,'governance/EVAL_CATALOG.json')['entries']:
        if e.get('path'):link(e['path'],e['id'])
    artifacts=[]
    for p in sorted(paths):
        archived=p.startswith('reference/');generated=p in GENERATED or p.startswith('generated/') or p in ['docs/DOC_INDEX.json','SHA256SUMS.txt']
        meta={}
        if p in out and p.endswith('.md'):meta,_=frontmatter(out[p])
        elif p.endswith('.md') and not archived and (root/p).exists():meta,_=frontmatter(read_bytes(root,p).decode())
        status='historical' if archived else ('generated' if generated else meta.get('status','supporting'))
        role=meta.get('owner_role','release_operator')
        artifacts.append({'path':p,'class':meta.get('authority_class',infer_class(p)),'status':status,'owner':role,
                          'immutableHistory':archived,'consumers':sorted(consumers[p]),'successor':None,
                          'retentionReason':'Original source/provenance, never runtime instructions' if archived else ('Derived from a registry, regenerate instead of hand-editing' if generated else ('Referenced by registered work' if consumers[p] else 'Supporting artifact; requires consumer review before removal')),
                          'removalPrerequisite':'Preserve original archive' if archived else 'Approved retirement with exact hash and consumer review'})
    out['governance/ARTIFACT_REGISTRY.json']=json.dumps({'registryVersion':1,'scope':'managed V5 pack artifacts, not automatic discovery of all application files','dynamicConsumersRequireReview':True,'artifacts':artifacts},indent=2,ensure_ascii=False)+'\n'
    rows=['# V5 file manifest','',f'This inventory contains {len(paths)} managed files. It includes archival sources, generated views, tooling, tests and draft product contracts, not a standalone JARVIS application.',
          '', 'Exact hashes are in `docs/DOC_INDEX.json` and `SHA256SUMS.txt`. Artifact lifecycle and registered consumers are in `governance/ARTIFACT_REGISTRY.json`. No root application package, lockfile, workspace, environment or Docker-service configuration is replaced.',
          '', '| Path | Class |','| --- | --- |']
    for a in artifacts:rows.append(f"| `{a['path']}` | {a['class']} |")
    out['MANIFEST.md']=md('V5 file manifest','\n'.join(rows),'release_operator')
    return out

def generate(root,managed=False):
    output=views(root,managed)
    for rel,text in output.items():
        p=safe_path(root,rel);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf8')
    return {'generated':list(output),'authorityGranted':False}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--managed',action='store_true');a=p.parse_args()
    try:print(json.dumps(generate(a.root.resolve(),a.managed),indent=2))
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
