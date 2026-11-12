/**
 * Catalog entities as subjects of their own: the facts a card shows and the selector that lends
 * them from an open document.
 *
 * What goes on a card is the ported wiki assembler's knowledge (`wiki/cards.ts`: resolved names,
 * vitals, costs, weapons with their damage and DPS, the icon and model an entity is drawn with).
 * This file only restates an `EntityCard` in the shape every host already renders — groups of
 * facts, a `stats` group for the header, one relation per linked entity — so the card stays
 * generic and a GameData file and a whole mod lend entities the same way.
 *
 * Locales: the assembler resolves text for one locale at a time, so a card is built once per
 * locale the source has and the localized facts carry their locale. The host shows one and offers
 * the rest as a switch.
 */
import { createSubjectFactsSource, pageOf, parseSubjectId, provenanceOf, subjectIdFor, } from '@modkit/codec-kit';
import { operationId } from '@modkit/core';
export const ENTITY_SUBJECT_SCOPE = 'blizzard/sc2-data';
export function entitySubjectId(namespace, id) {
    return subjectIdFor(ENTITY_SUBJECT_SCOPE, [namespace, id]);
}
/** `enus` → `enUS`: the assembler keys locales in lower case, a reader expects the FourCC. */
export function localeName(locale) {
    return /^[a-z]{4}$/iu.test(locale)
        ? `${locale.slice(0, 2).toLowerCase()}${locale.slice(2).toUpperCase()}`
        : locale;
}
/** Game asset paths use backslashes; logical resource ids use forward slashes. */
export function assetId(path) {
    const value = path?.trim().replaceAll('\\', '/');
    return value === undefined || value === '' || value.startsWith('@@') ? undefined : value;
}
function plainText(html) {
    return html
        .replace(/<br\s*\/?>/giu, '\n')
        .replace(/<[^>]*>/gu, '')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&')
        .trim();
}
/**
 * One entity, from its per-locale cards (the first entry is the primary locale).
 */
