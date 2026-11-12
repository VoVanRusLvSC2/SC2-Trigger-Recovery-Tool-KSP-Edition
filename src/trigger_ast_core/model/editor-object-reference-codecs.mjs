// Closed SC2 document-value grammar, shared by both conversion directions.
// These constructors select preplaced objects; arbitrary handle-returning calls
// must remain expressions and must never be inferred from their return type.
const constructors=Object.freeze({
 point:'PointFromId',region:'RegionFromId',unit:'UnitFromId',
 unitgroup:'UnitGroupFromId',camerainfo:'CameraInfoFromId',doodad:'DoodadFromId'
});
const types=Object.freeze(Object.keys(constructors));
const byConstructor=new Map(types.map(type=>[constructors[type],type]));
export const editorObjectReferenceTypes=types;
export const editorObjectConstructor=type=>Object.hasOwn(constructors,type)?constructors[type]:undefined;
export const editorObjectType=name=>byConstructor.get(name);
