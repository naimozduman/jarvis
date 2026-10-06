/** Data-only mission admission. Install in the trusted runner; this file does not start an agent. */
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readJSON,verifyRecord,exactKeys,digest,stable} from './signed_records.mjs';
import {argumentsOf} from './trust-gate.mjs';
function bytes(root,rel){if(typeof rel!=='string'||!rel||isAbsolute(rel)||rel.includes('\\')||rel.includes(':')||rel.split('/').some(x=>['..','.',''].includes(x)))throw new Error('Unsafe mission source path');let p=resolve(root);for(const x of rel.split('/')){p=resolve(p,x);if(lstatSync(p).isSymbolicLink())throw new Error('Mission source symlink');}if(!p.startsWith(resolve(root)+sep)||lstatSync(p).size>2_000_000)throw new Error('Mission source limit');return readFileSync(p);}
export function definitionDigest(root,mission,spec){
 const {runState,completedRunRef,...definition}=mission;
 const found=new Map(spec.sections.flatMap(s=>s.requirements.map(r=>[r.id,{...r,origin:s.origin}])));
 const requirements=mission.requirementIds.map(id=>{if(!found.has(id))throw new Error('Unknown mission requirement');return found.get(id);});
 return digest({definition,sources:[mission.path,...mission.requiredReading].map(path=>({path,sha256:createHash('sha256').update(bytes(root,path)).digest('hex')})),requirements});
}
function ancestry(repo,ancestor,head){
 for(const sha of [ancestor,head])if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Full commit SHA required');
 const args=['--no-pager','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','merge-base','--is-ancestor',ancestor,head];
 const r=spawnSync('git',args,{cwd:repo,encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:{PATH:process.env.PATH,GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0'}});
 if(![0,1].includes(r.status))throw new Error('Trusted ancestry check failed');return r.status===0;
}
export function admit({root,roadmap,spec,policy,missionId,mode='implementation',head,receipts=[],now=new Date(),isAncestor}){
 const missions=new Map(roadmap.missions.map(m=>[m.id,m]));const m=missions.get(missionId);
 if(!m)throw new Error('Unknown mission');if(missions.size!==roadmap.missions.length)throw new Error('Duplicate mission');
 if(mode==='audit'&&missionId==='J5-M00')return {allowed:true,scope:'sanitized_audit_only',installedTrust:false,executesCommands:false,reason:'No source writes or credential access authorized.'};
 if(mode==='bootstrap-preparation'&&missionId==='J5-M01')return {allowed:true,scope:'owner_bootstrap_preparation_only',installedTrust:false,executesCommands:false,reason:'Installation must produce real evidence; no implementation admission.'};
 if(mode!=='implementation'||!/^J5-M\d{2}$/.test(missionId)||['J5-M00','J5-M01'].includes(missionId))throw new Error('Wrong admission mode');
 if(!/^[a-f0-9]{40}$/.test(head||'')||typeof isAncestor!=='function')throw new Error('Trusted checkpoint/ancestry required');
 if(policy.enabled!==true)throw new Error('Mission policy not enrolled');
 if(receipts.length>200)throw new Error('Receipt collection limit');
 const needed=new Set(['J5-M01']);const stack=new Set();
 function deps(id){if(stack.has(id))throw new Error('Mission dependency cycle');const item=missions.get(id);if(!item)throw new Error('Unknown dependency');stack.add(id);for(const dep of item.dependsOn){needed.add(dep);deps(dep);}stack.delete(id);}
 deps(missionId);const verified=[];
 for(const id of needed){let good=null;const errors=[];
  for(const e of receipts.filter(e=>e?.payload?.missionId===id)){
   try{
    const purpose=id==='J5-M01'?'trusted-bootstrap':'mission-completion';const p=verifyRecord(e,policy,purpose,now);
    const fields=['purpose','repository','trustEpoch','missionId','definitionDigest','checkpoint','evidenceDigest','issuedAt','expiresAt','keyId'];if(purpose==='trusted-bootstrap')fields.push('controls');exactKeys(p,fields);
    if(p.definitionDigest!==definitionDigest(root,missions.get(id),spec))throw new Error('Mission definition drift');
    if(!/^[a-f0-9]{40}$/.test(p.checkpoint||'')||!/^[a-f0-9]{64}$/.test(p.evidenceDigest)||!isAncestor(p.checkpoint,head))throw new Error('Evidence/checkpoint mismatch');
    if(purpose==='trusted-bootstrap'){
     const required=['isolatedBuilder','independentVerifier','protectedMerge','recoveryDrill','currentHeadAdmission'];exactKeys(p.controls,required);
     if(required.some(k=>p.controls[k]!==true))throw new Error('Bootstrap controls incomplete');
    }
    good=p;break;
   }catch(error){errors.push(error.message);}
  }
  if(!good)throw new Error(`Missing trusted prerequisite ${id}${errors.length?': '+errors.join(', '):''}`);
  verified.push({missionId:id,evidenceDigest:good.evidenceDigest,checkpoint:good.checkpoint});
 }
 return {allowed:true,scope:'bounded_mission_work_only',missionId,definitionDigest:definitionDigest(root,m,spec),head,prerequisites:verified,executesCommands:false,reason:'No runtime action, provider or deployment authority granted.'};
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1]||'')).href){try{
 const a=argumentsOf(process.argv.slice(2));for(const x of ['trusted-root','policy','mission','mode'])if(typeof a[x]!=='string')throw new Error('Required --'+x);
 if(a.mode==='implementation'&&typeof a.repo!=='string')throw new Error('Required --repo for trusted ancestry');
 const root=resolve(a['trusted-root']),policy=readJSON(a.policy),roadmap=readJSON(resolve(root,'governance/ROADMAP.json')),spec=readJSON(resolve(root,'governance/PRODUCT_SPEC.json'));
 const result=admit({root,policy,roadmap,spec,missionId:a.mission,mode:a.mode,head:a.head,receipts:a.receipts?readJSON(a.receipts):[],isAncestor:(from,to)=>ancestry(a.repo,from,to)});console.log(JSON.stringify(result,null,2));
}catch(error){console.error(JSON.stringify({allowed:false,error:error.message}));process.exitCode=2;}}
