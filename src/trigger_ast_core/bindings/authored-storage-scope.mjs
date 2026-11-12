import {AsyncLocalStorage} from 'node:async_hooks';
const scope=new AsyncLocalStorage();
export function withAuthoredStorageScope(context,operation){return scope.run(context,operation);}
export function currentAuthoredStorageScope(){const context=scope.getStore();return context?.active?context:undefined;}
