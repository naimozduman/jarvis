/** Purpose-separated V5 record signatures. No candidate code, network, or private-key storage. */
import {KeyObject, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {readFileSync, lstatSync} from 'node:fs';
import {stable, digest, keyId} from './trust-gate.mjs';
export {stable, digest, keyId};
const DOMAIN='JARVIS-V5-RECORD\0';
export function strictJSON(text) {
  if(typeof text!=='string'||Buffer.byteLength(text)>2_000_000)throw new Error('JSON input limit');
  let i=0; const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  function str(){const start=i++;let escape=false;while(i<text.length){const c=text[i++];if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"')return JSON.parse(text.slice(start,i));}throw new Error('Unclosed JSON string');}
  function value(depth=0){if(depth>64)throw new Error('JSON depth limit');ws();const c=text[i];
    if(c==='"'){str();return;}if(c==='{'){i++;ws();const seen=new Set();if(text[i]==='}'){i++;return;}while(true){ws();if(text[i]!=='"')throw new Error('Expected JSON key');const k=str();if(seen.has(k))throw new Error('Duplicate JSON key');seen.add(k);ws();if(text[i++]!==':')throw new Error('Expected colon');value(depth+1);ws();const sep=text[i++];if(sep==='}')return;if(sep!==',')throw new Error('Expected object separator');}}
    if(c==='['){i++;ws();if(text[i]===']'){i++;return;}let count=0;while(true){if(++count>20000)throw new Error('JSON array limit');value(depth+1);ws();const sep=text[i++];if(sep===']')return;if(sep!==',')throw new Error('Expected array separator');}}
    const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!m)throw new Error('Invalid JSON value');i+=m[0].length;
  }
  value();ws();if(i!==text.length)throw new Error('Trailing JSON data');const out=JSON.parse(text);stable(out);return out;
}
export function readJSON(path){const s=lstatSync(path);if(s.isSymbolicLink()||!s.isFile()||s.size>2_000_000)throw new Error('Unsafe JSON file');return strictJSON(readFileSync(path,'utf8'));}
export function utc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw new Error('Canonical UTC timestamp required');
 const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))throw new Error('Invalid UTC timestamp');return ms;
}
export function exactKeys(obj,keys){if(!obj||Object.getPrototypeOf(obj)!==Object.prototype||Object.keys(obj).sort().join('|')!==[...keys].sort().join('|'))throw new Error('Unexpected record shape');}
export function signRecord(payload,privatePem){
 const k=privatePem instanceof KeyObject && privatePem.type==='private'?privatePem:createPrivateKey(privatePem);if(k.asymmetricKeyType!=='ed25519')throw new Error('Ed25519 required');const pub=createPublicKey(k).export({type:'spki',format:'pem'});if(payload.keyId!==keyId(pub))throw new Error('Signing key mismatch');
 return {format:'jarvis-v5-signed-record',payload,signature:sign(null,Buffer.from(DOMAIN+stable(payload)),k).toString('base64')};
}
export function verifyRecord(envelope,policy,purpose,now=new Date()){
 exactKeys(envelope,['format','payload','signature']);if(envelope.format!=='jarvis-v5-signed-record')throw new Error('Wrong envelope format');
 if(policy.enabled!==true||!Number.isSafeInteger(policy.trustEpoch)||policy.trustEpoch<1)throw new Error('Trusted policy not enrolled');
 const p=envelope.payload;if(!p||p.purpose!==purpose||p.repository!==policy.repository||p.trustEpoch!==policy.trustEpoch)throw new Error('Purpose/repository/epoch mismatch');
 const signer=policy.signers?.find(x=>x.keyId===p.keyId);if(!signer||signer.status!=='active'||!signer.purposes.includes(purpose)||keyId(signer.publicKeyPem)!==p.keyId)throw new Error('Unenrolled or revoked signer');
 const start=utc(p.issuedAt),end=utc(p.expiresAt),clock=now.getTime(),maximum=policy.maxValiditySeconds?.[purpose];
 if(!Number.isFinite(clock)||!Number.isSafeInteger(maximum)||maximum<1||start>clock||end<=clock||end<=start||end-start>maximum*1000)throw new Error('Expired/future/overlong signed record');
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature))throw new Error('Malformed signature');const sig=Buffer.from(envelope.signature,'base64');
 if(sig.length!==64||!verify(null,Buffer.from(DOMAIN+stable(p)),createPublicKey(signer.publicKeyPem),sig))throw new Error('Invalid signature');return p;
}
