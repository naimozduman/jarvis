import copy,importlib.util,json,sys,tempfile,unittest,shutil,subprocess
from pathlib import Path
from datetime import datetime,timezone
TOOLS=Path(__file__).resolve().parents[1];sys.path.insert(0,str(TOOLS));ROOT=TOOLS.parents[1]
from common import frontmatter,read_json,safe_path,sha
from compile_prompts import compile_all
from impact import evaluate
from review_evidence import check
from git_snapshot import snapshot
from env_report import inventory
spec=importlib.util.spec_from_file_location('v4_index',TOOLS/'index.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class PackTools(unittest.TestCase):
 def temp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);return Path(t.name)
 def test_metadata_parses(self):
  f,b=frontmatter((ROOT/'AGENTS.md').read_text());self.assertTrue(f['title']);self.assertIn('JARVIS',b)
 def test_indented_metadata_rejected(self):
  with self.assertRaises(ValueError):frontmatter('    ---\nname: "x"\n    ---\n')
 def test_duplicate_metadata_rejected(self):
  with self.assertRaises(ValueError):frontmatter('---\nname: "x"\nname: "y"\n---\n')
 def test_non_json_flat_yaml_rejected(self):
  with self.assertRaises(ValueError):frontmatter('---\nname: unquoted\n---\n')
 def test_duplicate_json_rejected(self):
  r=self.temp();(r/'x.json').write_text('{"a":1,"a":2}')
  with self.assertRaises(ValueError):read_json(r,'x.json')
 def test_path_traversal_rejected(self):
  with self.assertRaises(ValueError):safe_path(ROOT,'../outside')
 def test_symlink_rejected(self):
  r=self.temp();(r/'s').symlink_to(ROOT/'AGENTS.md')
  with self.assertRaises(ValueError):safe_path(r,'s')
 def prompt_root(self):
  r=self.temp();shutil.copytree(ROOT/'governance',r/'governance');shutil.copytree(ROOT/'prompts/runtime',r/'prompts/runtime');return r
 def test_prompt_assemblies_deterministic(self):self.assertEqual(compile_all(ROOT),compile_all(ROOT))
 def test_prompt_tamper_detected(self):
  r=self.prompt_root();p=r/'prompts/runtime/modules/core-system.md';p.write_text(p.read_text()+'tamper')
  with self.assertRaises(ValueError):compile_all(r)
 def test_unknown_invariant_detected(self):
  r=self.prompt_root();p=r/'governance/PROMPT_REGISTRY.json';j=json.loads(p.read_text());j['modules'][0]['invariants'].append('missing');p.write_text(json.dumps(j))
  with self.assertRaises((ValueError,KeyError)):compile_all(r)
 def test_prompt_limit_detected(self):
  r=self.prompt_root();p=r/'governance/PROMPT_REGISTRY.json';j=json.loads(p.read_text());j['assemblies'][0]['maxUtf8Bytes']=1;p.write_text(json.dumps(j))
  with self.assertRaises(ValueError):compile_all(r)
 def map(self):return {'sourceRoots':['src/**'],'areas':[{'id':'a','codePatterns':['src/a/**'],'owningDocs':['docs/A.md'],'testPatterns':['tests/a/**']}]}
 def receipt(self):return {'schemaVersion':1,'baseSha':'a'*40,'headSha':'b'*40,'areas':[{'id':'a','docsUpdated':[],'noContractImpactReason':'Pure refactoring with unchanged behavior and contracts.','testEvidence':[{'headSha':'b'*40,'runRef':'synthetic-test-run','testPaths':['tests/a/example.test.ts']}]}]}
 def test_impact_valid(self):self.assertTrue(evaluate(['src/a/foo.ts'],self.map(),self.receipt(),'a'*40,'b'*40)['passed'])
 def test_impact_missing(self):self.assertFalse(evaluate(['src/a/foo.ts'],self.map(),{'areas':[]},'a'*40,'b'*40)['passed'])
 def test_impact_wrong_head(self):
  j=self.receipt();j['headSha']='c'*40;self.assertFalse(evaluate(['src/a/foo.ts'],self.map(),j,'a'*40,'b'*40)['passed'])
 def test_impact_unknown_code(self):self.assertFalse(evaluate(['src/b/new.ts'],self.map(),self.receipt(),'a'*40,'b'*40)['passed'])
 def test_impact_fake_doc_touch(self):
  j=self.receipt();j['areas'][0]['docsUpdated']=['docs/A.md'];self.assertFalse(evaluate(['src/a/foo.ts'],self.map(),j,'a'*40,'b'*40)['passed'])
 def test_unknown_observation_blocks(self):self.assertFalse(check(ROOT,datetime(2026,9,25,12,tzinfo=timezone.utc),['vercel-unknown'])['passed'])
 def test_old_observation_blocks(self):self.assertFalse(check(ROOT,datetime(2026,10,25,12,tzinfo=timezone.utc),['git-main-20260925'])['passed'])
 def test_unrequired_unknown_is_warning(self):self.assertTrue(check(ROOT,datetime(2026,9,25,12,tzinfo=timezone.utc))['passed'])
 def test_resolved_incident_needs_regression(self):
  r=self.temp();shutil.copytree(ROOT/'governance',r/'governance');p=r/'governance/incidents';p.mkdir(exist_ok=True);(p/'x.json').write_text('{"status":"resolved"}');self.assertFalse(check(r,datetime(2026,9,25,12,tzinfo=timezone.utc))['passed'])
 def test_live_repo_index_sweep_refused(self):
  r=self.temp();(r/'apps').mkdir()
  with self.assertRaises(ValueError):mod.refresh(r)
 def test_env_inventory_not_secret_values(self):
  r=self.temp();(r/'apps').mkdir();(r/'apps/a.ts').write_text('process.env.MISSING_KEY');(r/'.env.example').write_text('KNOWN=\n');j=inventory(r);self.assertEqual(j['missingFromExample'],['MISSING_KEY']);self.assertNotIn('KNOWN=',str(j))
 def test_no_machine_config_replacements(self):
  for n in ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','.env.example','docker-compose.local.yml']:self.assertFalse((ROOT/n).exists())
 def test_all_agent_names_match_registry(self):
  import tomllib
  j=read_json(ROOT,'governance/AGENT_REGISTRY.json')
  for a in j['agents']:self.assertEqual(tomllib.loads((ROOT/a['path']).read_text())['name'],a['name'])
 def test_reference_archives_match_source_hashes(self):
  j=read_json(ROOT,'governance/SOURCE_ARCHIVE.json')
  for row in j['files']:self.assertEqual(sha((ROOT/row['path']).read_bytes()),row['sha256'])
 def test_same_versions_unchanged_pass(self):
  from version_gate import compare
  self.assertTrue(compare(ROOT,ROOT)['passed'])
 def test_versioned_prompt_requires_bump(self):
  from version_gate import compare
  r=self.prompt_root();shutil.copytree(ROOT/'schemas',r/'schemas');p=r/'prompts/runtime/modules/core-system.md';p.write_text(p.read_text()+'\nchanged\n')
  self.assertFalse(compare(ROOT,r)['passed'])
 def gitrepo(self):
  r=self.temp();subprocess.run(['git','init','-q',str(r)],check=True);subprocess.run(['git','config','user.name','test'],cwd=r,check=True);subprocess.run(['git','config','user.email','test@example.invalid'],cwd=r,check=True);return r
 def commit(self,r):
  subprocess.run(['git','add','-A'],cwd=r,check=True);subprocess.run(['git','commit','-qm','fixture'],cwd=r,check=True);return subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()
 def test_snapshot_ignores_export_ignore(self):
  r=self.gitrepo();(r/'.gitattributes').write_text('important.md export-ignore\n');(r/'important.md').write_text('keep');head=self.commit(r);out=r.parent/(r.name+'-snapshot')
  self.addCleanup(lambda: shutil.rmtree(out,ignore_errors=True));snapshot(r,head,out);self.assertEqual((out/'important.md').read_text(),'keep')
 def test_snapshot_rejects_symlink(self):
  r=self.gitrepo();(r/'link').symlink_to('/tmp/forbidden');head=self.commit(r);out=r/'out'
  with self.assertRaises(ValueError):snapshot(r,head,out)
 def test_snapshot_never_runs_candidate(self):
  r=self.gitrepo();(r/'evil.py').write_text('raise RuntimeError("executed")');head=self.commit(r);out=r/'inert';j=snapshot(r,head,out);self.assertFalse(j['candidateExecuted']);self.assertTrue((out/'evil.py').exists())
