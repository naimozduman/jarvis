"""Reference expiry semantics only. This is not clock synchronization or database locking."""
from datetime import datetime,timezone,timedelta
import re

def instant(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})',value):raise ValueError('Timezone-aware timestamp required')
    dt=datetime.fromisoformat(value.replace('Z','+00:00'))
    if dt.tzinfo is None:raise ValueError('Timezone required')
    return dt.astimezone(timezone.utc)

def eligible(start,end,now,*,source,uncertainty_ms=0,max_duration_seconds=None,expected_epoch=0,current_epoch=0):
    if source not in {'database_after_lock','trusted_verifier'}:return {'allowed':False,'reason':'untrusted_clock'}
    if type(uncertainty_ms) is not int or uncertainty_ms<0:raise ValueError('Clock uncertainty must be a nonnegative integer')
    if any(type(x) is not int or x<0 for x in [expected_epoch,current_epoch]):raise ValueError('Invalid epoch type')
    if expected_epoch!=current_epoch:return {'allowed':False,'reason':'stale_epoch'}
    a,b,n=instant(start),instant(end),instant(now)
    if b<=a:raise ValueError('Reversed validity interval')
    if max_duration_seconds is not None and (type(max_duration_seconds) is not int or max_duration_seconds<1 or (b-a).total_seconds()>max_duration_seconds):return {'allowed':False,'reason':'duration_limit'}
    low=n-timedelta(milliseconds=uncertainty_ms);high=n+timedelta(milliseconds=uncertainty_ms)
    return {'allowed':a<=low and high<b,'reason':'within_trusted_window' if a<=low and high<b else 'outside_or_uncertain_window'}
