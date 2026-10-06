"""Offline adversarial fixtures for V4.1. No GitHub account or Docker daemon is used.
Tests validate policy/metadata logic, not deployed platform settings or real isolation.
"""
import base64,copy,io,json,os,shutil,subprocess,sys,tempfile,unittest,zipfile
from datetime import datetime,timedelta,timezone
from pathlib import Path
from unittest.mock import patch
TOOLS=Path(__file__).resolve().parents[1];sys.path.insert(0,str(TOOLS))
import promotion_evidence as pe
from common import sha
from isolated_worker import docker_arguments,clean_environment,inspect_boundary,manifest,execute,limited
from prepare_builder import source_path_allowed,prepare

NOW=datetime(2026,9,25,12,10,tzinfo=timezone.utc)
BASE='a'*40;HEAD='b'*40;VERIFIER='c'*40

def iso(d):return d.isoformat().replace('+00:00','Z')

class FakeAPI:
 def __init__(self,now=NOW):
  self.now=now;self.calls=[];self.failure=False
  self.profile={'id':'isolated-verifier','enabled':True,'repository':'fixture/verifier','repositoryId':7,'workflowId':9,
    'workflowPath':'.github/workflows/verify.yml','trustedHeadShas':[VERIFIER], 'allowedBranches':['main'],
    'event':'workflow_dispatch','receiptKeyIds':['test-key'],'maxAgeSeconds':86400,'artifactName':'jarvis-verification-result',
    'requiredJobs':[{'name':'Verify','steps':['Run trusted suite']} ]}
  self.workflow=b'name: Trusted external fixture\n';self.profile['workflowSha256']=sha(self.workflow)
  self.run={'id':11,'run_attempt':2,'repository':{'id':7,'full_name':'fixture/verifier'},'head_repository':{'id':7},
    'workflow_id':9,'event':'workflow_dispatch','head_sha':VERIFIER,'head_branch':'main','path':self.profile['workflowPath'],
    'status':'completed','conclusion':'success','created_at':iso(now-timedelta(hours=2)),
    'run_started_at':iso(now-timedelta(minutes=20)), 'updated_at':iso(now-timedelta(minutes=5))}
  self.latest={'run_attempt':2}
  self.jobs={'total_count':1,'jobs':[{'name':'Verify','run_id':11,'status':'completed','conclusion':'success',
    'steps':[{'name':'Run trusted suite','status':'completed','conclusion':'success'}]}]}
  self.expected={'E-A':{'evalId':'E-A','coverageDigest':'d'*64,'testPaths':['tests/a.py']}}
  self.report={'schemaVersion':1,'subject':{'repository':'fixture/jarvis','base':BASE,'head':HEAD},
    'verifier':{'id':'isolated-verifier','runId':11,'runAttempt':2,'sourceSha':VERIFIER},
    'startedAt':iso(now-timedelta(minutes=19)),'finishedAt':iso(now-timedelta(minutes=6)),
    'suites':[{'evalId':'E-A','coverageDigest':'d'*64,'testPaths':['tests/a.py'],'outcome':'passed','passed':3,'failed':0,'skipped':0}]}
  self.payload={'purpose':'test-verification','repository':'fixture/jarvis','base':BASE,'head':HEAD,'keyId':'test-key',
    'issuedAt':iso(now-timedelta(minutes=1)),'expiresAt':iso(now+timedelta(hours=1)),
    'verification':{'verifierId':'isolated-verifier','runId':11,'runAttempt':2,'artifactId':13}}
  self.seal()
 def seal(self,member='verification-report.json'):
  self.report_bytes=json.dumps(self.report,sort_keys=True).encode();b=io.BytesIO()
  with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:z.writestr(member,self.report_bytes)
  self.raw=b.getvalue();self.payload['verification'].update(artifactSha256=sha(self.raw),reportSha256=sha(self.report_bytes))
  self.artifact={'id':13,'name':'jarvis-verification-result','expired':False,'workflow_run':{'id':11,'head_sha':VERIFIER},
    'digest':'sha256:'+sha(self.raw),'size_in_bytes':len(self.raw),'created_at':iso(self.now-timedelta(minutes=6))}
 def policy(self):return {'evidencePolicyVersion':1,'enabled':True,'repository':'fixture/jarvis','signers':[{'keyId':'test-key'}],
   'workflows':[self.profile],'maxArtifactBytes':20000000,'maxReportBytes':2000000,'maxEvidenceRecords':200,
   'activeControlStates':['active'],'activationRequirements':{'FUTURE':['E-FUTURE'],'SCHEMA-01':['E-FUTURE']},
   'maxValiditySeconds':{'test-verification':86400,'eval-review':7776000}}
 def json(self,path):
  self.calls.append(path)
  if self.failure:raise ValueError('Fixture transport unavailable')
  if path.endswith('/attempts/2/jobs?per_page=100&page=1'):return copy.deepcopy(self.jobs)
  if path.endswith('/attempts/2'):return copy.deepcopy(self.run)
  if path.endswith('/runs/11'):return copy.deepcopy(self.latest)
  if '/contents/' in path:return {'type':'file','encoding':'base64','content':base64.b64encode(self.workflow).decode()}
  if path.endswith('/artifacts/13'):return copy.deepcopy(self.artifact)
  raise ValueError('Unexpected fixture request: '+path)
 def archive(self,path):self.calls.append(path);return self.raw
 def verify(self):return pe.verify_tests(self.payload,self.policy(),self,self.expected,self.now)

