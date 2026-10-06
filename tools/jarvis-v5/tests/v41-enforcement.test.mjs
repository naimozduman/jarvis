import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync, chmodSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { evaluate, inspect, keyId, stable } from '../trust-gate.mjs';
import { verifyEvidence, signEvidence } from '../evidence-signing.mjs';

const NOW=new Date('2026-09-25T12:00:00Z');
const realPolicy=JSON.parse(readFileSync(new URL('../../../governance/TRUST_POLICY.json',import.meta.url),'utf8'));
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'jarvis41-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(...a)=>{const r=spawnSync('git',a,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git('init','-q');git('config','user.name','Synthetic');git('config','user.email','test@example.invalid');
 const put=(p,body)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),body);};
 put('README.md','base');git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD');
 const keys=generateKeyPairSync('ed25519');const publicKey=keys.publicKey.export({type:'spki',format:'pem'});
 const policy={...structuredClone(realPolicy),repository:'fixture/jarvis',bootstrapStatus:'owner_key_enrolled',trustedKeyIds:[keyId(publicKey)]};
 const commit=()=>{git('add','-A');git('commit','-qm','candidate');return git('rev-parse','HEAD');};
 const signed=head=>{const r=inspect(root,base,head,policy);const payload={repository:policy.repository,base,head,diffDigest:r.diffDigest,keyId:keyId(publicKey),purpose:'protected-change-promotion',issuedAt:'2026-09-25T11:59:00Z',expiresAt:'2026-09-25T12:30:00Z'};return {format:'jarvis-governance-approval-v1',payload,signature:sign(null,Buffer.from(stable(payload)),keys.privateKey).toString('base64')};};
 const check=(head,envelope=null)=>evaluate({repo:root,base,head,policy,publicKey,envelope,now:NOW});
 return {root,git,put,base,policy,commit,signed,check};
}
for(const path of [
 'apps/api/src/runtime.ts','packages/database/src/brain-repository.ts','packages/config/src/index.ts',
 'packages/executors/src/dispatch.ts','apps/web/src/approval-view.tsx','packages/integrations-mail/src/send.ts',
 'apps/whatsapp-bridge/src/send.ts','convex/new-dispatch.ts','unknown-new-directory/handler.js',
 'Dockerfile','pnpm-lock.yaml','governance/runs/payload.mjs'
]) test('protected by default: '+path,t=>{const x=fixture(t);x.put(path,'synthetic change');const h=x.commit();const r=x.check(h);assert.equal(r.allowed,false);assert.ok(r.protectedPaths.includes(path));assert.equal(x.check(h,x.signed(h)).allowed,true);});

test('unsigned removal of dispatch authorization is rejected with policy module untouched',t=>{
 const x=fixture(t);x.put('packages/executors/src/dispatch.ts','if (allowed) await send();');x.commit();
 x.put('packages/executors/src/dispatch.ts','await send();');const h=x.commit();assert.equal(x.check(h).allowed,false);
 assert.equal(existsSync(join(x.root,'packages/security/src/policy.ts')),false);
});
test('benign operational JSON does not require a code promotion signature after enrollment',t=>{const x=fixture(t);x.put('governance/runs/test.json','{}');const r=x.check(x.commit());assert.equal(r.allowed,true);assert.deepEqual(r.operationalPaths,['governance/runs/test.json']);});
test('executable bit removes operational exemption',t=>{const x=fixture(t);x.put('governance/runs/test.json','{}');chmodSync(join(x.root,'governance/runs/test.json'),0o755);const r=x.check(x.commit());assert.equal(r.allowed,false);assert.ok(r.protectedPaths.includes('governance/runs/test.json'));});
test('rename out of an operational location still protects destination',t=>{const x=fixture(t);x.put('governance/runs/test.json','{}');x.commit();mkdirSync(join(x.root,'packages/config'),{recursive:true});renameSync(join(x.root,'governance/runs/test.json'),join(x.root,'packages/config/policy.json'));assert.equal(x.check(x.commit()).allowed,false);});
test('unenrolled policy permits inspection but denies operational promotion',t=>{const x=fixture(t);x.policy.bootstrapStatus='owner_key_not_enrolled';x.policy.trustedKeyIds=[];x.put('governance/runs/test.json','{}');const h=x.commit();assert.equal(inspect(x.root,x.base,h,x.policy).changedPaths.length,1);assert.equal(x.check(h).allowed,false);});
test('version-one/default-allow policy is refused by V4.1',t=>{const x=fixture(t);x.policy.policyVersion=1;assert.throws(()=>inspect(x.root,x.base,x.base,x.policy));});
test('candidate operational exception expansion is not used',t=>{const x=fixture(t);x.put('governance/TRUST_POLICY.json',JSON.stringify({...x.policy,operationalExceptions:['**']}));x.put('apps/api/src/runtime.ts','bypass');assert.equal(x.check(x.commit()).allowed,false);});
test('changed-blob limit is enforced',t=>{const x=fixture(t);x.policy.maxBlobBytes=32;x.put('new.ts','x'.repeat(33));assert.throws(()=>x.check(x.commit()));});
test('symlink under operational folder is rejected',t=>{const x=fixture(t);mkdirSync(join(x.root,'governance/runs'),{recursive:true});symlinkSync('/tmp/no-secret',join(x.root,'governance/runs/test.json'));assert.equal(x.check(x.commit()).allowed,false);});