export function entityCardFacts(cards, options) {
    const [primary] = cards.values();
    if (primary === undefined)
        throw new TypeError('an entity card needs at least one locale');
    const { ns, id } = primary;
    const path = (...segments) => provenanceOf(options.source, [ns, id, ...segments]);
    const fact = (factId, label, value, extra = {}) => Object.freeze({
        id: factId,
        label,
        value,
        provenance: path(...(extra.path ?? [])),
        ...(extra.note === undefined ? {} : { note: extra.note }),
        ...(extra.locale === undefined ? {} : { locale: extra.locale }),
        ...(extra.editable === true && options.editOperation !== undefined
            ? {
                type: { kind: typeof value === 'number' ? 'number' : 'text' },
                editable: {
                    write: {
                        operation: operationId(options.editOperation, {
                            contributionId: ENTITY_SUBJECT_SCOPE,
                        }),
                    },
                    editor: 'scalar',
                },
            }
            : {}),
    });
    const stats = [];
    for (const vital of primary.vitals) {
        const name = vital.name.toLowerCase();
        const notes = [
            vital.start === undefined ? undefined : `starts at ${vital.start}`,
            vital.regen === undefined ? undefined : `regenerates ${vital.regen}/s`,
        ].filter(Boolean);
        stats.push(fact(name, vital.name, vital.max, {
            path: [`${vital.name}Max`],
            editable: true,
            ...(notes.length === 0 ? {} : { note: notes.join(', ') }),
        }));
        if (vital.armor !== undefined)
            stats.push(fact(`${name}-armor`, `${vital.name} armor`, vital.armor, {
                path: [`${vital.name}Armor`],
                editable: true,
            }));
    }
    const speed = primary.fields.find(field => field.name === 'Speed');
    if (speed !== undefined)
        stats.push(fact('speed', 'Speed', Number.isFinite(Number(speed.value)) ? Number(speed.value) : speed.value, { path: ['Speed'], editable: speed.editable === true }));
    const cost = primary.cost ?? {};
    if (cost.minerals !== undefined)
        stats.push(fact('minerals', 'Minerals', cost.minerals, { path: ['CostResource', 'Minerals'] }));
    if (cost.vespene !== undefined)
        stats.push(fact('vespene', 'Vespene', cost.vespene, { path: ['CostResource', 'Vespene'] }));
    if (cost.supply !== undefined)
        stats.push(fact('food', 'Supply', cost.supply, { path: ['Food'] }));
    if (cost.time !== undefined)
        stats.push(fact('time', 'Build time', cost.time));
    const overview = [];
    const labels = {};
    for (const [locale, card] of cards) {
        labels[locale] = card.name;
        overview.push(fact('name', 'Name', card.name, { locale, path: ['Name'] }));
        if (card.descriptionHtml !== undefined) {
            overview.push(fact('description', 'Description', plainText(card.descriptionHtml), {
                locale,
                path: ['Description'],
            }));
        }
    }
    overview.push(fact('id', 'Id', id), fact('class', 'Class', primary.className));
    if (options.parentChain !== undefined) {
        overview.push(fact('parent-chain', 'Parent chain', options.parentChain.map(item => `${item.namespace}/${item.id === '' ? '(default)' : item.id}`), {
            note: options.partialParentChain === true
                ? 'Loaded catalog only; a parent is missing or cyclic.'
                : 'Inheritance within the loaded catalog; workspace dependency completeness is not established.',
        }));
    }
    if (primary.attributes.length > 0)
        overview.push(fact('attributes', 'Attributes', primary.attributes, { path: ['Attributes'] }));
    const icon = assetId(primary.iconAsset);
    if (icon !== undefined)
        overview.push(fact('icon', 'Icon', icon));
    const model = assetId(primary.modelAsset);
    if (model !== undefined)
        overview.push(fact('model', 'Model', model, { note: 'Resolved through the Actor and Model entries' }));
    const sources = primary.sources ?? (primary.source === undefined ? [] : [primary.source]);
    if (sources.length > 0)
        overview.push(fact('sources', 'Declared in', sources.map(item => `${item.mod}/${item.file}${item.line === undefined ? '' : `:${item.line}`}`)));
    const weapons = primary.weapons.map((weapon, index) => fact(`weapon-${index}`, weapon.label, {
        ...(weapon.damage === undefined ? {} : { damage: weapon.damage }),
        ...(weapon.attacks === undefined ? {} : { attacks: weapon.attacks }),
        ...(weapon.dps === undefined ? {} : { dps: Math.round(weapon.dps * 100) / 100 }),
        ...(weapon.range === undefined ? {} : { range: weapon.range }),
        ...(weapon.period === undefined ? {} : { cooldown: weapon.period }),
        ...(weapon.bonuses === undefined || weapon.bonuses.length === 0
            ? {}
            : {
                bonus: weapon.bonuses.map(bonus => `+${bonus.amount} vs ${bonus.attribute}`).join(', '),
            }),
        ...(weapon.targets === undefined ? {} : { targets: weapon.targets }),
    }));
    const fields = primary.fields.map(field => fact(`field-${field.name}`, field.name, field.value, {
        path: [field.name],
        editable: field.editable === true,
    }));
    const commands = [];
    for (const [locale, card] of cards) {
        for (const page of card.commandCards) {
            page.buttons.forEach((button, index) => commands.push(fact(`command-${page.id}-${index}`, plainText(button.nameHtml) || button.face, {
                page: page.id,
                row: button.row,
                column: button.col,
                type: button.type,
                face: button.face,
                description: plainText(button.tooltipHtml),
                ...(assetId(button.iconAsset) === undefined
                    ? {}
                    : { icon: assetId(button.iconAsset) }),
                ...(button.hotkey === undefined ? {} : { hotkey: button.hotkey }),
                ...(button.abil === undefined
                    ? {}
                    : { ability: entitySubjectId('Abil', button.abil) }),
                ...(button.submenuCardId === undefined ? {} : { submenu: button.submenuCardId }),
                ...(button.produces === undefined
                    ? {}
                    : { produces: entitySubjectId(button.produces.ns, button.produces.id) }),
                ...(button.cost === undefined ? {} : { cost: { ...button.cost } }),
                ...(button.cooldown === undefined ? {} : { cooldown: button.cooldown }),
                ...(button.range === undefined ? {} : { range: button.range }),
                ...(button.time === undefined ? {} : { time: button.time }),
                ...(button.targets === undefined ? {} : { targets: button.targets }),
            }, { locale, path: ['CardLayouts'] })));
        }
    }
    const producers = primary.producers.map((producer, index) => fact(`producer-${index}`, producer.creator.label, {
        kind: producer.kind,
        category: producer.category,
        creator: entitySubjectId(producer.creator.ns, producer.creator.id),
        path: producer.path,
        routes: producer.routes.map(route => ({
            producer: entitySubjectId(route.producer.ns, route.producer.id),
            via: route.via.map(link => entitySubjectId(link.ns, link.id)),
        })),
    }, { note: 'Catalog production routes; trigger-only producers are outside this view.' }));
    const relations = new Map();
    const relate = (role, target) => {
        const subjectId = entitySubjectId(target.ns, target.id);
        const key = `${role}\u0000${subjectId}`;
        if (!relations.has(key))
            relations.set(key, Object.freeze({ role, subjectId, label: target.label || target.id, kind: target.ns }));
    };
    for (const weapon of primary.weapons)
        relate('Weapons', weapon);
    for (const ability of primary.abilities)
        relate('Abilities', ability);
    for (const behavior of primary.behaviors)
        relate('Behaviors', behavior);
    for (const producer of primary.producers) {
        relate('Production mechanism', producer.creator);
        if (producer.routes.length === 0)
            relate('Produced by', producer.creator);
        for (const route of producer.routes)
            relate('Produced by', route.producer);
    }
    for (const page of primary.commandCards)
        for (const button of page.buttons) {
            relate('Command buttons', {
                ns: 'Button',
                id: button.face,
                label: plainText(button.nameHtml),
            });
            if (button.abil !== undefined)
                relate('Command abilities', { ns: 'Abil', id: button.abil, label: button.abil });
            if (button.produces !== undefined)
                relate('Produces', button.produces);
        }
    for (const parent of options.parentChain ?? []) {
        // Empty ids are implicit defaults; the shared subject-id parser cannot address them.
        if (parent.id === '' || (parent.namespace === ns && parent.id === id))
            continue;
        relate('Parent chain', { ns: parent.namespace, id: parent.id, label: parent.id || '(default)' });
    }
    for (const group of primary.relationsOut)
        for (const link of group.links)
            relate(`Uses ${group.ns}`, link);
    for (const group of primary.relationsIn)
        for (const link of group.links)
            relate(`Used by ${group.ns}`, link);
    const source = createSubjectFactsSource({
        snapshotId: options.snapshotId,
        subjectId: entitySubjectId(ns, id),
        label: primary.name || id,
        kind: ns,
        type: primary.className,
        source: options.source,
        groups: [
            { id: 'stats', label: 'Stats', facts: stats },
            { id: 'overview', label: 'Overview', facts: overview },
            { id: 'weapons', label: 'Weapons', facts: weapons },
            { id: 'command-card', label: 'Command card', facts: commands },
            { id: 'producers', label: 'Production routes', facts: producers },
            { id: 'fields', label: 'Fields', facts: fields },
        ],
        relations: [...relations.values()],
    });
    // The portrait, the model and the localized titles are identity facts newer than the kit's
    // builder; the host resolves the model through this subject's resources and lends it to the card.
    const extra = {
        ...(icon === undefined ? {} : { portrait: icon }),
        // SC2 models are authored in game units, which the map scene also treats as meters.
        ...(model === undefined ? {} : { model, modelMetersPerSourceUnit: 1 }),
        localizedLabels: Object.freeze(labels),
    };
    return Object.freeze({
        ...source,
        async summary(signal) {
            const summary = await source.summary(signal);
            return Object.freeze({
                ...summary,
                identity: Object.freeze({ ...summary.identity, ...extra }),
            });
        },
    });
}
/** A document's entities, lendable one at a time as subjects. */
export function createEntitySelectorSource(options) {
    let listed;
    const all = () => (listed ??= Object.freeze(options.entities()));
    const unsupported = async () => {
        throw new TypeError('SC2 entity calculations are published by the resolved-data service');
    };
    return Object.freeze({
        async summary(signal) {
            signal?.throwIfAborted();
            return Object.freeze({
                snapshotId: options.snapshotId,
                totalSubjects: all().length,
                completeness: 'complete',
            });
        },
        async subjects(query, signal) {
            const text = query.text?.toLowerCase();
            const matched = all().filter(item => (query.kind === undefined || item.kind === query.kind) &&
                (query.type === undefined || item.type === query.type) &&
                (text === undefined ||
                    item.label.toLowerCase().includes(text) ||
                    item.subjectId.toLowerCase().includes(text)));
            return pageOf(matched, query, signal);
        },
        async openFacts(subjectId, signal) {
            signal?.throwIfAborted();
            const parsed = parseSubjectId(subjectId);
            const [namespace, id] = parsed?.path ?? [];
            const facts = parsed?.scope === ENTITY_SUBJECT_SCOPE &&
                parsed.path.length === 2 &&
                namespace !== undefined &&
                id !== undefined
                ? options.open(namespace, id)
                : undefined;
            if (facts === undefined)
                throw new RangeError(`no entity ${subjectId} in this source`);
            return Object.freeze({ value: facts, release: async () => undefined });
        },
        openCalculations: unsupported,
    });
}
