import sys,unittest,json,copy
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1];sys.path.insert(0,str(TOOLS));ROOT=TOOLS.parents[1]
from reference_controls import *

def fixture(name):return json.loads((ROOT/'tests/contracts/fixtures'/f'{name}.valid.json').read_text())
class Controls(unittest.TestCase):
 def setup_action(self,risk='HIGH_IMPACT'):
  a=fixture('proposed-action');a['risk']=risk;a['snapshotHash']=snapshot_hash(a)
  z=fixture('execution-authorization');z['risk']=risk;z['snapshotHash']=a['snapshotHash']
  p=fixture('approval-resolution');p['snapshotHash']=a['snapshotHash']
  return a,z,p
 def check(self,a,z,p,**kw):
  return validate_authorization(a,z,p,'2026-09-25T10:04:00Z',principal_owner=a['ownerId'],current_policy='fixture-policy-1',kill_epoch=0,**kw)
 def test_exact_approval(self):self.assertTrue(self.check(*self.setup_action()))
 def test_changed_payload(self):
  a,z,p=self.setup_action();a['arguments']['title']='changed'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_wrong_owner(self):
  a,z,p=self.setup_action();p['ownerId']='other'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_whatsapp_not_resolver(self):
  a,z,p=self.setup_action();p['trustedSurface']='whatsapp'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_old_step_up(self):
  a,z,p=self.setup_action();p['reauthenticatedAt']='2026-09-25T09:00:00Z'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_policy_changed(self):
  a,z,p=self.setup_action();z['policyVersion']='other'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_kill_epoch_changed(self):
  a,z,p=self.setup_action();z['killEpoch']=2
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_expired_authorization(self):
  a,z,p=self.setup_action();z['expiresAt']='2026-09-25T10:03:00Z'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_high_impact_not_lease(self):
  a,z,p=self.setup_action();z['authorityType']='lease'
  with self.assertRaises(Denied):self.check(a,z,p)
 def test_finance_prohibition(self):
  a,z,p=self.setup_action();a['actionType']='finance.transfer';a['snapshotHash']=snapshot_hash(a);z['snapshotHash']=p['snapshotHash']=a['snapshotHash']
  with self.assertRaises(Denied):self.check(a,z,p)
 def lease(self):
  l=fixture('authority-lease');l['status']='active';return l
 def check_lease(self,l):return validate_lease(l,'2026-09-25T10:02:00Z',owner=l['ownerId'],executor=l['executorId'],action_type='calendar.block.create',target='fixture-calendar',account='fixture-account',kill_epoch=0)
 def test_valid_lease(self):self.assertTrue(self.check_lease(self.lease()))
 def test_null_expiry(self):
  l=self.lease();l['expiresAt']=None
  with self.assertRaises(Denied):self.check_lease(l)
 def test_long_lease(self):
  l=self.lease();l['expiresAt']='2026-11-25T10:00:00Z';l['durationSeconds']=5270400
  with self.assertRaises(Denied):self.check_lease(l)
 def test_wildcard_lease(self):
  l=self.lease();l['scope']['targetRefs']=['*']
  with self.assertRaises(Denied):self.check_lease(l)
 def test_lease_uses(self):
  l=self.lease();l['usedCount']=3
  with self.assertRaises(Denied):self.check_lease(l)
 def test_night_episode(self):
  l=self.lease();l['context']='night_mode';l['sleepEpisodeRef']='sleep-1'
  with self.assertRaises(Denied):self.check_lease(l)
 def test_deterministic_ledger_key(self):self.assertEqual(derivation_key('a',['2','1'],'1'),derivation_key('a',['1','2'],'1'))
 def test_owner_changes_ledger_key(self):self.assertNotEqual(derivation_key('a',['1'],'1'),derivation_key('b',['1'],'1'))
 def test_correction_changes_ledger_key(self):self.assertNotEqual(derivation_key('a',['1:v1'],'1'),derivation_key('a',['1:v2'],'1'))
 def test_identity_reference_keyed(self):self.assertNotEqual(identity_reference(b'a'*32,'owner','+15555555555','1'),identity_reference(b'b'*32,'owner','+15555555555','1'))
 def test_identity_reference_scoped(self):self.assertNotEqual(identity_reference(b'a'*32,'a','+15555555555','1'),identity_reference(b'a'*32,'b','+15555555555','1'))
 def cost(self,**kw):
  a=dict(estimated=1,settled=1,reserved=1,job_used=0,job_reserved=0,monthly_limit=10,daily_used=1,daily_reserved=1,daily_limit=10,job_limit=10);a.update(kw);return admit_cost(**a)
 def test_budget_allowed(self):self.assertEqual(self.cost(),1)
 def test_budget_reserved_counts(self):
  with self.assertRaises(Denied):self.cost(reserved=10)
 def test_job_budget(self):
  with self.assertRaises(Denied):self.cost(job_reserved=10)
 def test_unknown_cost_blocks(self):
  with self.assertRaises(Denied):self.cost(unknown=True)
 def test_stuck_blocks(self):
  with self.assertRaises(Denied):self.cost(stuck=True)
 def test_no_float_money(self):
  with self.assertRaises(Denied):self.cost(estimated=0.1)
 def test_cancel_pre_dispatch(self):self.assertEqual(cancellation_state('reserved'),'cancelled')
 def test_cancel_post_dispatch(self):self.assertEqual(cancellation_state('dispatch_started'),'reconciliation_required')
 def test_cancel_does_not_erase_verified(self):self.assertEqual(cancellation_state('verified'),'verified')
 def test_float_snapshot_rejected(self):
  with self.assertRaises(Denied):canonical({'dollars':1.5})
if __name__=='__main__':unittest.main()