class ProvenanceTests(unittest.TestCase):
 def test_matching_run_and_artifact_pass(self):self.assertIn('E-A',FakeAPI().verify())
 def test_wrong_repository_id(self):
  f=FakeAPI();f.run['repository']['id']=8
  with self.assertRaises(ValueError):f.verify()
 def test_other_head_repository(self):
  f=FakeAPI();f.run['head_repository']['id']=8
  with self.assertRaises(ValueError):f.verify()
 def test_unreviewed_workflow_commit(self):
  f=FakeAPI();f.run['head_sha']='e'*40
  with self.assertRaises(ValueError):f.verify()
 def test_wrong_workflow_id(self):
  f=FakeAPI();f.run['workflow_id']=10
  with self.assertRaises(ValueError):f.verify()
 def test_wrong_event(self):
  f=FakeAPI();f.run['event']='pull_request'
  with self.assertRaises(ValueError):f.verify()
 def test_obsolete_rerun(self):
  f=FakeAPI();f.latest['run_attempt']=3
  with self.assertRaises(ValueError):f.verify()
 def test_failed_run(self):
  f=FakeAPI();f.run['conclusion']='failure'
  with self.assertRaises(ValueError):f.verify()
 def test_stale_run(self):
  f=FakeAPI();f.run['updated_at']=iso(NOW-timedelta(days=2))
  with self.assertRaises(ValueError):f.verify()
 def test_future_run(self):
  f=FakeAPI();f.run['updated_at']=iso(NOW+timedelta(seconds=1))
  with self.assertRaises(ValueError):f.verify()
 def test_workflow_source_tamper(self):
  f=FakeAPI();f.workflow+=b'tamper'
  with self.assertRaises(ValueError):f.verify()
 def test_at_branch_workflow_path_is_supported(self):
  f=FakeAPI();f.run['path']+='@main';self.assertIn('E-A',f.verify())
 def test_wrong_path_suffix_is_rejected(self):
  f=FakeAPI();f.run['path']+='@untrusted'
  with self.assertRaises(ValueError):f.verify()
 def test_required_job_skipped(self):
  f=FakeAPI();f.jobs['jobs'][0]['conclusion']='skipped'
  with self.assertRaises(ValueError):f.verify()
 def test_required_step_skipped(self):
  f=FakeAPI();f.jobs['jobs'][0]['steps'][0]['conclusion']='skipped'
  with self.assertRaises(ValueError):f.verify()
 def test_required_job_missing(self):
  f=FakeAPI();f.jobs={'total_count':0,'jobs':[]}
  with self.assertRaises(ValueError):f.verify()
 def test_duplicate_job_name(self):
  f=FakeAPI();f.jobs['jobs']*=2;f.jobs['total_count']=2
  with self.assertRaises(ValueError):f.verify()
 def test_artifact_other_run(self):
  f=FakeAPI();f.artifact['workflow_run']['id']=14
  with self.assertRaises(ValueError):f.verify()
 def test_expired_artifact(self):
  f=FakeAPI();f.artifact['expired']=True
  with self.assertRaises(ValueError):f.verify()
 def test_artifact_from_previous_attempt(self):
  f=FakeAPI();f.artifact['created_at']=iso(NOW-timedelta(hours=1))
  with self.assertRaises(ValueError):f.verify()
 def test_missing_platform_digest(self):
  f=FakeAPI();del f.artifact['digest']
  with self.assertRaises(ValueError):f.verify()
 def test_downloaded_bytes_tampered(self):
  f=FakeAPI();f.raw+=b'tamper'
  with self.assertRaises(ValueError):f.verify()
 def test_zip_path_traversal(self):
  f=FakeAPI();f.seal('../verification-report.json')
  with self.assertRaises(ValueError):f.verify()
 def test_report_subject_wrong_head(self):
  f=FakeAPI();f.report['subject']['head']='f'*40;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_report_wrong_attempt(self):
  f=FakeAPI();f.report['verifier']['runAttempt']=1;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_skipped_tests_rejected(self):
  f=FakeAPI();f.report['suites'][0]['skipped']=1;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_zero_tests_rejected(self):
  f=FakeAPI();f.report['suites'][0]['passed']=0;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_candidate_subset_cannot_claim_full_suite(self):
  f=FakeAPI();f.report['suites'][0]['testPaths']=[];f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_old_suite_content_digest_rejected(self):
  f=FakeAPI();f.report['suites'][0]['coverageDigest']='e'*64;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_duplicate_suite_rejected(self):
  f=FakeAPI();f.report['suites']*=2;f.seal()
  with self.assertRaises(ValueError):f.verify()
 def test_missing_read_token_fails(self):
  with self.assertRaises(ValueError):pe.GitHubAPI('')
 def test_api_unavailable_does_not_trust_the_claim(self):
  f=FakeAPI();f.failure=True
  with self.assertRaises(ValueError):f.verify()
 def test_boolean_run_id_is_not_an_integer(self):
  f=FakeAPI();f.payload['verification']['runId']=True
  with self.assertRaises(ValueError):f.verify()
 def test_duplicate_json_fields_rejected(self):
  with self.assertRaises(ValueError):pe.strict_load('{"a":1,"a":2}')

