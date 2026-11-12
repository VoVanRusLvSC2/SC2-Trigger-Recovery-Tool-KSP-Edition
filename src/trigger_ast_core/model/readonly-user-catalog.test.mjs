import test from 'node:test';import assert from 'node:assert/strict';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readReadonlyUserCatalog,createReadonlyUserStringResolver} from './readonly-user-catalog.mjs';
const header='const int c_gameCatalogUser=9; native string UserDataGetString(string t,string i,string f,int n);';
const source=header+'void run(){string a; a=UserDataGetString("Commands","Anything","Callback",1);}';
const catalog='<Catalog><CUser id="Commands"><Fields Id="Callback" Type="String"/><Instances Id="A"><String String="SafeCallback"><Field Id="Callback"/></String></Instances></CUser></Catalog>';
async function context(files){const table=new Map(Object.entries(files));return readReadonlyUserCatalog({layers:[{id:'0',sourcePath:'fixture',role:'primary'}],unresolved:[],files:async()=>({items:[...table.keys()]}),read:async(_,name)=>Buffer.from(table.get(name))});}
async function resolve(xml=catalog,galaxy=source,files={}){
 const cap=await context({'base.sc2data/gamedata/userdata.xml':xml,...files}),ast=new Parser().parseFile('fixture.galaxy',galaxy);
 const resolver=createReadonlyUserStringResolver([ast],cap);let call,owner;
 const visit=(n,f)=>{if(n.kind===K.FunctionDeclaration)f=n;if(n.kind===K.CallExpression&&n.expression.name==='UserDataGetString'){call=n;owner=f;}forEachChild(n,c=>visit(c,f));};visit(ast);
 return {values:resolver.read(call,owner),proof:resolver.proof};
}
test('All instances and absent values form a finite overapproximation',async()=>{
 const r=await resolve();assert.deepEqual(r.values,['','SafeCallback']);assert.equal(r.proof.queries[0].allInstancesAndIndicesIncluded,true);
});
test('Mutable fields, inherited definitions and overrides remain refusals',async()=>{
 await assert.rejects(resolve(catalog.replace('<Fields Id="Callback" Type="String"/>','<Fields Id="Callback" Type="String"><Flags index="Modifiable" value="1"/></Fields>')),/MODIFIABLE/);
 await assert.rejects(resolve(catalog.replace('id="Commands"','id="Commands" parent="Parent"')),/INHERITANCE/);
 await assert.rejects(resolve(catalog,source,{'base.sc2data/gamedata.xml':'<Includes><Catalog path="GameData/extra.xml"/></Includes>','base.sc2data/gamedata/extra.xml':catalog}),/TYPE_MERGE/);
});
test('Unknown writes and catalog writes invalidate the field model',async()=>{
 await assert.rejects(resolve(catalog,source+'void f(){UserDataLoadType("Commands",null,"S");}'),/WRITER_NATIVE_ABI/);
 await assert.rejects(resolve(catalog,source+'native bool CatalogFieldValueSet(int c,string e,string f,int p,string v); void f(){CatalogFieldValueSet(9,"Commands","Fields",1,"X");}'),/MAY_BE_WRITTEN/);
 await assert.rejects(resolve(catalog,source+'void f(){UserDataUnexpectedMutation();}'),/API_EFFECT_UNCLASSIFIED/);
});
test('Declared stock writers cannot bypass the immutable-field flag',async()=>{
 const write='native void UserDataSetString(string t,string i,string f,int n,string v); void change(){UserDataSetString("Commands","A","Callback",1,"Different");}';
 const r=await resolve(catalog,source+write);assert.deepEqual(r.values,['','SafeCallback']);assert.equal(r.proof.protectedWriterSites.length,1);
 await assert.rejects(resolve(catalog.replace('<Fields Id="Callback" Type="String"/>','<Fields Id="Callback" Type="String"><Flags index="Modifiable" value="1"/></Fields>'),source+write),/MODIFIABLE/);
});
test('Escaped data-side catalog references and UserData effects cannot be ignored',async()=>{
 await assert.rejects(resolve(catalog,source,{'base.sc2data/gamedata/effectdata.xml':'<Catalog><CEffectSet id="E"><Reference value="User&#44;Commands&#44;Fields"/></CEffectSet></Catalog>'}),/DATA_SIDE_WRITER/);
 await assert.rejects(resolve(catalog,source,{'base.sc2data/gamedata/effectdata.xml':'<Catalog><CEffectUserData id="E"/></Catalog>'}),/DATA_SIDE_WRITER/);
});
test('A caller cannot supply unbound catalog values or a shadowed getter',async()=>{
 assert.throws(()=>createReadonlyUserStringResolver([],{}),/UNTRUSTED_CAPABILITY/);
 await assert.rejects(resolve(catalog,source.replace('string a;','string a;int UserDataGetString;')),/SHADOWED/);
});
test('Uninstantiated class defaults cannot execute, but their references remain checked',async()=>{
 assert.deepEqual((await resolve(catalog,source,{'base.sc2data/gamedata/effectdata.xml':'<Catalog><CEffectUserData default="1"><Amount value="1"/></CEffectUserData></Catalog>'})).values,['','SafeCallback']);
 await assert.rejects(resolve(catalog,source,{'base.sc2data/gamedata/effectdata.xml':'<Catalog><CEffectUserData default="1"><Reference value="User,Commands,Fields"/></CEffectUserData></Catalog>'}),/DATA_SIDE_WRITER/);
});
