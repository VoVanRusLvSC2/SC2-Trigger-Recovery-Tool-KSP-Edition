// Public modular entrypoint. The qualified strict engine stays immutable.
import * as engine from '../../map_global_repair_v177_object_parameter_reification_2026-10-19/a504dda62d18-b679bb58b66c-e9794be60be8-83669c0005cd-index.standard-getter-overlay.mjs';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {createSourceAwareConversion} from './source-aware-conversion.mjs';

const converter = createSourceAwareConversion(engine, xmlTree);
export const convertGalaxyToTriggers = converter.convertGalaxyToTriggers;
export const convertTriggersToGalaxy = converter.convertTriggersToGalaxy;