class FreshnessAndSelection(unittest.TestCase):
 def root(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);return Path(t.name)
 def fixture(self):
  r=self.root();b=r/'base';h=r/'head';b.mkdir();h.mkdir();f=FakeAPI()
  def save(root,path,value):
   p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value))
  self.save=save
  mapping={'sourceRoots':['src/**'],'areas':[{'id':'a','codePatterns':['src/**'],'requiredEvalIds':['E-A'],'owningDocs':['docs/A.md'],'testPatterns':['tests/**']}]}
  catalog={'entries':[{'id':'E-A','path':'tests/a.py','coveragePatterns':['tests/*.py'],'invariantIds':['INV-A'],'reviewIntervalDays':90},
    {'id':'E-FUTURE','path':None,'coveragePatterns':[],'invariantIds':['INV-A'],'reviewIntervalDays':90}]}
  for root in [b,h]:
   save(root,'governance/IMPLEMENTATION_MAP.json',mapping);save(root,'governance/EVAL_CATALOG.json',catalog)
   save(root,'governance/TRUST_POLICY.json',{'operationalExceptions':['governance/runs/*.json']})
   save(root,'governance/EVIDENCE_POLICY.json',f.policy());save(root,'governance/CONTROL_MATRIX.json',{'controls':[{'id':'FUTURE','status':'specified_not_implemented'}]})
   save(root,'governance/SCHEMA_REGISTRY.json',{'contracts':[]});save(root,'governance/INVARIANTS.json',{'rules':[{'id':'INV-A','text':'source'}]})
   (root/'tests').mkdir();(root/'tests/a.py').write_text('assert True\n')
  expected=pe.requirements(['src/a.ts'],b,h)['expected'];f.expected=expected
  f.report['suites'][0]['coverageDigest']=expected['E-A']['coverageDigest'];f.seal()
  review={'purpose':'eval-review','repository':'fixture/jarvis','base':BASE,'head':HEAD,'keyId':'test-key',
    'issuedAt':iso(NOW-timedelta(minutes=1)),'expiresAt':iso(NOW+timedelta(days=1)),
    'reviews':[{'evalId':'E-A','coverageDigest':expected['E-A']['coverageDigest'],'reviewedAt':iso(NOW-timedelta(hours=1)),
                'evidenceRef':'synthetic-independent-review','semanticReview':True}]}
  envelopes=[{'payload':f.payload},{'payload':review}]
  return b,h,f,envelopes
 def evaluate(self,b,h,f,envelopes):
  # Signature verification is unit-tested with actual crypto in Node. This seam only
  # isolates selection/freshness from signature verification; no CLI bypass exists.
  return pe.evaluate(b,h,BASE,HEAD,['src/a.ts'],envelopes,f,NOW,signature_check=lambda *a:None)
 def test_required_fresh_review_and_tests_pass(self):
  b,h,f,e=self.fixture();self.assertTrue(self.evaluate(b,h,f,e)['passed'])
 def test_missing_signed_review_blocks(self):
  b,h,f,e=self.fixture();self.assertFalse(self.evaluate(b,h,f,e[:1])['passed'])
 def test_null_review_timestamp_blocks(self):
  b,h,f,e=self.fixture();e[1]['payload']['reviews'][0]['reviewedAt']=None
  self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_stale_review_blocks(self):
  b,h,f,e=self.fixture();e[1]['payload']['reviews'][0]['reviewedAt']=iso(NOW-timedelta(days=91))
  self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_old_head_review_blocks(self):
  b,h,f,e=self.fixture();e[1]['payload']['head']='e'*40
  self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_reviewed_date_without_semantic_review_blocks(self):
  b,h,f,e=self.fixture();e[1]['payload']['reviews'][0]['semanticReview']=False
  self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_future_unrelated_eval_does_not_block(self):
  b,h,f,e=self.fixture();self.assertEqual(pe.requirements(['src/a.ts'],b,h)['expected'].keys(),{'E-A'})
 def test_candidate_cannot_remove_required_eval_from_map(self):
  b,h,f,e=self.fixture();self.save(h,'governance/IMPLEMENTATION_MAP.json',{'sourceRoots':[],'areas':[]})
  self.assertEqual(pe.requirements(['src/a.ts'],b,h)['expected'].keys(),{'E-A'})
 def test_candidate_cannot_relax_review_interval(self):
  b,h,f,e=self.fixture();catalog=json.loads((h/'governance/EVAL_CATALOG.json').read_text());catalog['entries'][0]['reviewIntervalDays']=9999
  self.save(h,'governance/EVAL_CATALOG.json',catalog);e[1]['payload']['reviews'][0]['reviewedAt']=iso(NOW-timedelta(days=100))
  self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_activation_requires_planned_evidence_to_be_mapped_first(self):
  b,h,f,e=self.fixture();self.save(h,'governance/CONTROL_MATRIX.json',{'controls':[{'id':'FUTURE','status':'active'}]})
  with self.assertRaises(ValueError):pe.requirements(['src/a.ts'],b,h)
 def test_schema_activation_adds_compatibility_gate(self):
  b,h,f,e=self.fixture();self.save(h,'governance/SCHEMA_REGISTRY.json',{'contracts':[{'contractId':'new','status':'active'}]})
  with self.assertRaises(ValueError):pe.requirements(['src/a.ts'],b,h)
 def test_unknown_source_mapping_blocks(self):
  b,h,f,e=self.fixture();m=json.loads((b/'governance/IMPLEMENTATION_MAP.json').read_text());m['areas'][0]['codePatterns']=['src/existing/**'];self.save(b,'governance/IMPLEMENTATION_MAP.json',m)
  with self.assertRaises(ValueError):pe.requirements(['src/new/a.ts'],b,h)
 def test_removing_test_entrypoint_blocks(self):
  b,h,f,e=self.fixture();(h/'tests/a.py').unlink()
  with self.assertRaises(ValueError):pe.requirements(['src/a.ts'],b,h)
 def test_test_content_change_invalidates_previous_review(self):
  b,h,f,e=self.fixture();(h/'tests/a.py').write_text('assert False\n');self.assertFalse(self.evaluate(b,h,f,e)['passed'])
 def test_actual_invalid_signature_rejected_before_remote_fetch(self):
  b,h,f,e=self.fixture();result=pe.evaluate(b,h,BASE,HEAD,['src/a.ts'],e,f,NOW)
  self.assertFalse(result['passed']);self.assertEqual(f.calls,[])
 def test_disabled_evidence_trust_blocks(self):
  b,h,f,e=self.fixture();policy=f.policy();policy['enabled']=False;self.save(b,'governance/EVIDENCE_POLICY.json',policy)
  with self.assertRaises(ValueError):self.evaluate(b,h,f,e)

