import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {qualifyGuiIntrinsicStorageShape as qualify} from './gui-intrinsic-storage-shape.mjs';
const declaration=s=>parse(s,'shape.galaxy').statements[0];
const variable=(type,sizes)=>({variableType:{type},isArray:sizes.length>0,arraySizes:sizes.map((value,dim)=>({dim,value}))});
test('scalar and multidimensional fixed intrinsic types retain exact GUI axes',()=>{
  assert.equal(qualify(declaration('bool x;'),variable('bool',[])).rank,0);
  const proof=qualify(declaration('bool[11][3] x;'),variable('bool',['10','2']));
  assert.equal(proof.rank,2);assert.deepEqual(proof.extents,['11','3']);
});
test('wrong rank, axis, carrier or inclusive upper bound never qualifies',()=>{
  const d=declaration('bool[11][3] x;');
  for(const v of [variable('int',['10','2']),variable('bool',['10']),variable('bool',['11','2']),variable('bool',['2','10'])])assert.equal(qualify(d,v),undefined);
  const v=variable('bool',['10','2']);v.arraySizes[1].dim=0;assert.equal(qualify(d,v),undefined);
});
test('nominal, symbolic, reference and dynamic extents remain unproved',()=>{
  for(const text of ['Box[11] x;','bool[N] x;','bool[0] x;'])assert.equal(qualify(declaration(text),variable('bool',['10'])),undefined);
  const v=variable('bool',['10']);v.arraySizes[0].variable={type:'Variable',library:'Map',id:'X'};
  assert.equal(qualify(declaration('bool[11] x;'),v),undefined);
  const ref=variable('bool',['10']);ref.isReference=true;assert.equal(qualify(declaration('bool[11] x;'),ref),undefined);
});
