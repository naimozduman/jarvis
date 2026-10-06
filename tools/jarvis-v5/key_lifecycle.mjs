/** Pure public-state transition verifier. Does not enroll/store a key or alter platform settings. */
import {createPublicKey,sign,verify} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stable,digest,keyId,utc,exactKeys,readJSON} from './signed_records.mjs';
import {argumentsOf} from './trust-gate.mjs';
const DOMAIN='JARVIS-V5-KEY-TRANSITION\0';
export function proof(payload,privateKey){const pub=createPublicKey(privateKey).export({format:'pem',type:'spki'});return {keyId:keyId(pub),signature:sign(null,Buffer.from(DOMAIN+stable(payload)),privateKey).toString('base64')};}
function verifyProof(payload,p,pem){if(p.keyId!==keyId(pem)||typeof p.signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.signature))return false;const s=Buffer.from(p.signature,'base64');return s.length===64&&verify(null,Buffer.from(DOMAIN+stable(payload)),createPublicKey(pem),s);}
function validKey(k){exactKeys(k,['keyId','publicKeyPem','status']);if(keyId(k.publicKeyPem)!==k.keyId||!['active','revoked'].includes(k.status))throw new Error('Invalid public key record');}
export function transition(state,request,now=new Date()){
 exactKeys(state,['repository','epoch','operationalKeys','recoveryKeys','recoveryThreshold','usedNonces','previousStateDigest']);
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(state.repository)||!Number.isSafeInteger(state.epoch)||state.epoch<1||state.epoch>=Number.MAX_SAFE_INTEGER)throw new Error('Invalid trusted state');
 if(!Array.isArray(state.operationalKeys)||!Array.isArray(state.recoveryKeys)||state.operationalKeys.length>32||state.recoveryKeys.length>32)throw new Error('Key set limit');
 [...state.operationalKeys,...state.recoveryKeys].forEach(validKey);
 const ids=[...state.operationalKeys,...state.recoveryKeys].map(k=>k.keyId);if(new Set(ids).size!==ids.length)throw new Error('Key reuse across trust roles');
 if(!Number.isSafeInteger(state.recoveryThreshold)||state.recoveryThreshold<1||state.recoveryThreshold>state.recoveryKeys.filter(k=>k.status==='active').length)throw new Error('Invalid recovery threshold');
 if(!Array.isArray(state.usedNonces)||state.usedNonces.length>1024||new Set(state.usedNonces).size!==state.usedNonces.length||state.usedNonces.some(n=>typeof n!=='string'||!/^[a-f0-9]{64}$/.test(n)))throw new Error('Nonce history limit');
 exactKeys(request,['payload','proofs']);const p=request.payload;
 exactKeys(p,['purpose','repository','expectedEpoch','baseStateDigest','nonce','issuedAt','expiresAt','newOperationalKeys']);
 if(!['normal-rotation','lost-key-recovery','compromise-recovery','emergency-revoke'].includes(p.purpose))throw new Error('Unsupported key transition');
 if(p.repository!==state.repository||p.expectedEpoch!==state.epoch||p.baseStateDigest!==digest(state))throw new Error('Stale root/repository/epoch');
 if(typeof p.nonce!=='string'||!/^[a-f0-9]{64}$/.test(p.nonce)||state.usedNonces.includes(p.nonce))throw new Error('Invalid/replayed nonce');
 const issued=utc(p.issuedAt),expires=utc(p.expiresAt),clock=now.getTime();if(!Number.isFinite(clock)||issued>clock||expires<=clock||expires<=issued||expires-issued>86400000)throw new Error('Transition validity exceeded');
 if(!Array.isArray(p.newOperationalKeys)||p.newOperationalKeys.length>8||state.operationalKeys.length+p.newOperationalKeys.length>32)throw new Error('New key set limit');p.newOperationalKeys.forEach(validKey);
 if(p.newOperationalKeys.some(k=>k.status!=='active'||ids.includes(k.keyId))||new Set(p.newOperationalKeys.map(k=>k.keyId)).size!==p.newOperationalKeys.length)throw new Error('Invalid/reused replacement key');
 if(p.purpose==='emergency-revoke'?p.newOperationalKeys.length!==0:p.newOperationalKeys.length<1)throw new Error('Replacement count mismatch');
 if(!Array.isArray(request.proofs)||request.proofs.length>64||new Set(request.proofs.map(x=>x.keyId)).size!==request.proofs.length)throw new Error('Duplicate/excess proofs');
 for(const pr of request.proofs)exactKeys(pr,['keyId','signature']);
 const authenticated=new Set();const eligible=[...state.operationalKeys,...state.recoveryKeys,...p.newOperationalKeys].filter(k=>k.status==='active');
 for(const pr of request.proofs){const key=eligible.find(k=>k.keyId===pr.keyId);if(!key||!verifyProof(p,pr,key.publicKeyPem))throw new Error('Invalid or revoked proof');authenticated.add(pr.keyId);}
 const operational=state.operationalKeys.some(k=>k.status==='active'&&authenticated.has(k.keyId));
 const recovery=state.recoveryKeys.filter(k=>k.status==='active'&&authenticated.has(k.keyId)).length>=state.recoveryThreshold;
 if(p.purpose==='normal-rotation'?!operational:!recovery)throw new Error('Required trust role missing');
 if(p.newOperationalKeys.some(k=>!authenticated.has(k.keyId)))throw new Error('Replacement possession proof missing');
 return {repository:state.repository,epoch:state.epoch+1,operationalKeys:[...state.operationalKeys.map(k=>({...k,status:'revoked'})),...p.newOperationalKeys],recoveryKeys:state.recoveryKeys.map(k=>({...k})),recoveryThreshold:state.recoveryThreshold,usedNonces:[...state.usedNonces,p.nonce].slice(-1024),previousStateDigest:digest(state)};
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1]||'')).href){try{
 const a=argumentsOf(process.argv.slice(2));for(const k of ['trusted-state','transition','output'])if(typeof a[k]!=='string')throw new Error('Required --'+k);
 const state=transition(readJSON(a['trusted-state']),readJSON(a.transition));writeFileSync(a.output,JSON.stringify(state,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({verified:true,proposedEpoch:state.epoch,installed:false,publicStateOutput:resolve(a.output)}));
}catch(error){console.error(JSON.stringify({verified:false,error:error.message}));process.exitCode=2;}}
