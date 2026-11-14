import assert from 'node:assert/strict';
import { createGuiCallTypeResolver } from '../src/conversion/qualified-gui-game-link-calls/gui-call-contract.mjs';
const ref = (type, id, library = 'Ntve') => ({ type, id, library });
const values = new Map();
const put = (x) => (values.set(`${x.library}:${x.type}:${x.id}`, x), ref(x.type, x.id, x.library));
const normal = put({ type: 'ParamDef', id: 'normal', library: 'Ntve', paramType: { type: 'int' } });
const many = put({
  type: 'ParamDef',
  id: 'many',
  library: 'Ntve',
  paramType: { type: 'int' },
  isMultiple: true,
});
const def = put({
  type: 'FunctionDef',
  id: 'f',
  library: 'Ntve',
  returnType: { type: 'int' },
  parameters: [normal, many],
});
const p = (id, parameterDef, valueType = 'int') =>
  put({ type: 'Param', id, library: 'Map', parameterDef, valueType: { type: valueType } });
const args = [p('a', normal), p('b', many), p('c', many), p('d', many)];
const call = put({
  type: 'FunctionCall',
  id: 'c',
  library: 'Map',
  functionDef: def,
  parameters: args,
});
const resolver = createGuiCallTypeResolver({
  resolve: (r, owner) => values.get(`${r.library ?? owner}:${r.type}:${r.id}`),
  key: (r, owner) => `${r.library ?? owner}:${r.type}:${r.id}`,
  argumentType: (x) => x.valueType?.type,
  declared: (_p, type) => type,
});
assert.equal(resolver({ functionCall: call }, 'Map', new Set()), 'int');
const c = values.get('Map:FunctionCall:c');
c.parameters = [args[0], args[1], p('wrong', normal)];
assert.equal(
  resolver({ functionCall: call }, 'Map', new Set()),
  undefined,
  'wrong repeated formal must fail',
);
c.parameters = [args[0]];
assert.equal(
  resolver({ functionCall: call }, 'Map', new Set()),
  undefined,
  'missing repeated value must fail',
);
c.parameters = args;
values.get('Ntve:ParamDef:many').isMultiple = false;
assert.equal(
  resolver({ functionCall: call }, 'Map', new Set()),
  undefined,
  'ordinary formal must not become variadic',
);
console.log('Variadic GUI contract: valid repeated arguments accepted, invalid graphs rejected.');
