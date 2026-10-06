"""Executable SPECIFICATION checks for synthetic fixtures, not production authorization code.
The caller must supply trusted server records. Nothing here authenticates a person or persists a lease.
"""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib,hmac,json

class Denied(ValueError): pass

def instant(value):
    if not isinstance(value,str):raise Denied('Timestamp required')
    try:d=datetime.fromisoformat(value.replace('Z','+00:00'))
    except ValueError as e:raise Denied('Malformed timestamp') from e
    if d.tzinfo is None:raise Denied('Timestamp must include offset')
    return d.astimezone(timezone.utc)

def canonical(value):
    def verify(v):
        if v is None or isinstance(v,(str,bool)):return
        if isinstance(v,int) and not isinstance(v,bool) and abs(v)<=9_007_199_254_740_991:return
        if isinstance(v,list):
            for x in v:verify(x)
            return
        if isinstance(v,dict) and all(isinstance(k,str) for k in v):
            for x in v.values():verify(x)
            return
        raise Denied('Reference canonicalizer supports JSON safe integers, not floats or arbitrary objects')
    verify(value)
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf8')

def snapshot_hash(action):
    # Bind every normalized field except the digest itself. Production must specify this serializer version.
    return hashlib.sha256(canonical({k:v for k,v in action.items() if k!='snapshotHash'})).hexdigest()

def derivation_key(owner,source_versions,algorithm_version):
    return hashlib.sha256(canonical({'owner':owner,'sources':sorted(source_versions),'algorithm':algorithm_version})).hexdigest()

def identity_reference(secret:bytes,owner:str,normalized_identity:str,key_version:str):
    if len(secret)<32:raise Denied('Identity key too short')
    payload=canonical({'namespace':'jarvis.identity.v1','owner':owner,'identity':normalized_identity,'keyVersion':key_version})
    return 'identity:'+key_version+':'+hmac.new(secret,payload,hashlib.sha256).hexdigest()

def validate_lease(lease,now,*,owner,executor,action_type,target,account,kill_epoch,night_episode=None):
    if lease['status']!='active':raise Denied('Lease is not active')
    if lease['ownerId']!=owner or lease['executorId']!=executor:raise Denied('Lease owner/executor mismatch')
    start,end=instant(lease['startsAt']),instant(lease['expiresAt']);n=instant(now)
    duration=(end-start).total_seconds()
    limit=43200 if lease['context']=='night_mode' else 2592000
    if not 0<duration<=limit or duration!=lease['durationSeconds'] or not start<=n<end:raise Denied('Invalid, expired or oversized lease duration')
    if not lease.get('sourceApprovalId') or lease['killEpoch']!=kill_epoch:raise Denied('Missing approval or stale kill epoch')
    scope=lease['scope']
    for key,value in [('actionTypes',action_type),('targetRefs',target),('accountRefs',account)]:
        vals=scope[key]
        if not vals or any('*' in v for v in vals) or value not in vals:raise Denied('Outside explicit lease scope')
    if scope['maximumRisk'] in ['HIGH_IMPACT','PROHIBITED']:raise Denied('High-impact lease forbidden')
    if lease['usedCount']>=scope['maximumUses']:raise Denied('Lease exhausted')
    if lease['context']=='night_mode' and (not night_episode or lease['sleepEpisodeRef']!=night_episode):raise Denied('Wrong sleep episode')
    return True

def validate_authorization(action,authorization,approval,now,*,principal_owner,current_policy,kill_epoch,step_up_seconds=300):
    # Trusted inputs only; JSON fields do not prove any of these facts were authenticated.
    n=instant(now)
    if action['ownerId']!=principal_owner or authorization['ownerId']!=principal_owner:raise Denied('Owner mismatch')
    for ak,bk in [('actionId','actionId'),('revision','actionRevision'),('capabilityId','capabilityId'),('executorId','executorId'),('credentialAccountRef','credentialAccountRef'),('idempotencyKey','idempotencyKey')]:
        if action[ak]!=authorization[bk]:raise Denied('Action binding mismatch: '+ak)
    if action['snapshotHash']!=snapshot_hash(action) or authorization['snapshotHash']!=action['snapshotHash']:raise Denied('Snapshot mismatch')
    if authorization['policyVersion']!=current_policy or action['policyVersion']!=current_policy:raise Denied('Policy changed')
    if authorization['killEpoch']!=kill_epoch:raise Denied('Stop epoch changed')
    if not instant(authorization['issuedAt'])<=n<instant(authorization['expiresAt']) or not n<instant(action['expiresAt']):raise Denied('Expired or future authorization')
    if action['risk']=='PROHIBITED':raise Denied('Prohibited action')
    if action['risk']!='READ' and (action['actionType'].startswith(('finance.','payment.')) or 'purchase' in action['actionType']):raise Denied('V4 finance/purchase prohibition')
    if action['risk']=='HIGH_IMPACT' and authorization['authorityType']!='action_approval':raise Denied('High-impact needs action approval')
    if authorization['authorityType']=='action_approval':
        if not approval:raise Denied('Approval missing')
        if approval['outcome']!='approved' or approval['ownerId']!=principal_owner or approval['actionId']!=action['actionId'] or approval['approvalId']!=authorization['approvalId'] or approval['snapshotHash']!=action['snapshotHash']:raise Denied('Approval binding mismatch')
        if approval['trustedSurface'] not in ['first_party_web','first_party_android']:raise Denied('Untrusted approval surface')
        if approval['policyVersion']!=current_policy:raise Denied('Approval policy mismatch')
        age=(n-instant(approval['reauthenticatedAt'])).total_seconds()
        if action['risk']=='HIGH_IMPACT' and (age<0 or age>step_up_seconds or approval['authMethod'] not in ['webauthn_user_verified','hardware_key_user_verified']):raise Denied('Fresh step-up required')
    elif authorization['authorityType']=='lease':
        raise Denied('Lease must be validated and reserved through its separate transactional path')
    elif action['risk'] not in ['READ','LOW_RISK_INTERNAL']:raise Denied('Owner policy cannot authorize this effect')
    return True

def admit_cost(*,estimated,settled,reserved,job_used,job_reserved,monthly_limit,daily_used,daily_reserved,daily_limit,job_limit,stuck=False,unknown=False):
    vals=[estimated,settled,reserved,job_used,job_reserved,monthly_limit,daily_used,daily_reserved,daily_limit,job_limit]
    if any(not isinstance(v,int) or isinstance(v,bool) or v<0 for v in vals):raise Denied('Use nonnegative integer microUSD')
    if stuck or unknown:raise Denied('No-progress or unknown accounting')
    if settled+reserved+estimated>monthly_limit or daily_used+daily_reserved+estimated>daily_limit or job_used+job_reserved+estimated>job_limit:raise Denied('Budget exceeded')
    return estimated

def cancellation_state(state):
    if state in ['proposed','authorized','reserved']:return 'cancelled'
    if state in ['dispatch_started','outcome_pending','cancel_requested']:return 'reconciliation_required'
    if state in ['verified','failed','cancelled','reconciliation_required']:return state
    raise Denied('Unknown dispatch state')
