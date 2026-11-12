from pathlib import Path
import hashlib,importlib.util,json,tempfile,unittest
module_path=Path(__file__).with_name('audit-generated-gui.py');spec=importlib.util.spec_from_file_location('audit_generated_gui',module_path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class GuiGateTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=r'K:\SC2_MAP_Workspace\sc2_editor_C++\sdk_gui_closure_20261019');self.job=Path(self.tmp.name);self.mode='without-attribute-recovery';components=self.job/self.mode/'components';components.mkdir(parents=True)
  self.candidate=self.job/'candidate.SC2Map';self.candidate.write_bytes(b'archive');self.original_sha=hashlib.sha256(b'archive').hexdigest()
  self.result={'id':'test','status':'GENERATED','variants':[{'mode':self.mode,'candidate':str(self.candidate),'candidateSha256':self.original_sha}]};self.write(self.job/'RESULT.json',self.result);self.write(self.job/'SOURCE_GUI_INPUT.json',{'present':False})
 def tearDown(self):self.tmp.cleanup()
 def write(self,path,value):path.write_text(json.dumps(value),encoding='utf-8')
 def xml(self,body): (self.job/self.mode/'components'/'Triggers').write_text('<TriggerData>'+body+'</TriggerData>',encoding='utf-8')
 def test_no_native_or_script_is_inventory_clear(self):
  self.xml('<Element Type="Trigger" Id="a"/>');r=mod.audit(self.job,self.mode);self.assertEqual(r['state'],'GUI_INVENTORY_CLEAR');self.assertFalse(r['wholeMapAccepted'])
 def test_new_native_or_script_requires_review(self):
  self.xml('<Element Type="FunctionDef" Id="b"><Identifier>fn</Identifier><FlagNative/></Element><Element Type="CustomScript" Id="c"><ScriptCode>x</ScriptCode></Element>');r=mod.audit(self.job,self.mode);self.assertEqual(r['state'],'REVIEW');self.assertEqual(len(r['nativeDefinitions']),1);self.assertEqual(len(r['customScripts']),1);self.assertIn('NEW_NATIVE_REQUIRES_GUI_ANALOG_OR_ORIGIN_PROOF',r['reasons'])
 def test_existing_gui_native_is_not_called_new(self):
  self.write(self.job/'SOURCE_GUI_INPUT.json',{'present':True});self.xml('<Element Type="FunctionDef" Id="b"><FlagNative/></Element>');r=mod.audit(self.job,self.mode);self.assertIn('NATIVE_ORIGIN_COMPARISON_REQUIRED',r['reasons'])
 def test_wrong_candidate_hash_rejected(self):
  self.xml('');self.candidate.write_bytes(b'changed');
  with self.assertRaises(AssertionError):mod.audit(self.job,self.mode)

if __name__=='__main__':unittest.main()