class IsolationSpecifications(unittest.TestCase):
 def temp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);return Path(t.name)
 def test_docker_flags_have_no_network_no_caps_no_inherited_env(self):
  a=docker_arguments('fixture/image@sha256:'+'a'*64,Path('/source'),Path('/pack'),Path('/output'),'audit',['python3','--version'])
  for flag in ['--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65532:65532']:self.assertIn(flag,a)
  self.assertNotIn('--privileged',a);self.assertNotIn('/var/run/docker.sock',' '.join(a));self.assertIn('-i',a)
 def test_floating_image_rejected(self):
  with self.assertRaises(ValueError):docker_arguments('python:latest',Path('/source'),Path('/pack'),Path('/output'),'audit',['true'])
 def test_bind_argument_injection_rejected(self):
  with self.assertRaises(ValueError):docker_arguments('fixture/image@sha256:'+'a'*64,Path('/source,rw'),Path('/pack'),Path('/output'),'audit',['true'])
 def test_scrubbed_environment_ignores_caller_credentials(self):
  with patch.dict(os.environ,{'VERCEL_TOKEN':'SYNTHETIC','DATABASE_URL':'SYNTHETIC','SSH_AUTH_SOCK':'SYNTHETIC','DOCKER_HOST':'tcp://bad:1'}):
   e=clean_environment(Path('/scratch'))
  for key in ['VERCEL_TOKEN','DATABASE_URL','SSH_AUTH_SOCK','DOCKER_HOST']:self.assertNotIn(key,e)
 def test_secret_paths_rejected_examples_remain(self):
  for p in ['.env','.env.production','.ssh/id_rsa','private.pem','auth.json','.vercel/project.json']:self.assertFalse(source_path_allowed(p))
  self.assertTrue(source_path_allowed('.env.example'));self.assertTrue(source_path_allowed('apps/api/runtime.ts'))
 def boundary(self):return {'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Privileged':False,'CapDrop':['ALL'],
  'SecurityOpt':['no-new-privileges'],'Memory':2147483648,'PidsLimit':128},'Config':{'User':'65532:65532'},
  'Mounts':[{'Destination':'/input','RW':False},{'Destination':'/trusted','RW':False},{'Destination':'/work','RW':True}]}
 def test_expected_boundary_accepts(self):self.assertEqual(inspect_boundary(self.boundary()),[])
 def test_network_mismatch_blocks(self):
  b=self.boundary();b['HostConfig']['NetworkMode']='host';self.assertIn('network none',inspect_boundary(b))
 def test_extra_socket_mount_blocks(self):
  b=self.boundary();b['Mounts'].append({'Destination':'/var/run/docker.sock','RW':True});self.assertIn('mount destinations',inspect_boundary(b))
 def test_writable_trusted_tools_blocks(self):
  b=self.boundary();b['Mounts'][1]['RW']=True;self.assertIn('tools readonly',inspect_boundary(b))
 def test_privileged_daemon_response_blocks(self):
  b=self.boundary();b['HostConfig']['Privileged']=True;self.assertIn('unprivileged',inspect_boundary(b))
 def test_missing_docker_fails_without_host_fallback(self):
  r=self.temp();(r/'source').mkdir();(r/'SOURCE_SNAPSHOT.json').write_text(json.dumps({'sourceFiles':{},'sourceDigest':sha(b'{}')}))
  with patch('isolated_worker.shutil.which',return_value=None):
   with self.assertRaisesRegex(ValueError,'No host-shell fallback'):execute(r,TOOLS.parents[1],r.parent/(r.name+'out'),'fixture/image@sha256:'+'a'*64,'audit',['true'])
 def test_output_is_bounded(self):
  with self.assertRaisesRegex(ValueError,'output limit'):limited([sys.executable,'-c','print("x"*2000)'],dict(os.environ),limit=500)
 def test_prepare_does_not_copy_git_history_or_dirty_secret(self):
  r=self.temp();repo=r/'repo';repo.mkdir()
  def git(*args):return subprocess.check_output(['git',*args],cwd=repo,text=True).strip()
  git('init','-q');git('config','user.name','Synthetic');git('config','user.email','test@example.invalid')
  (repo/'file.ts').write_text('committed');(repo/'.env').write_text('SECRET=SYNTHETIC');git('add','.');git('commit','-qm','fixture');head=git('rev-parse','HEAD')
  (repo/'file.ts').write_text('deliberate dirty work');(repo/'untracked.ts').write_text('untracked')
  result=prepare(repo,head,r/'snapshot');src=r/'snapshot/source'
  self.assertEqual((src/'file.ts').read_text(),'committed');self.assertFalse((src/'.env').exists());self.assertFalse((src/'.git').exists());self.assertGreater(result['dirtyRecords'],0)
  self.assertEqual((repo/'file.ts').read_text(),'deliberate dirty work');self.assertTrue((repo/'.env').exists())
 def test_changed_prepared_source_rejected(self):
  r=self.temp();(r/'source').mkdir();(r/'source/file').write_text('new');(r/'SOURCE_SNAPSHOT.json').write_text(json.dumps({'sourceFiles':{'file':'0'*64}}))
  with self.assertRaises(ValueError):manifest(r)


