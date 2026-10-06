"""V5 cross-registry checks. Static coverage is not semantic proof or authorization."""
from pathlib import Path
import json
from common import read_json,read_bytes,file_paths
from generate import views
from context import build
from state import validate as validate_state

def check(root,result,mode):
    spec=read_json(root,'governance/PRODUCT_SPEC.json');roadmap=read_json(root,'governance/ROADMAP.json')
    reqs=[x['id'] for section in spec['sections'] for x in section['requirements']]
    result.require(len(reqs)==len(set(reqs)),'Duplicate product requirement ID')
    if mode=='pack':
        result.require(spec['status']=='proposed_for_repository_adoption' and spec['ownerApprovalRef'] is None,'Pack product adoption must remain explicit')
    else:
        result.require(spec['status'] in ['proposed_for_repository_adoption','accepted'],'Unknown product adoption state')
        if spec['status']=='accepted':result.require(bool(spec['ownerApprovalRef']),'Accepted product requires separately verified adoption evidence')
    covered=set();topics={x['id']:x for x in read_json(root,'governance/CONTEXT_REGISTRY.json')['topics']}
    for m in roadmap['missions']:
        result.require(set(m['requirementIds'])<=set(reqs),m['id']+': unknown product requirement')
        result.require(m['topic'] in topics,m['id']+': unknown context topic');covered.update(m['requirementIds'])
        try:build(root,m['topic'],m['id'])
        except Exception as e:result.error(m['id']+': context compilation failed: '+str(e))
    result.require(covered==set(reqs),'Requirement missing implementation mission')
    for topic in topics:
        try:build(root,topic)
        except Exception as e:result.error(topic+': invalid task context: '+str(e))
    result.counts['productRequirements']=len(reqs);result.counts['contextTopics']=len(topics)
    validate_state(read_json(root,'governance/STATE.json'))
    mp=read_json(root,'governance/MISSION_POLICY.json')
    if mode=='pack':
        result.require(mp['enabled'] is False and mp['signers']==[] and mp['installationEvidence'] is None,'Candidate mission policy unexpectedly enrolled')
    elif mp['enabled']:
        result.require(bool(mp['signers']) and bool(mp['installationEvidence']),'Enrolled mission policy lacks installation evidence')
    result.require(type(mp['enabled']) is bool,'Mission enrollment needs explicit boolean')
    ks=read_json(root,'templates/key-state.proposed.json')
    result.require(ks['operationalKeys']==[] and ks['recoveryKeys']==[],'Pack contains enrolled trust keys')
    for c in read_json(root,'governance/CONTROL_MATRIX.json')['controls']:
        result.require((root/c['artifact']).is_file(),'Missing control artifact '+c['id'])
        result.require(c['beforeMission'] in {m['id'] for m in roadmap['missions']},'Unmapped control mission '+c['id'])
    for rel,text in views(root,managed=mode=='repository').items():
        result.require((root/rel).exists() and read_bytes(root,rel).decode('utf8')==text,'Generated view drift: '+rel)
    registry=read_json(root,'governance/ARTIFACT_REGISTRY.json')
    listed=[a['path'] for a in registry['artifacts']]
    result.require(len(listed)==len(set(listed)),'Duplicate artifact registry entry')
    if mode=='pack':result.require(set(listed)==set(file_paths(root)),'Artifact registry coverage drift')
    for a in registry['artifacts']:
        result.require(bool(a['retentionReason']),'Artifact lacks retention reason '+a['path'])
    result.warnings.append('Structural validation does not authenticate installation evidence or prove a trusted runner. Pack profiles ship unenrolled.')
