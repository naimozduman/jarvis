import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {strictJSON,utc,signRecord,verifyRecord,keyId,digest} from '../signed_records.mjs';
import {transition,proof} from '../key_lifecycle.mjs';
import {admit,definitionDigest} from '../mission_gate.mjs';
const NOW=new Date('2026-09-26T12:00:00Z');
const key=()=>{const k=generateKeyPairSync('ed25519');const pem=k.publicKey.export({type:'spki',format:'pem'});return {...k,pem,id:keyId(pem),record:{keyId:keyId(pem),publicKeyPem:pem,status:'active'}};};
const clone=x=>structuredClone(x);
function temp(t){const p=mkdtempSync(join(tmpdir(),'jarvis-v5-test-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
function policy(k){return {enabled:true,repository:'fixture/jarvis',trustEpoch:1,signers:[{keyId:k.id,publicKeyPem:k.pem,status:'active',purposes:['mission-completion','trusted-bootstrap']}],maxValiditySeconds:{'mission-completion':3600,'trusted-bootstrap':3600}};}
function payload(k){return {purpose:'mission-completion',repository:'fixture/jarvis',trustEpoch:1,keyId:k.id,issuedAt:'2026-09-26T11:59:00Z',expiresAt:'2026-09-26T12:30:00Z',missionId:'J5-M00',checkpoint:'a'.repeat(40),evidenceDigest:'b'.repeat(64),definitionDigest:'c'.repeat(64)};}

test('record: valid purpose-separated Ed25519 envelope',()=>{const k=key(),p=payload(k);assert.deepEqual(verifyRecord(signRecord(p,k.privateKey),policy(k),'mission-completion',NOW),p);});
test('record: same signature rejected for another purpose',()=>{const k=key();assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),policy(k),'trusted-bootstrap',NOW));});
test('record: tampered payload rejected',()=>{const k=key(),e=signRecord(payload(k),k.privateKey);e.payload.evidenceDigest='d'.repeat(64);assert.throws(()=>verifyRecord(e,policy(k),'mission-completion',NOW));});
test('record: revoked signer rejected',()=>{const k=key(),p=policy(k);p.signers[0].status='revoked';assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),p,'mission-completion',NOW));});
test('record: uninstalled policy rejected',()=>{const k=key(),p=policy(k);p.enabled=false;assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),p,'mission-completion',NOW));});
test('record: wrong trust epoch rejected',()=>{const k=key(),p=policy(k);p.trustEpoch=2;assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),p,'mission-completion',NOW));});
test('record: wrong repository rejected',()=>{const k=key(),p=policy(k);p.repository='other/repo';assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),p,'mission-completion',NOW));});
test('record: invalid verifier clock fails closed',()=>{const k=key();assert.throws(()=>verifyRecord(signRecord(payload(k),k.privateKey),policy(k),'mission-completion',new Date('bad')));});
test('record: expiry equality rejected',()=>{const k=key(),p=payload(k);p.expiresAt=NOW.toISOString();assert.throws(()=>verifyRecord(signRecord(p,k.privateKey),policy(k),'mission-completion',NOW));});
test('record: future issued-at rejected',()=>{const k=key(),p=payload(k);p.issuedAt='2026-09-26T12:01:00Z';assert.throws(()=>verifyRecord(signRecord(p,k.privateKey),policy(k),'mission-completion',NOW));});
test('record: overlong validity rejected',()=>{const k=key(),p=payload(k);p.expiresAt='2026-09-27T12:00:00Z';assert.throws(()=>verifyRecord(signRecord(p,k.privateKey),policy(k),'mission-completion',NOW));});
test('record: mismatched private key fails signing',()=>{const k=key();assert.throws(()=>signRecord(payload(k),key().privateKey));});
test('JSON: escaped duplicate keys rejected',()=>assert.throws(()=>strictJSON('{"a":1,"\\u0061":2}')));
test('JSON: nested duplicate keys rejected',()=>assert.throws(()=>strictJSON('{"a":{"x":1,"x":2}}')));
test('JSON: unsafe integer rejected',()=>assert.throws(()=>strictJSON('{"n":9007199254740992}')));
test('JSON: trailing text rejected',()=>assert.throws(()=>strictJSON('{} false')));
test('JSON: excessive nesting rejected',()=>assert.throws(()=>strictJSON('['.repeat(70)+'1'+']'.repeat(70))));
test('JSON: valid nested input survives',()=>assert.deepEqual(strictJSON('{"a":[1,true,null,"x"]}'),{a:[1,true,null,'x']}));
test('time: normalized impossible day rejected',()=>assert.throws(()=>utc('2026-02-30T12:00:00Z')));
test('time: naive local date rejected',()=>assert.throws(()=>utc('2026-09-26T12:00:00')));

