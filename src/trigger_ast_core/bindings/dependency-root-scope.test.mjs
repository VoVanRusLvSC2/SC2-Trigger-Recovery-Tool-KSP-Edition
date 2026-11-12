import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isEmptyDependencyRoot} from './dependency-root-scope.mjs';
import {readOwnedGuiLibraries} from '../../map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/bfa5ccb94e8b-ec1a7bd2ecbf-e3b55d182995-0511d3687a2c-read-owned-gui-libraries.mjs';
test('empty local dependency roots do not claim exported Map ownership',()=>{
 const libs=readOwnedGuiLibraries('<TriggerData><Root/><Library Id="Test"><Root/><Element Type="FunctionDef" Id="A"><Identifier>Run</Identifier></Element></Library></TriggerData>');
 assert.equal(isEmptyDependencyRoot('Map',libs.get('Map')),true);
 assert.equal(isEmptyDependencyRoot('Test',libs.get('Test')),false);
 assert.equal(Object.values(libs.get('Test').elements).find(e=>e.type==='FunctionDef'&&e.id==='A').identifier,'Run');
});
test('populated or explicit Map scopes cannot disappear',()=>{
 const empty={id:'Map',implicit:true,elements:{},elementsByType:{},items:[],rootRefs:[]};
 for(const change of [{implicit:false},{elements:{A:{}}},{elementsByType:{FunctionDef:{A:{}}}},{items:[{}]},{rootRefs:[{}]}])assert.equal(isEmptyDependencyRoot('Map',{...empty,...change}),false);
 assert.equal(isEmptyDependencyRoot('Other',empty),false);
});
