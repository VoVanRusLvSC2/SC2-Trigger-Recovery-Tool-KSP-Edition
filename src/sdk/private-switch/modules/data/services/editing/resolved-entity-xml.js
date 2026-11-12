const NAME = /^[A-Za-z_][\w.:-]*$/u;
const recordOf = value => typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
const escapeAttribute = value => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/"/gu, '&quot;');
function scalar(value, label) {
    if (typeof value === 'string' || typeof value === 'boolean')
        return String(value);
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    throw new TypeError(`${label} is not a finite SC2 catalog scalar`);
}
function renderElement(name, value, schema, indent, step, extraAttributes = []) {
    if (!NAME.test(name))
        throw new TypeError(`invalid SC2 catalog field name ${name}`);
    if (Array.isArray(value))
        throw new TypeError(`${name} requires its declared cardinality`);
    const nestedSchemas = new Map((schema.fields ?? []).map(field => [field.fieldId, field]));
    const attributes = [...extraAttributes];
    const children = [];
    const object = recordOf(value);
    if (object === undefined) {
        attributes.push(['value', scalar(value, name)]);
    }
    else {
        const handled = new Set();
        for (const nestedSchema of schema.fields ?? []) {
            if (!Object.hasOwn(object, nestedSchema.fieldId))
                continue;
            handled.add(nestedSchema.fieldId);
            const nestedValue = object[nestedSchema.fieldId];
            if (nestedSchema.cardinality === 'scalar' &&
                (typeof nestedValue === 'string' ||
                    typeof nestedValue === 'boolean' ||
                    (typeof nestedValue === 'number' && Number.isFinite(nestedValue)))) {
                attributes.push([nestedSchema.fieldId, scalar(nestedValue, `${name}.${nestedSchema.fieldId}`)]);
            }
            else {
                children.push(...renderField(nestedSchema, nestedValue, indent + step, step));
            }
        }
        for (const [key, attribute] of Object.entries(object)) {
            if (handled.has(key))
                continue;
            if (!NAME.test(key) || nestedSchemas.has(key)) {
                throw new TypeError(`${name}.${key} cannot be reconstructed as an SC2 attribute`);
            }
            attributes.push([key, scalar(attribute, `${name}.${key}`)]);
        }
    }
    const attrs = attributes.map(([key, item]) => ` ${key}="${escapeAttribute(item)}"`).join('');
    if (children.length === 0)
        return `${indent}<${name}${attrs}/>`;
    return `${indent}<${name}${attrs}>\n${children.join('\n')}\n${indent}</${name}>`;
}
function renderField(schema, value, indent, step) {
    if (schema.cardinality === 'indexed') {
        if (!Array.isArray(value))
            throw new TypeError(`${schema.fieldId} must be an indexed array`);
        const indexKey = schema.indexKey ?? 'index';
        if (!NAME.test(indexKey))
            throw new TypeError(`${schema.fieldId} has an invalid index key`);
        return value.flatMap((item, ordinal) => {
            const entry = recordOf(item);
            if (entry === undefined || !Object.hasOwn(entry, 'value')) {
                throw new TypeError(`${schema.fieldId}[${ordinal}] is not a resolved indexed entry`);
            }
            if (entry.removed === true)
                return [];
            const index = Object.hasOwn(entry, indexKey) ? entry[indexKey] : String(ordinal);
            return [
                renderElement(schema.fieldId, entry.value, schema, indent, step, [[indexKey, scalar(index, `${schema.fieldId}[${ordinal}].${indexKey}`)]]),
            ];
        });
    }
    if (schema.cardinality === 'append') {
        if (!Array.isArray(value))
            throw new TypeError(`${schema.fieldId} must be an append array`);
        return value.map(item => renderElement(schema.fieldId, item, schema, indent, step));
    }
    return [renderElement(schema.fieldId, value, schema, indent, step)];
}
/** Materialize one resolved entity without retaining a dependency on its original declaration. */
export function resolvedEntityDeclarationXml(entity, schema, options = {}) {
    if (!NAME.test(entity?.typeId ?? '') || typeof entity?.entityId !== 'string') {
        throw new TypeError('resolved SC2 entity identity is invalid');
    }
    const cloneEntityId = options.entityId ?? entity.entityId;
    if (typeof cloneEntityId !== 'string' || cloneEntityId.length === 0) {
        throw new TypeError('clone entity id must be non-empty');
    }
    if (schema?.typeId !== entity.typeId || !Array.isArray(schema.fields)) {
        throw new TypeError(`resolved schema for ${entity.typeId} is unavailable`);
    }
    const step = options.indentStep ?? '  ';
    const fieldsById = new Map(schema.fields.map(field => [field.fieldId, field]));
    const unknown = Object.keys(entity.fields).filter(fieldId => !fieldsById.has(fieldId));
    if (unknown.length > 0) {
        throw new TypeError(`resolved fields lack schema metadata: ${unknown.join(', ')}`);
    }
    const children = schema.fields.flatMap(field => Object.hasOwn(entity.fields, field.fieldId)
        ? renderField(field, entity.fields[field.fieldId], step, step)
        : []);
    const attributes = ` id="${escapeAttribute(cloneEntityId)}"`;
    return children.length === 0
        ? `<${entity.typeId}${attributes}/>`
        : `<${entity.typeId}${attributes}>\n${children.join('\n')}\n</${entity.typeId}>`;
}
//# sourceMappingURL=resolved-entity-xml.js.map