function missionFixture(t){
 const root=temp(t);mkdirSync(join(root,'missions'));mkdirSync(join(root,'docs'));writeFileSync(join(root,'docs/policy.md'),'the rule');
 const spec={sections:[{origin:'fixture',requirements:[{id:'R1',requirement:'keep authority separate',acceptance:'denies bypass'}]}]};
 const ms=[0,1,2,3].map(i=>({id:'J5-M0'+i,title:'Fixture '+i,path:'missions/'+i+'.md',dependsOn:i?['J5-M0'+(i-1)]:[],requiredReading:['docs/policy.md'],requirementIds:['R1'],runState:'planned',completedRunRef:null}));
 for(const m of ms)writeFileSync(join(root,m.path),m.title);
 const k=key(),pol=policy(k),roadmap={missions:ms};
 function receipts(checkpoint='a'.repeat(40)){return ms.slice(0,3).map(m=>{const p={...payload(k),missionId:m.id,checkpoint,definitionDigest:definitionDigest(root,m,spec)};if(m.id==='J5-M01'){p.purpose='trusted-bootstrap';p.controls={isolatedBuilder:true,independentVerifier:true,protectedMerge:true,recoveryDrill:true,currentHeadAdmission:true};}return signRecord(p,k.privateKey);});}
 const run=(extra={})=>admit({root,roadmap,spec,policy:pol,missionId:'J5-M02',mode:'implementation',head:'b'.repeat(40),receipts:receipts(),now:NOW,isAncestor:()=>true,...extra});
 return {root,spec,roadmap,k,pol,receipts,run};
}
test('mission: transitive prerequisites admit exact definition',t=>{const f=missionFixture(t);const r=f.run();assert.equal(r.allowed,true);assert.equal(r.executesCommands,false);assert.deepEqual(new Set(r.prerequisites.map(x=>x.missionId)),new Set(['J5-M00','J5-M01']));});
test('mission: fresh completed text cannot replace signed receipts',t=>{const f=missionFixture(t);f.roadmap.missions[1].runState='completed';assert.throws(()=>f.run({receipts:[]}));});
test('mission: unrelated receipt does not satisfy missing dependency',t=>{const f=missionFixture(t);assert.throws(()=>f.run({receipts:f.receipts().filter(e=>e.payload.missionId!=='J5-M01')}));});
test('mission: audit is narrow even before enrollment',t=>{const f=missionFixture(t);f.pol.enabled=false;const r=f.run({missionId:'J5-M00',mode:'audit',receipts:[]});assert.equal(r.scope,'sanitized_audit_only');assert.equal(r.installedTrust,false);});
test('mission: bootstrap preparation is not implementation approval',t=>{const f=missionFixture(t);f.pol.enabled=false;assert.equal(f.run({missionId:'J5-M01',mode:'bootstrap-preparation'}).installedTrust,false);assert.throws(()=>f.run({missionId:'J5-M02',mode:'bootstrap-preparation'}));});
test('mission: later mission cannot request audit mode',t=>{const f=missionFixture(t);assert.throws(()=>f.run({missionId:'J5-M03',mode:'audit'}));});
test('mission: unenrolled trust rejects implementation',t=>{const f=missionFixture(t);f.pol.enabled=false;assert.throws(()=>f.run());});
test('mission: unrelated checkpoint rejected',t=>{const f=missionFixture(t);assert.throws(()=>f.run({isAncestor:()=>false}));});
test('mission: short checkpoint denied despite permissive ancestry callback',t=>{const f=missionFixture(t);assert.throws(()=>f.run({receipts:f.receipts('short')}));});
test('mission: source text edit invalidates old completion',t=>{const f=missionFixture(t),rs=f.receipts();writeFileSync(join(f.root,'docs/policy.md'),'new rule');assert.throws(()=>f.run({receipts:rs}));});
test('mission: requirement edit invalidates old completion',t=>{const f=missionFixture(t),rs=f.receipts();f.spec.sections[0].requirements[0].requirement='weakened';assert.throws(()=>f.run({receipts:rs}));});
test('mission: status-only edit does not alter definition hash',t=>{const f=missionFixture(t),m=f.roadmap.missions[0],h=definitionDigest(f.root,m,f.spec);m.runState='completed';m.completedRunRef='reference';assert.equal(definitionDigest(f.root,m,f.spec),h);});
test('mission: incomplete bootstrap controls rejected',t=>{const f=missionFixture(t),rs=f.receipts();const p=rs[1].payload;p.controls.recoveryDrill=false;rs[1]=signRecord(p,f.k.privateKey);assert.throws(()=>f.run({receipts:rs}));});
test('mission: forged bootstrap controls rejected',t=>{const f=missionFixture(t),rs=f.receipts();rs[1].payload.controls.isolatedBuilder=false;assert.throws(()=>f.run({receipts:rs}));});
test('mission: circular prerequisites rejected',t=>{const f=missionFixture(t);f.roadmap.missions[0].dependsOn=['J5-M02'];assert.throws(()=>f.run());});
test('mission: source symlink rejected',t=>{const f=missionFixture(t);rmSync(join(f.root,'docs/policy.md'));symlinkSync(join(f.root,'missions/0.md'),join(f.root,'docs/policy.md'));assert.throws(()=>definitionDigest(f.root,f.roadmap.missions[0],f.spec));});
test('mission: parent path rejected',t=>{const f=missionFixture(t);f.roadmap.missions[0].requiredReading=['../outside'];assert.throws(()=>definitionDigest(f.root,f.roadmap.missions[0],f.spec));});
test('mission CLI: real Git ancestry and signed fixtures',t=>{
 const f=missionFixture(t),repo=temp(t);const git=(...args)=>{const r=spawnSync('git',args,{cwd:repo,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git('init','-q');git('config','user.name','Synthetic Fixture');git('config','user.email','fixture@example.invalid');writeFileSync(join(repo,'source.txt'),'initial');git('add','.');git('commit','-qm','initial');const base=git('rev-parse','HEAD');writeFileSync(join(repo,'source.txt'),'next');git('commit','-qam','next');const head=git('rev-parse','HEAD');
 mkdirSync(join(f.root,'governance'));writeFileSync(join(f.root,'governance/ROADMAP.json'),JSON.stringify(f.roadmap));writeFileSync(join(f.root,'governance/PRODUCT_SPEC.json'),JSON.stringify(f.spec));
 // Real CLI uses the clock, so create current valid test envelopes, not historical fixtures.
 const now=new Date();const rs=f.receipts(base).map(e=>{e.payload.issuedAt=new Date(now.getTime()-1000).toISOString();e.payload.expiresAt=new Date(now.getTime()+60000).toISOString();return signRecord(e.payload,f.k.privateKey);});
 writeFileSync(join(f.root,'policy.json'),JSON.stringify(f.pol));writeFileSync(join(f.root,'receipts.json'),JSON.stringify(rs));
 const cli=fileURLToPath(new URL('../mission_gate.mjs',import.meta.url));const r=spawnSync(process.execPath,[cli,'--trusted-root',f.root,'--policy',join(f.root,'policy.json'),'--receipts',join(f.root,'receipts.json'),'--mission','J5-M02','--mode','implementation','--repo',repo,'--head',head],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).allowed,true);
});

function keysFixture(){const op=key(),recovery=key(),replacement=key();const state={repository:'fixture/jarvis',epoch:1,operationalKeys:[op.record],recoveryKeys:[recovery.record],recoveryThreshold:1,usedNonces:[],previousStateDigest:null};
 const request=(purpose='normal-rotation',useNew=true)=>{const payload={purpose,repository:state.repository,expectedEpoch:state.epoch,baseStateDigest:digest(state),nonce:'a'.repeat(64),issuedAt:'2026-09-26T11:59:00Z',expiresAt:'2026-09-26T12:30:00Z',newOperationalKeys:useNew?[replacement.record]:[]};return {payload,proofs:[proof(payload,purpose==='normal-rotation'?op.privateKey:recovery.privateKey),...(useNew?[proof(payload,replacement.privateKey)]:[])]};};return {op,recovery,replacement,state,request};}
test('keys: normal rotation requires old owner and replacement possession',()=>{const f=keysFixture(),next=transition(f.state,f.request(),NOW);assert.equal(next.epoch,2);assert.equal(next.operationalKeys[0].status,'revoked');assert.equal(next.operationalKeys[1].keyId,f.replacement.id);assert.equal(f.state.epoch,1);});
test('keys: loss recovery works without missing operational key',()=>{const f=keysFixture();assert.equal(transition(f.state,f.request('lost-key-recovery'),NOW).epoch,2);});
test('keys: compromise recovery does not trust compromised owner signature',()=>{const f=keysFixture(),r=f.request('compromise-recovery');r.proofs[0]=proof(r.payload,f.op.privateKey);assert.throws(()=>transition(f.state,r,NOW));});
test('keys: emergency revocation works without replacement',()=>{const f=keysFixture(),n=transition(f.state,f.request('emergency-revoke',false),NOW);assert.equal(n.operationalKeys.some(k=>k.status==='active'),false);});
test('keys: revocation cannot smuggle a replacement',()=>{const f=keysFixture();assert.throws(()=>transition(f.state,f.request('emergency-revoke'),NOW));});
test('keys: missing replacement possession rejected',()=>{const f=keysFixture(),r=f.request();r.proofs.pop();assert.throws(()=>transition(f.state,r,NOW));});
test('keys: missing normal rotation owner proof rejected',()=>{const f=keysFixture(),r=f.request();r.proofs.shift();assert.throws(()=>transition(f.state,r,NOW));});
test('keys: changed state invalidates signed transition',()=>{const f=keysFixture(),r=f.request();f.state.epoch=2;assert.throws(()=>transition(f.state,r,NOW));});
test('keys: repeated transition rejected',()=>{const f=keysFixture(),r=f.request(),n=transition(f.state,r,NOW);assert.throws(()=>transition(n,r,NOW));});
test('keys: duplicate signature does not satisfy threshold',()=>{const f=keysFixture(),r=f.request('lost-key-recovery');r.proofs.push(r.proofs[0]);assert.throws(()=>transition(f.state,r,NOW));});
test('keys: tampered replacement rejected',()=>{const f=keysFixture(),r=f.request();r.payload.newOperationalKeys=[key().record];assert.throws(()=>transition(f.state,r,NOW));});
test('keys: recovery role cannot be reused as operational key',()=>{const f=keysFixture(),r=f.request();r.payload.newOperationalKeys=[f.recovery.record];r.proofs=[proof(r.payload,f.op.privateKey),proof(r.payload,f.recovery.privateKey)];assert.throws(()=>transition(f.state,r,NOW));});
test('keys: unsupported recovery-root change rejected',()=>{const f=keysFixture(),r=f.request();r.payload.newRecoveryKeys=[key().record];assert.throws(()=>transition(f.state,r,NOW));});
test('keys: revoked signer rejected',()=>{const f=keysFixture();f.state.operationalKeys[0].status='revoked';assert.throws(()=>transition(f.state,f.request(),NOW));});
test('keys: exhausted epoch denied',()=>{const f=keysFixture();f.state.epoch=Number.MAX_SAFE_INTEGER;assert.throws(()=>transition(f.state,f.request(),NOW));});
test('keys: invalid clock denied',()=>{const f=keysFixture();assert.throws(()=>transition(f.state,f.request(),new Date('invalid')));});
test('keys: expired request denied',()=>{const f=keysFixture();assert.throws(()=>transition(f.state,f.request(),new Date('2026-09-27T00:00:00Z')));});
test('keys: two independently held recovery keys enforce threshold',()=>{const f=keysFixture(),r2=key();f.state.recoveryKeys.push(r2.record);f.state.recoveryThreshold=2;const r=f.request('compromise-recovery');assert.throws(()=>transition(f.state,r,NOW));r.proofs.push(proof(r.payload,r2.privateKey));assert.equal(transition(f.state,r,NOW).epoch,2);});

test('owner signer: preview confirmation binds exact receipt',async()=>{const {signPrepared}=await import('../owner_record_signing.mjs');const k=key(),p=payload(k);const pem=k.privateKey.export({format:'pem',type:'pkcs8'});const e=signPrepared('mission',p,pem,digest(p));assert.deepEqual(verifyRecord(e,policy(k),'mission-completion',NOW),p);assert.throws(()=>signPrepared('mission',p,pem,'0'.repeat(64)));});
test('owner signer: cannot use mission role for arbitrary purpose',async()=>{const {signPrepared}=await import('../owner_record_signing.mjs');const k=key(),p={...payload(k),purpose:'external-payment'};assert.throws(()=>signPrepared('mission',p,k.privateKey,digest(p)));});
test('owner signer: supports standalone key-transition proof',async()=>{const {signPrepared}=await import('../owner_record_signing.mjs');const f=keysFixture(),r=f.request();const signed=signPrepared('key-transition',r.payload,f.op.privateKey,digest(r.payload));r.proofs[0]=signed;assert.equal(transition(f.state,r,NOW).epoch,2);});
