"""Owner-operated rootless Linux Docker worker. No unrestricted fallback.

This executes offline audit/test commands, not the networked Codex reasoning process.
Install the Codex host in a separate credential-free account/VM as documented. Never
expose this host's Docker socket as a general tool to candidate code.
"""
from __future__ import annotations
import argparse,json,os,re,selectors,shutil,socket,stat,subprocess,sys,tempfile,time
from pathlib import Path
from common import sha,read_json
from prepare_builder import source_path_allowed

IMAGE=re.compile(r'^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$')


def require(c,m):
 if not c:raise ValueError(m)


def clean_environment(home: Path) -> dict:
 # Docker talks only to an explicitly selected local rootless socket.
 return {'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(home),'DOCKER_CONFIG':str(home/'docker-config'),
         'LANG':'C.UTF-8','LC_ALL':'C.UTF-8'}


def limited(argv, env, timeout=30, limit=4_000_000):
 """Bound both output and runtime; never print raw tool errors containing host config."""
 p=subprocess.Popen(argv,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);sel.register(p.stderr,selectors.EVENT_READ)
 buffers={p.stdout:bytearray(),p.stderr:bytearray()};started=time.monotonic()
 try:
  while sel.get_map():
   if time.monotonic()-started>timeout:raise ValueError('Worker/tool timeout')
   for key,_ in sel.select(0.1):
    chunk=os.read(key.fileobj.fileno(),65536)
    if not chunk:sel.unregister(key.fileobj);continue
    buffers[key.fileobj].extend(chunk)
    if sum(len(v) for v in buffers.values())>limit:raise ValueError('Worker output limit exceeded')
  code=p.wait(timeout=5)
  return code,bytes(buffers[p.stdout]),bytes(buffers[p.stderr])
 finally:
  if p.poll() is None:p.kill();p.wait()
  sel.close();p.stdout.close();p.stderr.close()


def manifest(prepared: Path):
 require(prepared.is_dir() and not prepared.is_symlink(),'Prepared snapshot directory required')
 report=read_json(prepared,'SOURCE_SNAPSHOT.json');source=prepared/'source'
 require(source.is_dir() and not source.is_symlink(),'Source root must be an ordinary directory')
 actual={}
 for p in source.rglob('*'):
  rel=p.relative_to(source).as_posix()
  require(not p.is_symlink() and source_path_allowed(rel),'Sensitive or linked entry in prepared source')
  if p.is_file():actual[rel]=sha(p.read_bytes())
 require(sha(json.dumps(actual,sort_keys=True,separators=(',',':')).encode())==report.get('sourceDigest'),'Source digest mismatch')
 require(actual==report.get('sourceFiles'),'Prepared source changed; generate a new operator-reviewed snapshot')
 require(all(source_path_allowed(p) for p in actual),'Sensitive source path in prepared snapshot')
 return source,report


def docker_arguments(image: str, source: Path, pack: Path, work: Path, mode: str, command: list[str]) -> list[str]:
 require(bool(IMAGE.fullmatch(image)),'Use an already-installed, owner-reviewed image@sha256 digest')
 require(mode in ['audit','test'] and command and all(isinstance(x,str) and '\x00' not in x for x in command),'Invalid worker command')
 for path in [source,pack,work]:
  require(path.is_absolute() and not any(c in str(path) for c in [',','\n','\r']),'Unsafe bind path')
 return ['create','--pull=never','--network=none','--read-only','--cap-drop=ALL',
         '--security-opt=no-new-privileges','--user=65532:65532','--pids-limit=128',
         '--memory=2g','--cpus=2','--log-driver=none',
         '--tmpfs=/tmp:rw,nosuid,nodev,size=268435456,mode=1777',
         '--mount',f'type=bind,src={source},dst=/input,readonly',
         '--mount',f'type=bind,src={pack},dst=/trusted,readonly',
         '--mount',f'type=bind,src={work},dst=/work',
         '--workdir='+('/input' if mode=='audit' else '/work/source'),
         '--entrypoint=/usr/bin/env',image,'-i','PATH=/usr/local/bin:/usr/bin:/bin',
         'HOME=/tmp/jarvis-home','LANG=C.UTF-8','CI=true',*command]


def inspect_boundary(data: dict) -> list[str]:
 h=data.get('HostConfig',{});c=data.get('Config',{});errors=[]
 checks={
 'network none':h.get('NetworkMode')=='none','read-only root':h.get('ReadonlyRootfs') is True,
 'unprivileged':h.get('Privileged') is False,'uid':c.get('User')=='65532:65532',
 'dropped capabilities':'ALL' in h.get('CapDrop',[]) and not h.get('CapAdd'),
 'no-new-privileges':any(x.split('=')[0]=='no-new-privileges' for x in h.get('SecurityOpt',[])),
 'not host PID':h.get('PidMode')!='host','no devices':not h.get('Devices'),
 'no host IPC':h.get('IpcMode')!='host','resources bounded':h.get('Memory',0)>0 and h.get('PidsLimit',0)>0,
 }
 mounts={m.get('Destination'):m for m in data.get('Mounts',[])}
 checks['mount destinations']=set(mounts) in [{'/input','/trusted','/work'},{'/input','/trusted','/work','/tmp'}]
 if '/tmp' in mounts:checks['tmp is tmpfs']=mounts['/tmp'].get('Type')=='tmpfs'
 checks['input readonly']=mounts.get('/input',{}).get('RW') is False
 checks['tools readonly']=mounts.get('/trusted',{}).get('RW') is False
 checks['scratch writable']=mounts.get('/work',{}).get('RW') is True
 return [name for name,ok in checks.items() if not ok]


