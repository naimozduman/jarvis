"""Deterministic, data-only progressive context. Never executes source or loads plugins."""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from common import read_json, read_bytes, sha, safe_path, frontmatter

def build(root:Path, topic:str, mission_id:str|None=None, maximum:int|None=None):
    root=root.resolve();reg=read_json(root,'governance/CONTEXT_REGISTRY.json')
    topics={t['id']:t for t in reg['topics']}
    if topic not in topics:raise ValueError('Unknown topic: '+topic)
    t=topics[topic];limit=maximum if maximum is not None else reg['maxPacketUtf8Bytes']
    if type(limit) is not int or not 256<=limit<=reg['absoluteMaxPacketUtf8Bytes']:raise ValueError('Invalid context byte limit')
    missions={m['id']:m for m in read_json(root,'governance/ROADMAP.json')['missions']}
    mission=None
    if mission_id:
        if mission_id not in missions:raise ValueError('Unknown mission')
        mission=missions[mission_id]
        if topic!=mission['topic']:raise ValueError('Mission/topic mismatch; resolve the mission topic first')
    spec=read_json(root,'governance/PRODUCT_SPEC.json')
    all_reqs={r['id']:{**r,'origin':s['origin']} for s in spec['sections'] for r in s['requirements']}
    req_ids=list(dict.fromkeys(t['requirementIds']+(mission['requirementIds'] if mission else [])))
    if any(x not in all_reqs for x in req_ids):raise ValueError('Unmapped product requirement')
    inv={i['id']:i for i in read_json(root,'governance/INVARIANTS.json')['rules']}
    selected=[]
    for ident in t['invariantIds']:
        if ident not in inv:raise ValueError('Unknown context invariant')
        selected.append(inv[ident])
    header={'packetVersion':1,'topic':topic,'missionId':mission_id,'scope':'builder task context, not a runtime prompt or permission','requirements':[all_reqs[x] for x in req_ids],'invariants':selected}
    text='# JARVIS V5 task context\n\n'+json.dumps(header,ensure_ascii=False,indent=2)+'\n\n'
    selected_files=[];excluded=[]
    required=list(dict.fromkeys(reg['alwaysFiles']+t['requiredFiles']+([mission['path']]+mission['requiredReading'] if mission else [])))
    def add(rel,mandatory):
        nonlocal text
        if any(x['path']==rel for x in selected_files):return
        raw=read_bytes(root,rel);body=raw.decode('utf8')
        block='\n---\nSOURCE: '+rel+'\nSHA256: '+sha(raw)+'\n'+body+'\n'
        if len((text+block).encode())>limit:
            if mandatory:raise ValueError('Required context exceeds byte budget at '+rel+'; split scope, never truncate policy')
            excluded.append({'path':rel,'reason':'optional_byte_budget'});return
        text+=block;selected_files.append({'path':rel,'sha256':sha(raw),'utf8Bytes':len(raw),'required':mandatory})
    for rel in required:add(rel,True)
    if len(text.encode())>limit:raise ValueError('Required product context exceeds byte budget')
    for rel in t.get('optionalFiles',[]):add(rel,False)
    manifest={'packetVersion':1,'topic':topic,'missionId':mission_id,'utf8Bytes':len(text.encode()),'maxUtf8Bytes':limit,'sha256':sha(text.encode()),'requiredRequirementIds':req_ids,'invariantIds':t['invariantIds'],'files':selected_files,'excluded':excluded,'tokenCount':None,'tokenCountReason':'UTF-8 byte bounds are not a model tokenizer guarantee','sourceRegistrySha256':sha(read_bytes(root,'governance/CONTEXT_REGISTRY.json')),'permissionGranted':False}
    return text,manifest

def write(root,topic,mission,output,maximum=None):
    text,manifest=build(root,topic,mission,maximum)
    # Refuse any existing destination, including a symlink. Caller chooses approved scratch.
    if output.exists() or output.is_symlink():raise ValueError('Output already exists')
    output.mkdir(parents=True,exist_ok=False)
    (output/'CONTEXT.md').write_text(text,encoding='utf8');(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--topic',required=True);p.add_argument('--mission');p.add_argument('--output',type=Path,required=True);p.add_argument('--max-bytes',type=int);a=p.parse_args()
    try:print(json.dumps(write(a.root,a.topic,a.mission,a.output,a.max_bytes),indent=2))
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
