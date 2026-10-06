/** Owner/verifier-side signer. Never install a private key in the builder context. */
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readJSON,digest,keyId,signRecord,exactKeys,utc} from './signed_records.mjs';
import {proof} from './key_lifecycle.mjs';
import {argumentsOf} from './trust-gate.mjs';
export function signPrepared(kind,payload,privatePem,confirmedDigest){
 const h=digest(payload);if(confirmedDigest!==h)throw new Error('Confirm exact inspected payload digest');
 utc(payload.issuedAt);utc(payload.expiresAt);
 if(kind==='mission'){
  if(!['mission-completion','trusted-bootstrap'].includes(payload.purpose))throw new Error('Unsupported receipt purpose');
  const fields=['purpose','repository','trustEpoch','missionId','definitionDigest','checkpoint','evidenceDigest','issuedAt','expiresAt','keyId'];if(payload.purpose==='trusted-bootstrap')fields.push('controls');exactKeys(payload,fields);
  return signRecord(payload,privatePem);
 }
 if(kind==='key-transition'){
  if(!['normal-rotation','lost-key-recovery','compromise-recovery','emergency-revoke'].includes(payload.purpose))throw new Error('Unsupported transition');
  exactKeys(payload,['purpose','repository','expectedEpoch','baseStateDigest','nonce','issuedAt','expiresAt','newOperationalKeys']);return proof(payload,privatePem);
 }
 throw new Error('Unsupported signing kind');
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1]||'')).href){try{
 const a=argumentsOf(process.argv.slice(2));for(const k of ['kind','payload'])if(typeof a[k]!=='string')throw new Error('Required --'+k);
 const payload=readJSON(a.payload),h=digest(payload);
 if(!a['private-key']){console.log(JSON.stringify({previewOnly:true,kind:a.kind,payloadDigest:h,payload,warning:'Verify independent evidence and custody before signing. Preview grants no authority.'},null,2));}
 else{
  for(const k of ['confirm-digest','output'])if(typeof a[k]!=='string')throw new Error('Required --'+k);
  const stat=lstatSync(a['private-key']);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>65536)throw new Error('Invalid private key file');
  const pem=readFileSync(a['private-key'],'utf8');const key=createPrivateKey(pem);if(key.asymmetricKeyType!=='ed25519')throw new Error('Ed25519 key required');
  const signed=signPrepared(a.kind,payload,pem,a['confirm-digest']);writeFileSync(a.output,JSON.stringify(signed,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({signed:true,kind:a.kind,payloadDigest:h,keyId:keyId(createPublicKey(key).export({type:'spki',format:'pem'})),installed:false,output:resolve(a.output)}));
 }
}catch(error){console.error(JSON.stringify({signed:false,error:error.message}));process.exitCode=2;}}
