"""Read-only overlay plan. No apply/reset/clean/stash/push/deploy implementation exists here."""
import argparse,json,subprocess
from pathlib import Path
from common import read_json,sha,safe_path

def git(repo,args):
 r=subprocess.run(['git','--no-pager',*args],cwd=repo,text=True,capture_output=True,check=True);return r.stdout.strip()
def plan(pack,repo):
 index=read_json(pack,'docs/DOC_INDEX.json');result={'repository':str(repo.resolve()),'pack':str(pack.resolve()),'appliesChanges':False,'blockers':[],'files':[]}
 try:result['head']=git(repo,['rev-parse','HEAD']);result['branch']=git(repo,['branch','--show-current']);result['dirtyStatus']=git(repo,['status','--porcelain=v1'])
 except Exception:result['blockers'].append('Target is not a readable Git checkout');return result
 if not (repo/'packages').is_dir() or not (repo/'apps').is_dir():result['blockers'].append('Target does not look like the existing JARVIS monorepo')
 for n in range(1,16):
  if not list((repo/'docs/ADR').glob(f'{n:04d}-*.md')):result['blockers'].append(f'Missing expected historical ADR {n:04d}')
 if result['dirtyStatus']:result['blockers'].append('Dirty state requires explicit preservation/reconciliation; do not reset or stash automatically')
 for e in index['files']:
  rel=e['path']
  try:
   src=safe_path(pack,rel);dst=safe_path(repo,rel)
   before=sha(dst.read_bytes()) if dst.is_file() else None;after=sha(src.read_bytes())
   action='unchanged' if before==after else ('review_replace' if before else 'review_add')
   # Archived source, preview outputs and templates are input material, not mandatory repo overlay.
   if rel.startswith(('reference/','generated/','integration/')):action='reference_only_review_destination'
   result['files'].append({'path':rel,'action':action,'currentSha256':before,'proposedSha256':after})
  except Exception as exc:result['blockers'].append(str(exc))
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--pack',type=Path,required=True);p.add_argument('--repo',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 result=plan(a.pack,a.repo);a.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'plan':str(a.output),'blockers':len(result['blockers']),'applied':False}))