def execute(prepared,pack,out,image,mode,command,probe=False,timeout=600):
 require(sys.platform=='linux' and hasattr(os,'getuid'),'This worker supports Linux rootless Docker only; use a separate Linux VM on other hosts')
 source,source_report=manifest(prepared)
 require(not out.exists(),'Choose a fresh scratch output directory')
 require(not out.resolve().is_relative_to(prepared.resolve()) and not out.resolve().is_relative_to(pack.resolve()),'Output must be outside input and trusted pack')
 docker=shutil.which('docker',path='/usr/local/bin:/usr/bin:/bin')
 require(bool(docker),'Rootless Docker is unavailable. No host-shell fallback was executed.')
 uid=os.getuid();sock=Path(f'/run/user/{uid}/docker.sock')
 require(sock.exists() and not sock.is_symlink() and stat.S_ISSOCK(sock.stat().st_mode) and sock.stat().st_uid==uid,'Expected current-user rootless Docker socket')
 out.mkdir(parents=True,mode=0o700);work=out/'work';work.mkdir(mode=0o777);work.chmod(0o777)
 if mode=='test':
  shutil.copytree(source,work/'source')
  for p in (work/'source').rglob('*'):p.chmod(0o777 if p.is_dir() else 0o666)
  (work/'source').chmod(0o777)
 with tempfile.TemporaryDirectory(prefix='jarvis-worker-owner-') as tmp:
  private=Path(tmp);canary=private/'synthetic-unmounted-canary';canary.write_text('DUMMY-NOT-A-CREDENTIAL')
  env=clean_environment(private);prefix=[docker,'--host','unix://'+str(sock)]
  rc,raw,_=limited(prefix+['info','--format','{{json .SecurityOptions}}'],env)
  require(rc==0 and any('rootless' in x for x in json.loads(raw)),'Daemon did not confirm rootless mode')
  if probe:command=['python3','/trusted/tools/jarvis-v5/isolation_probe.py','--host-canary',str(canary),'--mode',mode]
  args=docker_arguments(image,source,pack,work,mode,command)
  cid=None
  try:
   rc,raw,_=limited(prefix+args,env)
   require(rc==0,'Container creation failed; image must already be installed, no pull is attempted')
   cid=raw.decode().strip();require(bool(re.fullmatch('[a-f0-9]{64}',cid)),'Unexpected container ID')
   rc,raw,_=limited(prefix+['inspect',cid],env);require(rc==0,'Container inspection failed')
   boundary=json.loads(raw)[0];errors=inspect_boundary(boundary)
   sources={m['Destination']:m.get('Source') for m in boundary.get('Mounts',[])}
   require(all(sources.get(k)==str(v) for k,v in {'/input':source,'/trusted':pack,'/work':work}.items()),'Unexpected host mount source')
   require(boundary.get('Config',{}).get('Image')==image,'Image identity changed')
   require(not errors,'Boundary mismatch: '+', '.join(errors))
   started=time.time();rc,stdout,stderr=limited(prefix+['start','--attach',cid],env,timeout)
   (out/'stdout.log').write_bytes(stdout);(out/'stderr.log').write_bytes(stderr)
   require(canary.read_text()=='DUMMY-NOT-A-CREDENTIAL','Host canary changed')
   report={'format':'jarvis-isolated-worker-v1','mode':mode,'image':image,'sourceCommit':source_report['sourceCommit'],
           'sourceDigest':source_report['sourceDigest'],'elapsedSeconds':round(time.time()-started,3),
           'exitCode':rc,'boundaryChecksPassed':True,'probe':probe,'stdoutSha256':sha(stdout),'stderrSha256':sha(stderr),
           'trustedPromotionEvidence':False,'codexHostCertified':False,
           'scope':'This worker only. Local report is not an independently signed release result.'}
   if probe:
    result=json.loads(stdout);require(rc==0 and result.get('passed') is True,'Synthetic worker probe failed');report['probeResults']=result
   (out/'WORKER_RESULT.json').write_text(json.dumps(report,indent=2)+'\n')
   return report
  finally:
   if cid:limited(prefix+['rm','--force',cid],env)


if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--prepared',type=Path,required=True);p.add_argument('--pack',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--image',required=True);p.add_argument('--mode',choices=['audit','test'],default='audit');p.add_argument('--probe',action='store_true');p.add_argument('--plan-only',action='store_true');p.add_argument('--timeout',type=int,default=600);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args()
 try:
  command=a.command[1:] if a.command[:1]==['--'] else a.command
  if a.plan_only:
   source,meta=manifest(a.prepared.resolve());args=docker_arguments(a.image,source,a.pack.resolve(),a.out.resolve()/'work',a.mode,command or ['python3','--version'])
   print(json.dumps({'auditOnly':True,'isolationEstablished':False,'dockerArguments':args},indent=2))
  else:print(json.dumps(execute(a.prepared.resolve(),a.pack.resolve(),a.out.resolve(),a.image,a.mode,command,a.probe,a.timeout),indent=2))
 except Exception as e:print(json.dumps({'passed':False,'error':str(e),'hostFallbackExecuted':False}));sys.exit(2)
