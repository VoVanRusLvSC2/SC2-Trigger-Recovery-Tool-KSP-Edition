"""Verify the public source snapshot, not runtime or map equivalence."""
from pathlib import Path
from collections import Counter
import hashlib,json,re

R=Path(__file__).resolve().parent.parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
snapshot=load(R/'validation/publication-manifest.json')
for row in snapshot['files']:
 p=(R/row['path']).resolve();assert p.is_relative_to(R)
 assert p.is_file(),row['path'];assert sha(p.read_bytes())==row['sha256'],row['path']
rows=load(R/'maps/status-339.json')['rows'];assert len(rows)==len({x['id']for x in rows})==339
assert dict(Counter(x['recordedStatus']for x in rows))=={'HISTORICAL_REGISTRY_ACCEPTED':222,'RECORDED_ROOT_PASS':103,'REVIEW':12,'UNCONFIRMED':1,'SKIP':1}
for name,state,count in [('confirmed-103.md','RECORDED_ROOT_PASS',103),('historical-222.md','HISTORICAL_REGISTRY_ACCEPTED',222)]:
 text=(R/'maps'/name).read_text(encoding='utf-8');selected=[x for x in rows if x['recordedStatus']==state];assert len(selected)==count
 for row in selected:assert '| '+row['id']+' |'in text and row['originalSha256']in text
base=R/'benchmark/oracle';raw=(base/'MANIFEST.json').read_bytes()
assert sha(raw)=='94d0ee8f5a7ff489e1d161134a6a93f73c68669d00ce7f4bca2bc66f24649166'
oracle=load(base/'MANIFEST.json');assert len(oracle['files'])==304
for row in oracle['files']:assert sha((base/row['path']).read_bytes())==row['sha256'],row['path']
for doc in R.rglob('*.md'):
 if doc.relative_to(R).parts[0]in ['src','benchmark','licenses']:continue
 for target in re.findall(r'\]\(([^)]+)\)',doc.read_text(encoding='utf-8')):
  if target.startswith(('https://','http://','#')):continue
  assert(doc.parent/target.split('#',1)[0]).exists(),(str(doc.relative_to(R)),target)
for row in snapshot['files']:
 n=row['path'].lower();assert not n.endswith(('.sc2map','.sc2mod','.exe','.dll','.log','.pyc','.pem','.key'))
 assert Path(n).name not in ['native-api.generated.js','galaxy-script-api.v1.json']
status=load(R/'validation/status.json');assert status['standaloneRuntimeReady']is False and status['newEditorRuns']==status['newMapPasses']==0
print('Publication integrity OK: 339 map records, 103 strict recorded + 222 historical; 304 unchanged oracle files.')
print('This check is not Editor compilation, runtime readiness, or a new map PASS.')
