import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectNativeScriptCodeFraming as inspect} from './native-script-code-framing.mjs';
const doc=body=>'<TriggerData><Element Type="CustomScript" Id="12345678">'+body+'</Element></TriggerData>';
test('stock envelope preserves source indentation, entities, Unicode and CRLF',()=>{
 const xml=doc('<ScriptCode>\r\n          if (x &lt; 2) {\r\n            value = "текст";\r\n          }\r\n      </ScriptCode>');
 assert(inspect(xml).passed);
});
test('the observed eight-space envelope is refused before a token can be cut',()=>{
 const r=inspect(doc('<ScriptCode>\n        include "Phases"\n      </ScriptCode>'));
 assert(!r.passed);assert.equal(r.issues[0].reason,'SCRIPT_CODE_PREFIX_CAN_TRUNCATE_TOKENS');assert.deepEqual(r.issues[0].lines,[1]);
});
test('single-line code is not treated as an equivalent empty field',()=>{
 const r=inspect(doc('<ScriptCode>Run();</ScriptCode>'));assert(!r.passed);assert.equal(r.frames[0].empty,false);
});
test('CDATA needs independent Native qualification rather than tolerant-parser acceptance',()=>{
 const r=inspect(doc('<ScriptCode><![CDATA[Run();]]></ScriptCode>'));assert(!r.passed);assert.equal(r.issues[0].reason,'NON_STOCK_CODE_TEXT_ENVELOPE');
});
test('an empty or omitted field remains empty without invented execution',()=>{
 assert(inspect(doc('<ScriptCode/>')).passed);assert(inspect(doc('<ScriptCode>  </ScriptCode>')).passed);assert.equal(inspect(doc('')).activeCodeFields,0);
});
test('disabled code cannot create a transport failure for active output',()=>{
 const r=inspect(doc('<Disabled/><ScriptCode>not active</ScriptCode>'));assert(r.passed);assert.equal(r.activeCodeFields,0);
});
test('library/type/id are retained for exact diagnostic ownership',()=>{
 const xml='<TriggerData><Library Id="External"><Element Type="FunctionDef" Id="12345678"><ScriptCode>Run();</ScriptCode></Element></Library></TriggerData>';
 assert.deepEqual(inspect(xml).issues[0].element,{library:'External',type:'FunctionDef',id:'12345678'});
});
test('one correctly framed field cannot hide another malformed field',()=>{
 const xml='<TriggerData><Element Type="FunctionDef" Id="11111111"><ScriptCode>\n          Run();\n      </ScriptCode></Element><Element Type="CustomScript" Id="22222222"><ScriptCode>Run();</ScriptCode></Element></TriggerData>';
 const r=inspect(xml);assert.equal(r.frames.length,2);assert.equal(r.issues.length,1);assert(!r.passed);assert.equal(r.issues[0].element.id,'22222222');
});
