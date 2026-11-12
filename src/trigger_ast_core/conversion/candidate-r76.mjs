// Experimental aggregate ownership projection. CURRENT remains unchanged.
import * as engine from './candidate-r75.mjs';
import {createOwnedAggregateConversion} from './owned-aggregate-conversion.mjs';
const conversion=createOwnedAggregateConversion(engine);
export const convertGalaxyToTriggers=conversion.convertGalaxyToTriggers;
export const convertTriggersToGalaxy=conversion.convertTriggersToGalaxy;
export const createTriggerConversionContext=engine.createTriggerConversionContext;
export const triggerConversionBounds=engine.triggerConversionBounds;
