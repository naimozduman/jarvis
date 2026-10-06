"""Descriptive handoff updates with a local lock and expected-hash check. Never grants authority."""
from __future__ import annotations
import argparse,json,os,sys,tempfile
from pathlib import Path
from common import read_json,read_bytes,sha,safe_path
from trusted_time import instant
FIELDS={'stateVersion','authority','missionId','runId','branch','baseCommit','headCommit','updatedAt','dirtyFiles','commands','blockers','nextSafeStep','nextChat','observationsRef','reconciliationRef'}
def validate(value):
    if type(value) is not dict or set(value)!=FIELDS:raise ValueError('Unexpected state fields')
    if type(value['stateVersion']) is not int or value['stateVersion']!=1 or value['authority']!='descriptive_only':raise ValueError('State cannot grant authority')
    if value['updatedAt'] is not None:instant(value['updatedAt'])
    for field in ['dirtyFiles','commands','blockers']:
        if type(value[field]) is not list or len(value[field])>500:raise ValueError('Invalid bounded state list')
    for k in ['baseCommit','headCommit']:
        if value[k] is not None:
            import re
            if not isinstance(value[k],str) or not re.fullmatch('[a-f0-9]{40}',value[k]):raise ValueError('Full commit SHA required')
    if len(json.dumps(value).encode())>200_000:raise ValueError('State size limit')
    return value

def update(root:Path,record:dict,expected:str):
    validate(record);path=safe_path(root,'governance/STATE.json');lock=path.with_suffix('.json.lock')
    fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    temp=None
    try:
        os.write(fd,str(os.getpid()).encode());os.fsync(fd)
        if sha(read_bytes(root,'governance/STATE.json'))!=expected:raise ValueError('State changed; re-read before handoff')
        # Local cooperating-process lock, not cross-machine consensus or an authority gate.
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf8',dir=path.parent,prefix='.state-',delete=False) as f:
            temp=Path(f.name);f.write(json.dumps(record,ensure_ascii=False,indent=2)+'\n');f.flush();os.fsync(f.fileno())
        os.replace(temp,path);temp=None
        return {'written':'governance/STATE.json','sha256':sha(path.read_bytes()),'authority':'descriptive_only'}
    finally:
        os.close(fd)
        if temp is not None:temp.unlink(missing_ok=True)
        lock.unlink(missing_ok=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--record',type=Path,required=True);p.add_argument('--expected-sha256',required=True);a=p.parse_args()
 try:print(json.dumps(update(a.root,read_json(a.record.parent,a.record.name),a.expected_sha256),indent=2))
 except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
