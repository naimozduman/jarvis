/** Owner-side only. Never place the private key in a builder checkout or environment. */
import {generateKeyPairSync,sign,createPrivateKey,createPublicKey} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {argumentsOf,inspect,keyId,stable} from './trust-gate.mjs';
try {
 const [cmd,...rest]=process.argv.slice(2), a=argumentsOf(rest);
 if(cmd==='keygen') {
  if(!a.directory || a['confirm-owner-custody']!==true)throw new Error('Required --directory and --confirm-owner-custody. Use an owner-only location outside builder access.');
  const dir=resolve(a.directory);mkdirSync(dir,{recursive:true,mode:0o700});
  if(lstatSync(dir).isSymbolicLink())throw new Error('Refusing symlink key directory.');
  for(const f of ['owner-private.pem','owner-public.pem'])if(existsSync(join(dir,f)))throw new Error('Key exists; refusing overwrite.');
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const pub=publicKey.export({type:'spki',format:'pem'}),priv=privateKey.export({type:'pkcs8',format:'pem'});
  writeFileSync(join(dir,'owner-private.pem'),priv,{mode:0o600,flag:'wx'});writeFileSync(join(dir,'owner-public.pem'),pub,{mode:0o644,flag:'wx'});
  console.log(JSON.stringify({keyId:keyId(pub),publicKeyPath:join(dir,'owner-public.pem'),privateKeyPrinted:false,required:'Register the public key through owner-controlled bootstrap. Filesystem mode is not proof of Windows ACL isolation.'},null,2));
 } else if(cmd==='sign') {
  for(const k of ['repo','base','head','policy','private-key','output'])if(typeof a[k]!=='string')throw new Error(`Required --${k}`);
  if(a['i-reviewed-exact-diff']!==true)throw new Error('Review the exact diff, then pass --i-reviewed-exact-diff. This flag is not the trust boundary; private-key custody is.');
  const policy=JSON.parse(readFileSync(a.policy,'utf8')),report=inspect(a.repo,a.base,a.head,policy);
  if(report.immutablePaths.length||report.unsafePaths.length)throw new Error('Cannot authorize history rewrite or unsafe Git entry.');
  const privateKey=createPrivateKey(readFileSync(a['private-key'],'utf8')),pub=createPublicKey(privateKey).export({type:'spki',format:'pem'}),id=keyId(pub);
  if(!policy.trustedKeyIds.includes(id))throw new Error('Key not enrolled in trusted policy.');
  const seconds=Number(a.seconds||3600);if(!Number.isSafeInteger(seconds)||seconds<1||seconds>policy.maxApprovalSeconds)throw new Error('Invalid approval lifetime.');
  const now=new Date();const payload={repository:policy.repository,base:report.base,head:report.head,diffDigest:report.diffDigest,purpose:'protected-change-promotion',keyId:id,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+seconds*1000).toISOString()};
  const envelope={format:'jarvis-governance-approval-v1',payload,signature:sign(null,Buffer.from(stable(payload)),privateKey).toString('base64')};
  writeFileSync(a.output,JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({signedHead:report.head,diffDigest:report.diffDigest,protectedPaths:report.protectedPaths,output:resolve(a.output)},null,2));
 }else throw new Error('Use keygen or sign.');
}catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=2;}
