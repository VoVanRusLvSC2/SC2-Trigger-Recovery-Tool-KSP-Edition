import { createSc2ModCodec } from '../../mod/src/codec.js';
export const abiVersion = 1;
export function createCodec(context) {
    return createSc2ModCodec(true, context);
}
