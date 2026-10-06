"""Compare registered draft contracts/prompts to trusted base data without importing either."""
import argparse,json,sys
from pathlib import Path
from common import read_json,read_bytes,sha

def compare(base,head):
 errors=[];checked=0
 for registry,key,idkey,version in [('governance/PROMPT_REGISTRY.json','modules','id','version'),('governance/SCHEMA_REGISTRY.json','contracts','contractId','contractVersion')]:
  old={x[idkey]:x for x in read_json(base,registry)[key]};new={x[idkey]:x for x in read_json(head,registry)[key]}
  for ident,entry in old.items():
   if ident not in new:
    errors.append('Registered item removed without lifecycle transition: '+ident);continue
   after=new[ident];checked+=1
   if sha(read_bytes(base,entry['path']))!=sha(read_bytes(head,after['path'])) and entry[version]==after[version]:errors.append('Content changed without version increment: '+ident)
 return {'passed':not errors,'errors':errors,'registeredItemsCompared':checked,'scope':'version-change presence only, not semantic compatibility or monotonic semver proof'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--base-root',type=Path,required=True);p.add_argument('--head-root',type=Path,required=True);a=p.parse_args()
 try:r=compare(a.base_root,a.head_root);print(json.dumps(r,indent=2));sys.exit(0 if r['passed'] else 2)
 except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