class AdditionalBoundaryTests(unittest.TestCase):
 def test_required_step_list_cannot_be_empty(self):
  f=FakeAPI();f.profile['requiredJobs'][0]['steps']=[]
  with self.assertRaises(ValueError):f.verify()
 def test_pinned_verifier_list_cannot_be_empty(self):
  f=FakeAPI();f.profile['trustedHeadShas']=[]
  with self.assertRaises(ValueError):f.verify()
 def test_python_path_glob_does_not_expand_operational_scope(self):
  from impact import matching
  self.assertTrue(matching('governance/runs/result.json',['governance/runs/*.json']))
  self.assertFalse(matching('governance/runs/exec/result.json',['governance/runs/*.json']))
  self.assertTrue(matching('apps/new/odd.ext',['apps/**']))
 def test_fresh_signature_and_platform_provenance_together(self):
  # Integration through the real Node verifier, using ephemeral keys and a fake
  # GitHub transport. No bypassed signature checker on this happy path.
  f=FakeAPI(datetime.now(timezone.utc));policy=f.policy()
  with tempfile.TemporaryDirectory() as td:
   root=Path(td)
   js='''import {generateKeyPairSync,createHash,sign} from "node:crypto";
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
process.stdout.write(JSON.stringify({public:publicKey.export({type:"spki",format:"pem"}).toString(),private:privateKey.export({type:"pkcs8",format:"pem"}).toString()}));'''
   key=json.loads(subprocess.check_output(['node','--input-type=module','-e',js]))
   kid=sha(key['public'].encode())[:24];f.payload['keyId']=kid
   policy['signers']=[{'keyId':kid,'publicKeyPem':key['public'],'purposes':['test-verification']}]
   policy['workflows'][0]['receiptKeyIds']=[kid]
   (root/'policy.json').write_text(json.dumps(policy));(root/'key.pem').write_text(key['private'])
   (root/'payload.json').write_text(json.dumps(f.payload))
   r=subprocess.run(['node',str(TOOLS/'evidence-signing.mjs'),'sign','--policy',str(root/'policy.json'),
     '--record',str(root/'payload.json'),'--private-key',str(root/'key.pem'),'--output',str(root/'receipt.json'),
     '--i-verified-the-evidence'],capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr)
   envelope=json.loads((root/'receipt.json').read_text())
   pe.verify_signature(envelope,root/'policy.json')
   self.assertIn('E-A',pe.verify_tests(envelope['payload'],policy,f,f.expected,f.now))
   f.artifact['digest']='sha256:'+'0'*64
   with self.assertRaises(ValueError):pe.verify_tests(envelope['payload'],policy,f,f.expected,f.now)
 def test_invalid_timestamp_is_fail_closed_not_attribute_error(self):
  with self.assertRaises(ValueError):pe.dt(None)


