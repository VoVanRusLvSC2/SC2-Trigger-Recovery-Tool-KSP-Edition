import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileAuthoredTemplateBindings as reconcile} from './authored-template-bindings.capture-correspondence.mjs';
import {templateMacros} from '../../map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs';
const id='ABCDEF12';
const old={type:'FunctionDef',id:'OLD',identifier:'Legacy',flags:['Action','SubFunctions','AllowBreak'],parameters:[{type:'ParamDef',id:'PO'}],subFunctionTypes:[{type:'SubFuncType',id:'RO'}],scriptCode:'Enter(#PARAM(group));for(;!Done();Step()){#SUBFUNCS(actions);}Exit();'};
const current={...old,id:'NEW',identifier:'Current',parameters:[{type:'ParamDef',id:'PN'}],subFunctionTypes:[{type:'SubFuncType',id:'RN'}],scriptCode:'#AUTOVAR(g,int)=#PARAM(group);while(#AUTOVAR(g)>0){#SUBFUNCS(actions)}'};
const items=[old,current,{type:'ParamDef',id:'PO',identifier:'group',paramType:{type:'int'}},{type:'ParamDef',id:'PN',identifier:'group',paramType:{type:'int'}},
 {type:'SubFuncType',id:'RO',identifier:'actions',isAction:true},{type:'SubFuncType',id:'RN',identifier:'actions',isAction:true}];
const nativeLibrary={id:'Stock',elements:Object.fromEntries(items.map(e=>[e.id,e])),elementsByType:{FunctionDef:{OLD:old,NEW:current}}};
const xml=`<TriggerData><Root><Item Type="FunctionCall" Id="${id}"/></Root><Element Type="FunctionCall" Id="${id}"><FunctionDef Type="FunctionDef" Library="Stock" Id="NEW"/><Parameter Type="Param" Id="P"/><FunctionCall Type="FunctionCall" Id="BODY"/></Element><Element Type="Param" Id="P"><ParameterDef Type="ParamDef" Library="Stock" Id="PN"/><Value>5</Value></Element><Element Type="FunctionCall" Id="BODY"><SubFunctionType Type="SubFuncType" Library="Stock" Id="RN"/></Element></TriggerData>`;
const source=body=>`void F(){Enter(5);for(;!Done();Step()){${body}}Exit();}`;
const generated=body=>`void F(){int auto${id}_g;auto${id}_g=5;while(auto${id}_g>0){${body}}}`;
const owners=[{sourceFunction:'F',library:'Map',roots:[{type:'FunctionCall',id}]}];
const run=(a=source('Use();'),b=generated('Use();'),text=xml,os=owners)=>reconcile({xml:text,source:a,generated:b,nativeLibrary,owners:os,macros:templateMacros});
test('legacy templates without synthetic locals recover one exact GUI owner and preserve XML structure',()=>{
 const r=run();assert.equal(r.proof.records.length,1);assert(r.xml.includes('Library="Stock" Id="OLD"'));assert(r.xml.includes('Library="Stock" Id="PO"'));assert(r.xml.includes('Library="Stock" Id="RO"'));assert(r.proof.allOtherXmlBytesExactByInverse);assert.equal(r.proof.newNative,0);
});
test('different parameters, user effects, or ambiguous identical source regions cannot rebind',()=>{
 for(const [a,b]of [[source('UseOther();'),generated('Use();')],[source('Use();').replace('Enter(5)','Enter(6)'),generated('Use();')],
  [source('Use();').replace('Exit();','Exit();Enter(5);for(;!Done();Step()){Use();}Exit();'),generated('Use();')]])assert.equal(run(a,b).proof.records.length,0);
});
test('shared GUI ownership and incompatible parameter ABI retain original references',()=>{
 const shared=xml.replace('</Root>',`<Item Type="FunctionCall" Id="${id}"/></Root>`);
 assert.equal(run(source('Use();'),generated('Use();'),shared).proof.records.length,0);
 const def=nativeLibrary.elements.PO;nativeLibrary.elements.PO={...def,paramType:{type:'fixed'}};
 try{assert.equal(run().proof.records.length,0);}finally{nativeLibrary.elements.PO=def;}
});
test('equally shaped stock actions are disambiguated by the original scoped FunctionDef reference',()=>{
 const clone={...current,id:'OTHER'};nativeLibrary.elements.OTHER=clone;nativeLibrary.elementsByType.FunctionDef.OTHER=clone;
 try{assert.equal(run().proof.records.length,1);}finally{delete nativeLibrary.elements.OTHER;delete nativeLibrary.elementsByType.FunctionDef.OTHER;}
});
