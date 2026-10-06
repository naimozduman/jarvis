/** Trusted, dependency-free Git object inspection. Never imports candidate code. */
import { spawnSync } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function stable(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  throw new Error('Canonical gate data accepts JSON with safe integers only.');
}
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
export function match(pattern, path) {
  let out = '^';
  for (let i=0; i<pattern.length; i++) {
    const c=pattern[i];
    if (c==='*') { if (pattern[i+1]==='*') { out+='.*'; i++; } else out+='[^/]*'; }
    else if (c==='?') out+='[^/]';
    else if (c==='[' && pattern.slice(i,i+5)==='[0-9]') { out+='[0-9]'; i+=4; }
    else out+=c.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');
  }
  return new RegExp(out+'$').test(path);
}
function git(repo,args, binary=false) {
  const r=spawnSync('git',['--no-pager','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{
    cwd:repo,encoding:binary?undefined:'utf8',maxBuffer:64*1024*1024,timeout:30000,
    env:{PATH:process.env.PATH,GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_PAGER:'cat'}
  });
  if(r.status!==0) throw new Error(`git read failed: ${String(r.stderr).slice(0,300)}`);
  return r.stdout;
}
function commit(repo,sha) {
  if(!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Use a full immutable 40-character commit SHA.');
  if(git(repo,['rev-parse',sha+'^{commit}']).trim()!==sha) throw new Error('Invalid commit.');
  return sha;
}
export function tree(repo,sha) {
  commit(repo,sha);
  const entries=new Map();
  for(const row of git(repo,['ls-tree','-rz','--full-tree',sha]).split('\0').filter(Boolean)) {
    const tab=row.indexOf('\t'); const [mode,type,oid]=row.slice(0,tab).split(' ');const path=row.slice(tab+1);
    if(!path || /[\x00-\x1f\x7f:]/.test(path) || path.startsWith('/') || path.includes('\\') || path.split('/').some(p=>p==='..'||p==='.'||p.toLowerCase()==='.git'||!p)) throw new Error('Unsafe Git path.');
    entries.set(path,{mode,type,oid});
  }
  return entries;
}
export function changes(repo,base,head) {
  const b=tree(repo,base),h=tree(repo,head), result=[];
  for(const path of [...new Set([...b.keys(),...h.keys()])].sort()) {
    const before=b.get(path)||null,after=h.get(path)||null;
    if(stable(before)!==stable(after)) result.push({path,before,after});
  }
  return result;
}
export function keyId(pem) {
  const key=createPublicKey(pem);
  if(key.asymmetricKeyType!=='ed25519') throw new Error('Only Ed25519 owner keys are supported.');
  return digest(key.export({type:'spki',format:'pem'}).toString()).slice(0,24);
}
export function validatePolicy(policy) {
  if (policy.policyVersion !== 2 || policy.defaultClassification !== 'protected' ||
      policy.requireEnrolledKeyForPromotion !== true ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(policy.repository || '')) {
    throw new Error('V4.1 requires trusted policy v2 with protected-by-default classification.');
  }
  for (const field of ['operationalExceptions','immutableExistingPatterns','immutableExceptions',
                       'trustedKeyIds','operationalAllowedSuffixes','operationalModes']) {
    if (!Array.isArray(policy[field]) || policy[field].some(x=>typeof x!=='string' || !x)) {
      throw new Error('Malformed trusted policy array: '+field);
    }
  }
  if (!Number.isSafeInteger(policy.maxApprovalSeconds) || policy.maxApprovalSeconds < 1) {
    throw new Error('Invalid trusted approval lifetime.');
  }
}
export function inspect(repo,base,head,policy) {
  validatePolicy(policy);
  const delta=changes(repo,base,head), protectedPaths=[], operationalPaths=[], immutablePaths=[], unsafePaths=[];
  if(delta.length>(policy.maxFiles??20000))throw new Error('Changed-file limit exceeded');
  let totalBytes=0;
  for(const c of delta) {
    if(c.after && (c.after.type!=='blob' || !['100644','100755'].includes(c.after.mode))) unsafePaths.push(c.path);
    if(c.after?.type==='blob') {
      const bytes=Number(git(repo,['cat-file','-s',c.after.oid]).trim());
      totalBytes+=bytes;
      if(!Number.isSafeInteger(bytes) || bytes>(policy.maxBlobBytes??2000000) || totalBytes>(policy.maxTotalBytes??100000000)) {
        throw new Error('Changed blob budget exceeded.');
      }
    }
    if(c.before && policy.immutableExistingPatterns.some(p=>match(p,c.path)) && !policy.immutableExceptions.some(p=>match(p,c.path))) immutablePaths.push(c.path);
    // No inference from filename, frontmatter or the candidate policy. Both sides of a
    // rename are classified by changes(), which compares complete immutable trees.
    const records=[c.before,c.after].filter(Boolean);
    const operational=policy.operationalExceptions.some(p=>match(p,c.path)) &&
      policy.operationalAllowedSuffixes.some(s=>c.path.endsWith(s)) &&
      records.every(e=>e.type==='blob' && policy.operationalModes.includes(e.mode));
    (operational ? operationalPaths : protectedPaths).push(c.path);
  }
  return {repository:policy.repository,base,head,diffDigest:digest(delta),changedPaths:delta.map(x=>x.path),protectedPaths,operationalPaths,immutablePaths,unsafePaths};
}
export function verifyApproval(report,policy,envelope,pem,now=new Date()) {
  if(!envelope || envelope.format!=='jarvis-governance-approval-v1') throw new Error('Missing exact-change owner approval.');
  const p=envelope.payload;
  if(!p || Object.keys(p).sort().join(',')!==['repository','base','head','diffDigest','issuedAt','expiresAt','keyId','purpose'].sort().join(',')) throw new Error('Unexpected approval payload.');
  for(const field of ['repository','base','head','diffDigest']) if(p[field]!==report[field]) throw new Error(`Approval mismatch: ${field}`);
  if(p.purpose!=='protected-change-promotion') throw new Error('Wrong approval purpose.');
  const id=keyId(pem);
  if(p.keyId!==id || !policy.trustedKeyIds.includes(id)) throw new Error('Owner key is not enrolled in trusted baseline.');
  const issued=Date.parse(p.issuedAt),expires=Date.parse(p.expiresAt),n=now.getTime();
  if(!Number.isFinite(n)||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>n+60_000||expires<=n||expires<=issued||expires-issued>policy.maxApprovalSeconds*1000) throw new Error('Approval expired or invalid duration.');
  if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) throw new Error('Malformed signature.');
  const sig=Buffer.from(envelope.signature,'base64');
  if(sig.length!==64 || !verify(null,Buffer.from(stable(p)),createPublicKey(pem),sig)) throw new Error('Invalid owner signature.');
  return true;
}
export function evaluate({repo,base,head,policy,envelope=null,publicKey=null,now=new Date()}) {
  const report=inspect(repo,base,head,policy);
  if(policy.bootstrapStatus!=='owner_key_enrolled' || !policy.trustedKeyIds.length) return {...report,allowed:false,reason:'Promotion blocked: owner key is not enrolled. Read-only inspect/M00 remains available.'};
  if(report.unsafePaths.length) return {...report,allowed:false,reason:'Symlink/submodule/unsupported changed entry rejected.'};
  if(report.immutablePaths.length) return {...report,allowed:false,reason:'Existing immutable history cannot be rewritten by this promotion path.'};
  if(report.protectedPaths.length) {
    try {verifyApproval(report,policy,envelope,publicKey,now);}catch(e){return {...report,allowed:false,reason:e.message};}
  }
  return {...report,allowed:true,reason:report.protectedPaths.length?'Exact protected diff owner-authorized.':'Operational-only diff; authenticated evidence/static checks remain required. This is not a deployment authorization.'};
}
export function argumentsOf(argv) {
 const out={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')) throw new Error('Expected --argument value.');const k=argv[i].slice(2);if(out[k]!==undefined)throw new Error('Duplicate argument');if(i+1>=argv.length||argv[i+1].startsWith('--'))out[k]=true;else out[k]=argv[++i];}return out;
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1]||'')).href) {
 try {
  const a=argumentsOf(process.argv.slice(2));
  for(const k of ['repo','base','head','policy'])if(typeof a[k]!=='string')throw new Error(`Required --${k}`);
  const opts={repo:a.repo,base:a.base,head:a.head,policy:JSON.parse(readFileSync(a.policy,'utf8')),publicKey:a['public-key']?readFileSync(a['public-key'],'utf8'):null};
  if (a['inspect-only'] === true) {
    console.log(JSON.stringify({...inspect(opts.repo,opts.base,opts.head,opts.policy),allowed:false,auditOnly:true},null,2));
    process.exit(0);
  }
  let receipts=a['approvals-file']?JSON.parse(readFileSync(a['approvals-file'],'utf8')):[a.approval?JSON.parse(readFileSync(a.approval,'utf8')):null];
  if(!Array.isArray(receipts)||receipts.length>500)throw new Error('Invalid approval collection');
  if(!receipts.length)receipts=[null];
  let result;
  for(const envelope of receipts){result=evaluate({...opts,envelope});if(result.allowed)break;}
  console.log(JSON.stringify(result,null,2));process.exitCode=result.allowed?0:2;
 }catch(e){console.error(JSON.stringify({allowed:false,error:e.message}));process.exitCode=2;}
}
