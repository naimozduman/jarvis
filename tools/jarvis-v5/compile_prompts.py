"""Compile draft prompt previews; never modifies the application's active prompt registry."""
from __future__ import annotations
import argparse,json
from pathlib import Path
from common import read_json,read_bytes,frontmatter,sha

def compile_all(root:Path):
    registry=read_json(root,'governance/PROMPT_REGISTRY.json')
    inv=read_json(root,registry['invariantRegistry'])
    rules={x['id']:x for x in inv['rules']};mods={x['id']:x for x in registry['modules']}
    if len(mods)!=len(registry['modules']):raise ValueError('Duplicate prompt module')
    result={}
    for assembly in registry['assemblies']:
        used=[];texts=[];metas=[]
        for mid in assembly['modules']:
            m=mods[mid];raw=read_bytes(root,m['path']);fm,content=frontmatter(raw.decode('utf8'))
            if sha(raw)!=m['contentSha256']:raise ValueError('Module hash drift: '+mid)
            if len(raw)>m['maxUtf8Bytes']:raise ValueError('Module size exceeded: '+mid)
            if fm.get('id')!=mid or fm.get('version')!=m['version']:raise ValueError('Module metadata mismatch')
            for i in m['invariants']:
                if i not in rules:raise ValueError('Unknown invariant '+i)
                if i not in used:used.append(i)
            texts.append(f"[{mid}@{m['version']}]\n{content.strip()}")
            metas.append({'id':mid,'version':m['version'],'sha256':sha(raw)})
        policy='\n'.join('['+i+'] '+rules[i]['text'] for i in used)
        rendered=('JARVIS V5 DRAFT PROMPT PREVIEW. NOT ACTIVE RUNTIME CONFIGURATION.\n\n'+policy+'\n\n'+'\n\n'.join(texts)+'\n')
        if len(rendered.encode('utf8'))>assembly['maxUtf8Bytes']:raise ValueError('Assembly size exceeded: '+assembly['id'])
        manifest={'schemaVersion':1,'assemblyId':assembly['id'],'contractId':assembly['outputContract'],'status':'draft',
                  'invariantDigest':sha(read_bytes(root,registry['invariantRegistry'])),'modules':metas,
                  'contentSha256':sha(rendered.encode('utf8')),'utf8Bytes':len(rendered.encode('utf8')),'producerCommit':None}
        result[assembly['id']]=(rendered,manifest)
    return result

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--root',type=Path,required=True);a.add_argument('--out',type=Path,required=True);ns=a.parse_args()
    data=compile_all(ns.root.resolve());ns.out.mkdir(parents=True,exist_ok=True)
    for name,(text,manifest) in data.items():
        (ns.out/(name+'.txt')).write_text(text,encoding='utf8');(ns.out/(name+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'compiledDraftAssemblies':len(data),'activeRuntimeChanged':False}))