class SourceAndCollectorTests(unittest.TestCase):
 def test_hidden_git_added_after_snapshot_is_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);(r/'source/.git').mkdir(parents=True)
   (r/'source/.git/config').write_text('synthetic data')
   (r/'SOURCE_SNAPSHOT.json').write_text(json.dumps({'sourceFiles':{},'sourceDigest':sha(b'{}')}))
   with self.assertRaises(ValueError):manifest(r)
 def test_symlink_source_root_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);(r/'other').mkdir();(r/'source').symlink_to(r/'other')
   (r/'SOURCE_SNAPSHOT.json').write_text(json.dumps({'sourceFiles':{},'sourceDigest':sha(b'{}')}))
   with self.assertRaises(ValueError):manifest(r)
 def test_tmpfs_mount_is_not_an_extra_host_mount(self):
  b=IsolationSpecifications().boundary();b['Mounts'].append({'Destination':'/tmp','Type':'tmpfs','RW':True})
  self.assertEqual(inspect_boundary(b),[])
 def collector(self,change=False,fork=False):
  from types import SimpleNamespace
  from github_candidate import collect
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);repo=r/'repo';(repo/'governance').mkdir(parents=True)
   (repo/'governance/TRUST_POLICY.json').write_text(json.dumps({'repository':'fixture/jarvis','acceptedBaseBranches':['main']}))
   event=r/'event.json';event.write_text(json.dumps({'repository':{'full_name':'fixture/jarvis'},'issue':{'number':3,'pull_request':{ 'url':'unused'}}}))
   class API:
    n=0
    def json(self,path):
     if '/comments?' in path:return []
     self.n+=1
     return {'state':'open','base':{'sha':BASE,'repo':{'full_name':'fixture/jarvis'},'ref':'main'},
             'head':{'sha':('c'*40 if change and self.n>1 else HEAD),'repo':{'full_name':('other/repo' if fork else 'fixture/jarvis')}}}
   calls=[]
   def run(args,**kwargs):
    calls.append((args,kwargs))
    return SimpleNamespace(returncode=0,stdout=(BASE+'\n' if 'rev-parse' in args else b''))
   with patch.dict(os.environ,{'GH_TOKEN':'SYNTHETIC-READ-TOKEN'}),patch('github_candidate.subprocess.run',side_effect=run):
    result=collect(repo,event,r/'out',api=API())
   return result,calls
 def test_collector_fetches_objects_never_candidate_commands(self):
  result,calls=self.collector()
  self.assertFalse(result['candidateExecuted']);self.assertEqual(result['head'],HEAD)
  self.assertEqual(len(calls),2);self.assertIn('--no-recurse-submodules',calls[1][0])
  self.assertNotIn('SYNTHETIC-READ-TOKEN',' '.join(calls[1][0]))
  self.assertNotIn('checkout',' '.join(calls[1][0]))
 def test_collector_rejects_moving_pr(self):
  with self.assertRaisesRegex(ValueError,'moved'):self.collector(change=True)
 def test_collector_rejects_other_repository(self):
  with self.assertRaisesRegex(ValueError,'Same-repository'):self.collector(fork=True)

if __name__=='__main__':unittest.main()
