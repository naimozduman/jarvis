"""Read-only code disposition and overlay collision planning. No git, shell, network or writes to source."""
from __future__ import annotations
import argparse,json,sys,hashlib
from pathlib import Path
from common import read_json,read_bytes,sha,safe_path,file_paths
PROTECTED_ROOT_FILES={'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','.env.example','docker-compose.local.yml'}
def git_blob(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def plan(pack:Path,source:Path):
 pack=pack.resolve();source=source.resolve()
 if pack==source or pack.is_relative_to(source) or source.is_relative_to(pack):raise ValueError('Keep pack and sanitized source separate')
 base=read_json(pack,'governance/RECONCILIATION.json');observed=[]
 for item in base['observations']:
  p=safe_path(source,item['path'])
  if not p.exists():observed.append({'id':item['id'],'path':item['path'],'match':'not_present','disposition':'unresolved','reason':'Absence in sanitized input is not proof of absence in repository'});continue
  raw=read_bytes(source,item['path']);match=git_blob(raw)==item['gitBlobSha']
  observed.append({'id':item['id'],'path':item['path'],'match':'matches_pinned_observation' if match else 'changed_since_observation','sha256':sha(raw),'disposition':item['proposedDisposition'] if match else 'unresolved','requiredProof':item['requiredProof']})
 candidates=[]
 for rel in file_paths(pack):
  if rel.startswith(('reference/','validation/','generated/','tests/','integration/')):classification='supporting_input_not_blind_overlay'
  elif rel in PROTECTED_ROOT_FILES or rel.startswith(('packages/database/drizzle/','docs/ADR/0','docs/progress/')):classification='preserve_existing_manual_review'
  else:classification='candidate'
  target=safe_path(source,rel)
  if target.exists() and target.is_dir():status='type_conflict';before=None
  elif target.exists():before=sha(read_bytes(source,rel));status='identical' if before==sha(read_bytes(pack,rel)) else 'collision_requires_review'
  else:before=None;status='new_candidate'
  candidates.append({'path':rel,'classification':classification,'status':status,'beforeSha256':before,'candidateSha256':sha(read_bytes(pack,rel))})
 return {'planVersion':1,'scope':'inert sanitized-source comparison, no live state or application tests','sourceBaseline':base['checkpoint'],'observations':observed,'files':candidates,'sourceModified':False,'runtimeAuthorityGranted':False,'machineConfigsToReplace':[]}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--pack',type=Path,required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 try:
  out=plan(a.pack,a.source)
  if a.output.resolve().is_relative_to(a.source.resolve()):raise ValueError('Write only to separate approved scratch')
  with a.output.open('x') as f:json.dump(out,f,indent=2);f.write('\n')
  print(json.dumps({'written':str(a.output),'sourceModified':False}))
 except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
