"""Trusted, GET-only same-repository PR object/receipt collector.
Supports PR events and comment-triggered reevaluation. Never checks out candidate
code, runs candidate hooks, installs dependencies or evaluates comment text.
"""
from __future__ import annotations
import argparse,base64,json,os,re,subprocess,sys,urllib.request
from pathlib import Path
from promotion_evidence import strict_load, GitHubAPI, require


def collect(repo_path, event_path, out, api=None):
    event=strict_load(event_path.read_bytes())
    policy=strict_load((repo_path/'governance/TRUST_POLICY.json').read_bytes())
    expected=policy['repository']
    repo=event.get('repository',{}).get('full_name')
    require(repo==expected and re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo or ''), 'Unexpected repository event')
    supplied=event.get('pull_request')
    number=supplied.get('number',event.get('number')) if supplied else event.get('issue',{}).get('number')
    require(type(number) is int and number>0 and (supplied is not None or event.get('issue',{}).get('pull_request')), 'Expected a PR or PR-comment event')
    token=os.environ.get('GH_TOKEN','')
    api=api or GitHubAPI(token)
    current=api.json(f'repos/{repo}/pulls/{number}')
    require(current.get('state')=='open','PR is not open')
    base,head=current['base']['sha'],current['head']['sha']
    require(all(isinstance(s,str) and re.fullmatch('[0-9a-f]{40}',s) for s in [base,head]),'Invalid PR SHA')
    require(current['head']['repo']['full_name']==repo and current['base']['repo']['full_name']==repo,'Same-repository branches required')
    require(current['base']['ref'] in policy.get('acceptedBaseBranches',[]),'Untrusted base branch')
    if supplied:
        require(supplied['head']['sha']==head and supplied['base']['sha']==base,'PR changed since event; rerun')
    p=subprocess.run(['git','rev-parse','HEAD'],cwd=repo_path,capture_output=True,text=True,timeout=30)
    require(p.returncode==0 and p.stdout.strip()==base,'Trusted checkout is not the current PR base; rerun from accepted base')
    require(bool(token),'Read-only GitHub token required for exact object fetch')
    env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'GIT_TERMINAL_PROMPT':'0','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':os.devnull,
         'GIT_NO_REPLACE_OBJECTS':'1','GIT_CONFIG_COUNT':'1','GIT_CONFIG_KEY_0':'http.https://github.com/.extraheader',
         'GIT_CONFIG_VALUE_0':'AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+token).encode()).decode()}
    p=subprocess.run(['git','-c','core.hooksPath='+os.devnull,'-c','core.fsmonitor=false','fetch','--no-tags','--no-recurse-submodules',
                      'https://github.com/'+repo+'.git',base,head],cwd=repo_path,env=env,capture_output=True,timeout=90)
    require(p.returncode==0,'Exact Git object fetch failed; raw output suppressed')
    approvals=[];impacts=[];evidence=[]
    for page in range(1,11):
        comments=api.json(f'repos/{repo}/issues/{number}/comments?per_page=100&page={page}')
        require(isinstance(comments,list),'Invalid comment response')
        for comment in comments:
            body=comment.get('body','')
            if not isinstance(body,str) or len(body)>100000:continue
            for marker,target in [('JARVIS_GOVERNANCE_APPROVAL_V1\n',approvals),('JARVIS_CHANGE_IMPACT_V1\n',impacts),('JARVIS_EVIDENCE_V1\n',evidence)]:
                if body.startswith(marker):
                    try:value=strict_load(body[len(marker):])
                    except ValueError:continue
                    if isinstance(value,dict):target.append(value)
        if len(comments)<100:break
    else:raise ValueError('Comment listing truncated; use external gate or reduce receipt history')
    # Check again after potentially slow reads. The installed promotion controller must repeat
    # this at merge/deploy time; a green Actions check does not expire itself.
    final=api.json(f'repos/{repo}/pulls/{number}')
    require(final['head']['sha']==head and final['base']['sha']==base,'PR moved while collecting evidence')
    require(not out.exists(),'Receipt output already exists')
    out.mkdir(parents=True)
    for name,value in [('candidate',{'repository':repo,'base':base,'head':head,'pr':number}),('approvals',approvals),('evidence',evidence)]:
        (out/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
    exact=[i for i in impacts if i.get('baseSha')==base and i.get('headSha')==head]
    if exact:(out/'impact.json').write_text(json.dumps(exact[-1],indent=2)+'\n')
    return {'repository':repo,'base':base,'head':head,'pr':number,'approvalCandidates':len(approvals),
            'evidenceCandidates':len(evidence),'hasExactImpactReceipt':bool(exact),'candidateExecuted':False}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--event',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    try:print(json.dumps(collect(a.repo,a.event,a.out),indent=2))
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)[:200]}));sys.exit(2)
