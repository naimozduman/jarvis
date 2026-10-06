import json,unittest,copy
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker
from referencing import Registry,Resource
ROOT=Path(__file__).resolve().parents[3]
REG=json.loads((ROOT/'governance/SCHEMA_REGISTRY.json').read_text())
SCHEMAS={x['contractId']:json.loads((ROOT/x['path']).read_text()) for x in REG['contracts']}
RES=Registry().with_resources([(s['$id'],Resource.from_contents(s)) for s in SCHEMAS.values()])
class Schemas(unittest.TestCase):pass

def validator(name):return Draft202012Validator(SCHEMAS['jarvis.'+name],registry=RES,format_checker=FormatChecker())
def fixture(name):return json.loads((ROOT/'tests/contracts/fixtures'/f'{name}.valid.json').read_text())
for item in REG['contracts']:
 name=item['contractId'].removeprefix('jarvis.')
 def positive(self,name=name):
  Draft202012Validator.check_schema(SCHEMAS['jarvis.'+name]);validator(name).validate(fixture(name))
 def negative(self,name=name):
  x=json.loads((ROOT/'tests/contracts/fixtures'/f'{name}.invalid.json').read_text());self.assertTrue(list(validator(name).iter_errors(x)))
 setattr(Schemas,'test_valid_'+name.replace('-','_'),positive);setattr(Schemas,'test_invalid_extra_'+name.replace('-','_'),negative)
 # Every required top-level field is mechanically exercised, not only the happy path.
 for field in SCHEMAS[item['contractId']].get('required',[]):
  def missing(self,name=name,field=field):
   x=fixture(name);del x[field];self.assertTrue(list(validator(name).iter_errors(x)))
  setattr(Schemas,'test_required_'+name.replace('-','_')+'_'+field,missing)
def no_owner(self):
 x=fixture('action-intent');x['ownerId']='00000000-0000-4000-8000-000000000001';self.assertTrue(list(validator('action-intent').iter_errors(x)))
Schemas.test_model_cannot_supply_owner=no_owner
def no_approval(self):
 x=fixture('action-intent');x['approvalId']='00000000-0000-4000-8000-000000000001';self.assertTrue(list(validator('action-intent').iter_errors(x)))
Schemas.test_model_cannot_supply_approval=no_approval
def no_expiry(self):
 x=fixture('authority-lease');x['expiresAt']=None;self.assertTrue(list(validator('authority-lease').iter_errors(x)))
Schemas.test_null_lease_expiry_rejected=no_expiry
if __name__=='__main__':unittest.main()
