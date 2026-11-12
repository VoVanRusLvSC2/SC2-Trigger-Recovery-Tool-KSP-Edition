"""Inventory recovered GUI artifacts. Does not replace native or Galaxy tests."""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as ET

def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def audit(job,mode):
 job=Path(job);result=json.loads((job/'RESULT.json').read_text(encoding='utf-8'));source=json.loads((job/'SOURCE_GUI_INPUT.json').read_text(encoding='utf-8'))
 variants=[v for v in result.get('variants',[]) if v['mode']==mode]
 if result.get('status')!='GENERATED' or len(variants)!=1:raise ValueError('GENERATED_VARIANT_REQUIRED')
 variant=variants[0];candidate=Path(variant['candidate']);assert sha(candidate)==variant['candidateSha256'],'CANDIDATE_SHA_MISMATCH'
 xml=job/mode/'components'/'Triggers';types={};native=[];custom=[];raw=[]
 for event,e in ET.iterparse(xml,events=('end',)):
  if e.tag!='Element':continue
  kind=e.get('Type');types[kind]=types.get(kind,0)+1
  if kind=='FunctionDef':
   name=e.findtext('Identifier');item={'id':e.get('Id'),'identifier':name}
   if e.find('FlagNative') is not None:native.append(item)
   if e.find('ScriptCode') is not None:raw.append(item)
  elif kind=='CustomScript':custom.append({'id':e.get('Id')})
  e.clear()
 original_gui_present=source.get('present');assert original_gui_present in (True,False),'SOURCE_GUI_BASELINE_UNKNOWN'
 reasons=[]
 if native:reasons.append('NEW_NATIVE_REQUIRES_GUI_ANALOG_OR_ORIGIN_PROOF' if not original_gui_present else 'NATIVE_ORIGIN_COMPARISON_REQUIRED')
 if custom or raw:reasons.append('CUSTOM_AND_SCRIPT_FIELDS_REQUIRE_SOURCE_ORIGIN_CHECK')
 return {'kind':'RECOVERED_GUI_QUALITY_GATE','mapId':result['id'],'mode':mode,'candidate':{'path':str(candidate),'sha256':sha(candidate)},
  'triggerXml':{'path':str(xml),'sha256':sha(xml)},'originalGuiPresent':original_gui_present,'counts':types,'nativeDefinitions':native,
  'customScripts':custom,'scriptCodeFunctions':raw,'state':'REVIEW' if reasons else 'GUI_INVENTORY_CLEAR','reasons':reasons,
  'requiresNativeEditorAndWholeProgramBenchmark':True,'wholeMapAccepted':False}

if __name__=='__main__':
 if len(sys.argv)!=4:raise SystemExit('usage: audit-generated-gui.py JOB MODE OUTPUT')
 result=audit(sys.argv[1],sys.argv[2]);out=Path(sys.argv[3]);
 with out.open('x',encoding='utf-8') as stream:json.dump(result,stream,ensure_ascii=False,indent=2);stream.write('\n')
 print(json.dumps({'mapId':result['mapId'],'state':result['state'],'native':len(result['nativeDefinitions']),'custom':len(result['customScripts']),'scriptFields':len(result['scriptCodeFunctions'])}))