function signedFixture() {
 const keys=generateKeyPairSync('ed25519');const privatePem=keys.privateKey.export({type:'pkcs8',format:'pem'}),publicPem=keys.publicKey.export({type:'spki',format:'pem'}),id=keyId(publicPem);
 const policy={evidencePolicyVersion:1,enabled:true,repository:'fixture/jarvis',maxValiditySeconds:{'eval-review':3600,'test-verification':3600},signers:[{keyId:id,publicKeyPem:publicPem,purposes:['eval-review','test-verification']}]};
 const payload={purpose:'eval-review',repository:'fixture/jarvis',base:'a'.repeat(40),head:'b'.repeat(40),keyId:id,issuedAt:'2026-09-25T11:59:00Z',expiresAt:'2026-09-25T12:30:00Z',reviews:[]};
 return {policy,payload,privatePem,envelope:signEvidence(payload,privatePem)};
}
test('correct independent evidence signature verifies',()=>{const f=signedFixture();assert.equal(verifyEvidence(f.envelope,f.policy,NOW).head,f.payload.head);});
test('candidate cannot activate unenrolled evidence trust',()=>{const f=signedFixture();f.policy.enabled=false;assert.throws(()=>verifyEvidence(f.envelope,f.policy,NOW));});
test('wrong-purpose signer rejected',()=>{const f=signedFixture();f.policy.signers[0].purposes=['test-verification'];assert.throws(()=>verifyEvidence(f.envelope,f.policy,NOW));});
test('tampered evidence head rejected',()=>{const f=signedFixture();f.envelope.payload.head='c'.repeat(40);assert.throws(()=>verifyEvidence(f.envelope,f.policy,NOW));});
test('expired evidence rejected',()=>{const f=signedFixture();assert.throws(()=>verifyEvidence(f.envelope,f.policy,new Date('2026-09-26T00:00:00Z')));});
test('future evidence rejected',()=>{const f=signedFixture();assert.throws(()=>verifyEvidence(f.envelope,f.policy,new Date('2026-09-25T11:00:00Z')));});
test('governance signature cannot be replayed as evidence',()=>{const f=signedFixture();f.envelope.signature=sign(null,Buffer.from(stable(f.payload)),f.privatePem).toString('base64');assert.throws(()=>verifyEvidence(f.envelope,f.policy,NOW));});
test('altered signer public key rejected',()=>{const f=signedFixture();f.policy.signers[0].publicKeyPem=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});assert.throws(()=>verifyEvidence(f.envelope,f.policy,NOW));});
test('signed validity window still obeys trusted maximum',()=>{const f=signedFixture();f.payload.expiresAt='2026-10-25T12:30:00Z';const e=signEvidence(f.payload,f.privatePem);assert.throws(()=>verifyEvidence(e,f.policy,NOW));});
test('invalid evidence verifier clock fails closed',()=>{const f=signedFixture();assert.throws(()=>verifyEvidence(f.envelope,f.policy,new Date('invalid')));});
