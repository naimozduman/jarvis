"""Trusted admission followed by bounded context export. Does not execute a mission.

Install this entry and its Node gate outside candidate control. A candidate-side
copy remains a development tool, not a trusted authorization mechanism.
"""
from __future__ import annotations
import argparse,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
from common import read_json,safe_path
from context import write

def prepare(root:Path,policy:Path,receipts:Path,mission:str,mode:str,output:Path,repo:Path|None=None,head:str|None=None):
    root=root.resolve();policy=policy.resolve();receipts=receipts.resolve()
    if mode not in ['audit','bootstrap-preparation','implementation']:raise ValueError('Unsupported mission mode')
    if mode=='implementation' and (repo is None or head is None):raise ValueError('Implementation requires repository and exact head')
    rows=read_json(root,'governance/ROADMAP.json')['missions'];matches=[x for x in rows if x['id']==mission]
    if len(matches)!=1:raise ValueError('Unknown/duplicate mission')
    gate=safe_path(root,'tools/jarvis-v5/mission_gate.mjs')
    node=shutil.which('node')
    if not node:raise ValueError('Node runtime unavailable')
    args=[node,str(gate),'--trusted-root',str(root),'--policy',str(policy),'--receipts',str(receipts),'--mission',mission,'--mode',mode]
    if repo is not None:args+=['--repo',str(repo.resolve())]
    if head is not None:args+=['--head',head]
    with tempfile.TemporaryDirectory(prefix='jarvis-admission-home-') as home:
        env={'PATH':os.environ.get('PATH',''),'HOME':home,'USERPROFILE':home,'GIT_CONFIG_NOSYSTEM':'1','GIT_TERMINAL_PROMPT':'0'}
        if os.name=='nt' and 'SystemRoot' in os.environ:env['SystemRoot']=os.environ['SystemRoot']
        result=subprocess.run(args,cwd=home,env=env,text=True,capture_output=True,timeout=60,check=False)
    if result.returncode!=0:raise ValueError('Admission denied: '+(result.stderr or result.stdout).strip()[:4000])
    admitted=json.loads(result.stdout)
    if admitted.get('allowed') is not True:raise ValueError('Admission missing positive result')
    # Reject writing a context export into the protected source itself.
    destination=output.resolve()
    if destination.is_relative_to(root) or (repo and destination.is_relative_to(repo.resolve())):
        raise ValueError('Choose a separate scratch output')
    manifest=write(root,matches[0]['topic'],mission,output)
    (output/'ADMISSION.json').write_text(json.dumps(admitted,indent=2)+'\n')
    return {'prepared':True,'missionId':mission,'mode':mode,'head':head,'contextSha256':manifest['sha256'],'output':str(output),'missionExecuted':False,'providerAuthorityGranted':False}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--trusted-root',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--receipts',type=Path,required=True);p.add_argument('--mission',required=True);p.add_argument('--mode',choices=['audit','bootstrap-preparation','implementation'],required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--repo',type=Path);p.add_argument('--head');a=p.parse_args()
    try:print(json.dumps(prepare(a.trusted_root,a.policy,a.receipts,a.mission,a.mode,a.output,a.repo,a.head),indent=2))
    except Exception as e:print(json.dumps({'prepared':False,'error':str(e)}));sys.exit(2)
