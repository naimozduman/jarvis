"""Freshness and incident linkage reporter. Never manufactures a review or provider observation."""
from __future__ import annotations
import argparse,json,sys
from datetime import datetime,timezone
from pathlib import Path

def dt(s):
    if not isinstance(s,str) or not s:raise ValueError('Nonempty timezone timestamp required')
    v=datetime.fromisoformat(s.replace('Z','+00:00'))
    if not v.tzinfo:raise ValueError('Timezone required')
    return v.astimezone(timezone.utc)
def check(root,now,required=()):
    observations=json.loads((root/'governance/OBSERVATIONS.json').read_text());catalog=json.loads((root/'governance/EVAL_CATALOG.json').read_text())
    warnings=[];errors=[];states={}
    # The shipped observations have a deliberately narrow source scope.
    for o in observations.get('observations',[]):
        key=o.get('id',o.get('system','unnamed'));stamp=o.get('observedAt');ttl=o.get('maxAgeSeconds',86400)
        if not stamp:state='unknown'
        else:
            age=(now-dt(stamp)).total_seconds();state='future_invalid' if age<0 else 'stale' if age>ttl else 'fresh'
        states[key]=state
        if state!='fresh':warnings.append(key+': '+state)
    for key in required:
        if states.get(key)!='fresh':errors.append('Required observation is not fresh: '+key)
    for e in catalog['entries']:
        stamp=e.get('lastReviewedAt')
        if not stamp:warnings.append(e['id']+': independent review not recorded')
        elif not e.get('reviewEvidence'):errors.append(e['id']+': review timestamp without evidence')
        elif (now-dt(stamp)).total_seconds()>e['reviewIntervalDays']*86400:warnings.append(e['id']+': review overdue')
    d=root/'governance/incidents'
    if d.exists():
        for p in d.glob('*.json'):
            i=json.loads(p.read_text())
            if i.get('status') in ['resolved','closed'] and not i.get('regressionRefs') and not i.get('notTestableReason'):errors.append(p.name+': resolved incident lacks regression or explicit non-testable reason')
    return {'passed':not errors,'errors':errors,'warnings':warnings,'observations':states,'scope':'evidence structure and age, not validation of truth'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--now');p.add_argument('--require',action='append',default=[]);a=p.parse_args()
    try:r=check(a.root,dt(a.now) if a.now else datetime.now(timezone.utc),a.require);print(json.dumps(r,indent=2));sys.exit(0 if r['passed'] else 2)
    except Exception as e:print(json.dumps({'passed':False,'error':str(e)}));sys.exit(2)
