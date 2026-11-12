import assert from 'node:assert/strict';
import {templateParameters,templateMacros} from '../../map_global_repair_v195_authored_source_sections_2026-10-20/graph/e61ec7b358d47fee-script-template.mjs';

// A read-only verification view. Localized display names are not macro names:
// use the actual template resolver and keep each Library/Type/Id unchanged.
export function authoredSectionCallIdentityView(libraries) {
  const view=new Map(),decisions=[];
  for(const [id,library]of libraries) {
    const elements={...library.elements},renames=new Map();
    for(const fn of Object.values(elements).filter(e=>e.type==='FunctionDef'&&e.flags?.includes('Inline')&&e.flags.includes('NoScriptPrefix')&&e.scriptCode)) {
      const names=templateMacros(fn.scriptCode).filter(m=>m.name==='PARAM').map(m=>m.args[0]);
      const bindings=templateParameters(fn,[...libraries.values()]);
      for(const ref of fn.parameters??[]) {
        const owner=ref.library??id;assert.equal(owner,id,'AUTHORED_INTERFACE_FOREIGN_FORMAL');
        const matches=[...new Set(names)].filter(name=>{
          const bound=bindings.get(name);return bound?.id===ref.id&&bound.type==='ParamDef'&&(bound.library??id)===owner;
        });
        assert.equal(matches.length,1,'AUTHORED_INTERFACE_MACRO_FORMAL_NOT_UNIQUE');
        const token=matches[0],key=`ParamDef:${ref.id}`,p=elements[key];
        assert(p?.type==='ParamDef'&&p.library===owner,'AUTHORED_INTERFACE_FORMAL_GRAPH');
        assert(!renames.has(key)||renames.get(key)===token,'AUTHORED_INTERFACE_SHARED_FORMAL_NAME_CONFLICT');
        renames.set(key,token);
        elements[key]={...p,name:token,identifier:token};
        if(p.name!==token)decisions.push({library:id,type:'ParamDef',id:p.id,displayName:p.name,macroName:token,definitionId:fn.id});
      }
    }
    view.set(id,{...library,elements});
  }
  return {libraries:view,decisions,xmlChanged:false,typedIdentitiesChanged:false};
}
