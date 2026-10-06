"""Validate an artifact-removal proposal. This tool never deletes files or accepts a proposal."""
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
from common import read_json,read_bytes,sha

def check(root,proposal):
 registry=read_json(root,'governance/ARTIFACT_REGISTRY.json');entries={e['path']:e for e in registry['artifacts']}
 required={'path','expectedSha256','reason','successor','consumerReviewEvidence','remainingActiveConsumers'}
 if type(proposal) is not dict or set(proposal)!=required:raise ValueError('Unexpected retirement proposal')
 path=proposal['path'];entry=entries.get(path)
 if not entry:return {'eligibleForProposal':False,'reason':'unregistered_artifact'}
 if entry['immutableHistory']:return {'eligibleForProposal':False,'reason':'immutable_history'}
 if proposal['expectedSha256']!=sha(read_bytes(root,path)):return {'eligibleForProposal':False,'reason':'source_changed'}
 if not isinstance(proposal['reason'],str) or len(proposal['reason'].strip())<20:return {'eligibleForProposal':False,'reason':'missing_reason'}
 if type(proposal['remainingActiveConsumers']) is not list or proposal['remainingActiveConsumers']:return {'eligibleForProposal':False,'reason':'active_consumers'}
 if not proposal['consumerReviewEvidence']:return {'eligibleForProposal':False,'reason':'unverified_consumers'}
 successor=proposal['successor']
 if successor is not None and (successor==path or successor not in entries):return {'eligibleForProposal':False,'reason':'invalid_successor'}
 return {'eligibleForProposal':True,'deleted':False,'ownerPromotionRequired':True,'limitation':'Evidence authenticity and dynamic consumers require trusted review'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--proposal',type=Path,required=True);a=p.parse_args()
 try:r=check(a.root,read_json(a.proposal.parent,a.proposal.name));print(json.dumps(r,indent=2));sys.exit(0 if r['eligibleForProposal'] else 2)
 except Exception as e:print(json.dumps({'eligibleForProposal':False,'error':str(e)}));sys.exit(2)
