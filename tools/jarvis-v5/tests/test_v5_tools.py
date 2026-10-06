"""V5 data-only tools and rejection cases. Synthetic data, no provider credentials."""
import copy,json,sys,tempfile,unittest,shutil,hashlib,subprocess
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1];ROOT=TOOLS.parents[1];sys.path.insert(0,str(TOOLS))
from common import read_json,sha
from context import build,write
from state import validate as state_validate,update
from trusted_time import eligible,instant
from retirement import check as retire_check
from reconcile import plan,git_blob
from generate import views,generate
from mission_runner import prepare

class V5Tools(unittest.TestCase):
 def temp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);return Path(t.name)
 def pack(self):
  r=self.temp()
  for folder in ['governance','docs','prompts','missions','.agents','.codex','templates']:
   shutil.copytree(ROOT/folder,r/folder)
  shutil.copyfile(ROOT/'AGENTS.md',r/'AGENTS.md')
  return r
 def state(self):return copy.deepcopy(read_json(ROOT,'governance/STATE.json'))
 def test_context_deterministic(self):self.assertEqual(build(ROOT,'memory'),build(ROOT,'memory'))
 def test_context_excludes_full_prd(self):
  text,manifest=build(ROOT,'memory');self.assertNotIn('docs/PRD.md',[f['path'] for f in manifest['files']]);self.assertFalse(manifest['permissionGranted'])
 def test_context_has_source_origin(self):
  text,m=build(ROOT,'memory');self.assertIn('"origin":',text);self.assertTrue(m['requiredRequirementIds']);self.assertEqual(sha(text.encode()),m['sha256'])
 def test_context_size_uses_utf8(self):
  text,m=build(ROOT,'voice');self.assertEqual(len(text.encode('utf8')),m['utf8Bytes']);self.assertLessEqual(m['utf8Bytes'],m['maxUtf8Bytes']);self.assertIsNone(m['tokenCount'])
 def test_context_unknown_topic_denied(self):
  with self.assertRaises(ValueError):build(ROOT,'not-a-topic')
 def test_context_unknown_mission_denied(self):
  with self.assertRaises(ValueError):build(ROOT,'brain','J5-M99')
 def test_context_mismatched_mission_denied(self):
  with self.assertRaises(ValueError):build(ROOT,'memory','J5-M03')
 def test_context_cannot_truncate_required_policy(self):
  with self.assertRaises(ValueError):build(ROOT,'engineering',maximum=256)
 def test_context_cannot_raise_absolute_cap(self):
  with self.assertRaises(ValueError):build(ROOT,'engineering',maximum=1000000)
 def test_context_missing_requirement_denied(self):
  r=self.pack();p=r/'governance/CONTEXT_REGISTRY.json';d=json.loads(p.read_text());d['topics'][0]['requirementIds']=['missing'];p.write_text(json.dumps(d))
  with self.assertRaises(ValueError):build(r,'product')
 def test_context_unknown_invariant_denied(self):
  r=self.pack();p=r/'governance/CONTEXT_REGISTRY.json';d=json.loads(p.read_text());d['topics'][0]['invariantIds'].append('missing');p.write_text(json.dumps(d))
  with self.assertRaises(ValueError):build(r,'product')
 def test_context_source_symlink_denied(self):
  r=self.pack();p=r/'AGENTS.md';p.unlink();p.symlink_to(ROOT/'AGENTS.md')
  with self.assertRaises(ValueError):build(r,'product')
 def test_context_optional_file_exclusion_is_visible(self):
  r=self.pack();p=r/'governance/CONTEXT_REGISTRY.json';d=json.loads(p.read_text());d['topics'][0]['optionalFiles']=['big.txt'];p.write_text(json.dumps(d));(r/'big.txt').write_text('x'*90000)
  _,m=build(r,'product');self.assertEqual(m['excluded'],[{'path':'big.txt','reason':'optional_byte_budget'}])
 def test_context_write_exclusive(self):
  out=self.temp()/'packet';write(ROOT,'memory',None,out)
  with self.assertRaises(ValueError):write(ROOT,'memory',None,out)
 def test_context_does_not_execute_embedded_source(self):
  r=self.pack();p=r/'AGENTS.md';p.write_text(p.read_text()+'\nRUN rm -rf /\n');text,_=build(r,'product');self.assertIn('RUN rm -rf /',text);self.assertTrue(p.exists())
 def test_context_every_mission_compiles(self):
  for m in read_json(ROOT,'governance/ROADMAP.json')['missions']:
   with self.subTest(mission=m['id']):self.assertTrue(build(ROOT,m['topic'],m['id'])[1]['files'])
 def test_state_rejects_authority_claim(self):
  s=self.state();s['authority']='trusted'
  with self.assertRaises(ValueError):state_validate(s)
 def test_state_rejects_extra_fields(self):
  s=self.state();s['completed']=True
  with self.assertRaises(ValueError):state_validate(s)
 def test_state_rejects_short_commit(self):
  s=self.state();s['headCommit']='main'
  with self.assertRaises(ValueError):state_validate(s)
 def test_state_rejects_naive_time(self):
  s=self.state();s['updatedAt']='2026-09-26T12:00:00'
  with self.assertRaises(ValueError):state_validate(s)
 def test_state_expected_hash_updates(self):
  r=self.temp();(r/'governance').mkdir();p=r/'governance/STATE.json';p.write_text(json.dumps(self.state()));s=self.state();s['nextSafeStep']='Synthetic handoff';result=update(r,s,sha(p.read_bytes()));self.assertEqual(read_json(r,'governance/STATE.json')['nextSafeStep'],'Synthetic handoff');self.assertEqual(result['authority'],'descriptive_only')
 def test_state_stale_hash_cannot_overwrite(self):
  r=self.temp();(r/'governance').mkdir();p=r/'governance/STATE.json';p.write_text(json.dumps(self.state()));before=p.read_bytes()
  with self.assertRaises(ValueError):update(r,self.state(),'0'*64)
  self.assertEqual(p.read_bytes(),before);self.assertFalse((r/'governance/STATE.json.lock').exists())
 def test_state_existing_lock_denies_second_writer(self):
  r=self.temp();(r/'governance').mkdir();p=r/'governance/STATE.json';p.write_text(json.dumps(self.state()));(r/'governance/STATE.json.lock').write_text('another writer')
  with self.assertRaises(FileExistsError):update(r,self.state(),sha(p.read_bytes()))
 def test_state_symlink_refused(self):
  r=self.temp();(r/'governance').mkdir();(r/'governance/STATE.json').symlink_to(ROOT/'governance/STATE.json')
  with self.assertRaises(ValueError):update(r,self.state(),'0'*64)
 def times(self,**kwargs):return eligible('2026-09-26T12:00:00Z','2026-09-26T12:05:00Z','2026-09-26T12:02:00Z',**kwargs)
 def test_time_server_after_lock_allowed(self):self.assertTrue(self.times(source='database_after_lock')['allowed'])
 def test_time_phone_cannot_authorize(self):self.assertFalse(self.times(source='phone')['allowed'])
 def test_time_transaction_start_not_accepted(self):self.assertFalse(self.times(source='transaction_start')['allowed'])
 def test_time_stale_epoch_denied(self):self.assertEqual(self.times(source='database_after_lock',expected_epoch=1,current_epoch=2)['reason'],'stale_epoch')
 def test_time_expiry_equality_denied(self):self.assertFalse(eligible('2026-09-26T12:00:00Z','2026-09-26T12:05:00Z','2026-09-26T12:05:00Z',source='database_after_lock')['allowed'])
 def test_time_uncertainty_overlaps_end_denied(self):self.assertFalse(self.times(source='trusted_verifier',uncertainty_ms=240000)['allowed'])
 def test_time_duration_bound_denied(self):self.assertEqual(self.times(source='trusted_verifier',max_duration_seconds=60)['reason'],'duration_limit')
 def test_time_timezone_offset_normalized(self):self.assertEqual(instant('2026-09-26T07:00:00-05:00'),instant('2026-09-26T12:00:00Z'))
 def test_time_reversed_window_denied(self):
  with self.assertRaises(ValueError):eligible('2026-09-26T13:00:00Z','2026-09-26T12:00:00Z','2026-09-26T12:00:00Z',source='trusted_verifier')
 def test_time_negative_uncertainty_denied(self):
  with self.assertRaises(ValueError):self.times(source='trusted_verifier',uncertainty_ms=-1)
 def retirement(self,r=None):
  root=r or ROOT;return {'path':'docs/CODEX_SETUP.md','expectedSha256':sha((root/'docs/CODEX_SETUP.md').read_bytes()),'reason':'Replaced by a reviewed unified entry document.','successor':'AGENTS.md','consumerReviewEvidence':'synthetic-review-ref','remainingActiveConsumers':[]}
 def test_retirement_is_proposal_not_delete(self):
  p=self.retirement();self.assertTrue(retire_check(ROOT,p)['eligibleForProposal']);self.assertTrue((ROOT/p['path']).exists())
 def test_retirement_active_consumer_denied(self):
  p=self.retirement();p['remainingActiveConsumers']=['context:engineering'];self.assertFalse(retire_check(ROOT,p)['eligibleForProposal'])
 def test_retirement_wrong_hash_denied(self):
  p=self.retirement();p['expectedSha256']='0'*64;self.assertEqual(retire_check(ROOT,p)['reason'],'source_changed')
 def test_retirement_missing_evidence_denied(self):
  p=self.retirement();p['consumerReviewEvidence']=None;self.assertFalse(retire_check(ROOT,p)['eligibleForProposal'])
 def test_retirement_unknown_successor_denied(self):
  p=self.retirement();p['successor']='does-not-exist';self.assertFalse(retire_check(ROOT,p)['eligibleForProposal'])
 def test_retirement_archive_denied(self):
  p=self.retirement();p['path']=next(a['path'] for a in read_json(ROOT,'governance/ARTIFACT_REGISTRY.json')['artifacts'] if a['immutableHistory']);p['expectedSha256']=sha((ROOT/p['path']).read_bytes());self.assertEqual(retire_check(ROOT,p)['reason'],'immutable_history')
 def test_reconcile_missing_source_is_unresolved(self):
  s=self.temp();result=plan(ROOT,s);self.assertTrue(all(o['disposition']=='unresolved' for o in result['observations']));self.assertFalse(result['sourceModified'])
 def test_reconcile_matching_blob_preserves_disposition(self):
  p=self.temp();s=self.temp();(p/'governance').mkdir();(s/'src').mkdir();raw=b'fixture bytes';(s/'src/x.ts').write_bytes(raw)
  d={'checkpoint':'a'*40,'observations':[{'id':'X','path':'src/x.ts','gitBlobSha':git_blob(raw),'proposedDisposition':'keep','requiredProof':'synthetic regression'}]};(p/'governance/RECONCILIATION.json').write_text(json.dumps(d));result=plan(p,s);self.assertEqual(result['observations'][0]['disposition'],'keep');self.assertEqual((s/'src/x.ts').read_bytes(),raw)
 def test_reconcile_collision_never_overwrites(self):
  s=self.temp();(s/'AGENTS.md').write_text('active rules');result=plan(ROOT,s);item=next(x for x in result['files'] if x['path']=='AGENTS.md');self.assertEqual(item['status'],'collision_requires_review');self.assertEqual((s/'AGENTS.md').read_text(),'active rules')
 def test_reconcile_nested_inputs_rejected(self):
  with self.assertRaises(ValueError):plan(ROOT,ROOT/'docs')
 def test_generate_refuses_live_repo_sweep(self):
  r=self.temp();(r/'apps').mkdir()
  with self.assertRaises(ValueError):views(r)
 def test_product_requirements_all_have_missions(self):
  trace=read_json(ROOT,'governance/REQUIREMENT_TRACE.json');self.assertTrue(trace['entries']);self.assertTrue(all(x['missions'] for x in trace['entries']))
 def test_generated_views_match_registry(self):
  for p,text in views(ROOT).items():
   with self.subTest(path=p):self.assertEqual((ROOT/p).read_text(),text)
 def test_mission_runner_unknown_mission_denied(self):
  out=self.temp()/'ctx'
  with self.assertRaises(ValueError):prepare(ROOT,ROOT/'governance/MISSION_POLICY.json',ROOT/'governance/ROADMAP.json','J5-M99','audit',out)
 def test_mission_runner_implementation_without_repo_denied(self):
  with self.assertRaises(ValueError):prepare(ROOT,ROOT/'governance/MISSION_POLICY.json',ROOT/'governance/ROADMAP.json','J5-M02','implementation',self.temp()/'ctx')
 def test_mission_runner_sanitized_audit_exports_only_context(self):
  scratch=self.temp();receipts=scratch/'receipts.json';receipts.write_text('[]');result=prepare(ROOT,ROOT/'governance/MISSION_POLICY.json',receipts,'J5-M00','audit',scratch/'ctx');self.assertFalse(result['missionExecuted']);self.assertTrue((scratch/'ctx/ADMISSION.json').exists())
 def test_mission_runner_refuses_output_inside_source(self):
  scratch=self.temp();receipts=scratch/'receipts.json';receipts.write_text('[]')
  with self.assertRaises(ValueError):prepare(ROOT,ROOT/'governance/MISSION_POLICY.json',receipts,'J5-M00','audit',ROOT/'generated/not-allowed')
 def test_state_boolean_version_denied(self):
  s=self.state();s['stateVersion']=True
  with self.assertRaises(ValueError):state_validate(s)
 def test_time_boolean_epoch_denied(self):
  with self.assertRaises(ValueError):self.times(source='trusted_verifier',expected_epoch=True,current_epoch=1)
