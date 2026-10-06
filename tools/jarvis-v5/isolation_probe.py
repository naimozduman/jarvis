"""Synthetic worker-boundary probe. Execute inside the supplied isolated worker only.
No production address, token or account is read. A passing result covers this probe,
not the Codex host/UI, remote tools, kernel vulnerabilities or the owner's account.
"""
import argparse,json,os,socket,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--host-canary',required=True);p.add_argument('--mode',choices=['audit','test'],required=True);a=p.parse_args()
r={}
r['unprivileged_uid']=hasattr(os,'getuid') and os.getuid()==65532
r['host_canary_unreadable']=not Path(a.host_canary).exists()
r['no_docker_socket']=not any(Path(p).exists() for p in ['/var/run/docker.sock','/run/docker.sock'])
r['no_cloud_env']=not any(any(s in k.upper() for s in ['TOKEN','SECRET','DATABASE_URL','CREDENTIAL','API_KEY','SSH_AUTH']) for k in os.environ)
r['trusted_tools_readonly']=False
try:
 target=Path('/trusted/V41_SYNTHETIC_PROBE_WRITE')
 with target.open('x') as f:f.write('synthetic')
 target.unlink()
except OSError:r['trusted_tools_readonly']=True
r['input_readonly']=False
try:
 target=Path('/input/V41_PROBE_WRITE')
 with target.open('x') as f:f.write('synthetic')
 target.unlink()
except OSError:r['input_readonly']=True
try:
 routes=Path('/proc/net/route').read_text().splitlines()[1:]
 r['no_non_loopback_route']=not any(line.split()[0]!='lo' for line in routes if line.split())
except OSError:r['no_non_loopback_route']=False
try:
 with socket.create_connection(('192.0.2.1',443),timeout=0.5):r['no_outbound_connection']=False
except OSError:r['no_outbound_connection']=True
try:
 Path('/work/PROBE_OUTPUT').write_text('synthetic output')
 r['scratch_writable']=True
except OSError:r['scratch_writable']=False
print(json.dumps({'passed':all(r.values()),'checks':r,'scope':'synthetic container-worker probe only'},sort_keys=True))
sys.exit(0 if all(r.values()) else 2)
