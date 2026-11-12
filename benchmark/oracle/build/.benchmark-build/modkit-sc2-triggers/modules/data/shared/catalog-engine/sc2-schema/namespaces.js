import { NAMESPACE_CLASS_MAP } from './structure-types/index.js';
// Schema-driven reverse lookup: 'CRequirementAnd' → 'RequirementNode', 'CSkinPack' → 'SkinPack', etc.
// Built at module load time from the canonical class→namespace enums in the schema.
const CLASS_NS_MAP = new Map();
function buildClassNsMap() {
    for (const [ns, classes] of Object.entries(NAMESPACE_CLASS_MAP)) {
        for (const cls of classes) {
            CLASS_NS_MAP.set(cls, ns);
        }
    }
}
buildClassNsMap();
/**
 * All GameCatalog namespace keys as they appear in SC2 XML tag names.
 * e.g. CUnit → namespace 'Unit', CAbilResearch → namespace 'Abil'
 */
export const CATALOG_NAMESPACES = [
    'Abil',
    'Accumulator',
    'Achievement',
    'AchievementTerm',
    'Actor',
    'Alert',
    'ArmyCategory',
    'ArmyUnit',
    'ArmyUpgrade',
    'Artifact',
    'ArtifactSlot',
    'AttachMethod',
    'BankCondition',
    'Beam',
    'Behavior',
    'Boost',
    'Bundle',
    'Button',
    'Camera',
    'Campaign',
    'Character',
    'Cliff',
    'CliffDoodad',
    'CliffMesh',
    'ColorStyle',
    'Commander',
    'Config',
    'ConsoleSkin',
    'Const',
    'Conversation',
    'ConversationState',
    'Cursor',
    'DSP',
    'DataCollection',
    'DataCollectionPattern',
    'DecalPack',
    'Effect',
    'Emoticon',
    'EmoticonPack',
    'FoW',
    'Footprint',
    'Game',
    'GameUI',
    'Herd',
    'HerdNode',
    'Hero',
    'HeroAbil',
    'HeroStat',
    'Item',
    'ItemClass',
    'ItemContainer',
    'Kinetic',
    'LensFlareSet',
    'Light',
    'Location',
    'Loot',
    'Map',
    'Model',
    'Mount',
    'Mover',
    'Objective',
    'PhysicsMaterial',
    'Ping',
    'PlayerResponse',
    'PortraitPack',
    'Preload',
    'PremiumMap',
    'Race',
    'RaceBannerPack',
    'Requirement',
    'RequirementNode',
    'Reverb',
    'Reward',
    'ScoreResult',
    'ScoreValue',
    'Shape',
    'Skin',
    'SkinPack',
    'Sound',
    'SoundExclusivity',
    'SoundMixSnapshot',
    'Soundtrack',
    'Spray',
    'SprayPack',
    'StimPack',
    'TacCooldown',
    'Tactical',
    'Talent',
    'TalentProfile',
    'TargetFind',
    'TargetSort',
    'Terrain',
    'TerrainObject',
    'TerrainTex',
    'Texture',
    'TextureSheet',
    'Tile',
    'Trophy',
    'Turret',
    'Unit',
    'Upgrade',
    'User',
    'Validator',
    'VoiceOver',
    'VoicePack',
    'WarChest',
    'WarChestSeason',
    'Water',
    'Weapon',
];
/**
 * Maps a C-prefixed type name to its namespace.
 * e.g. 'CUnit' → 'Unit',  'CAbilResearch' → 'Abil'
 */
export function typeToNamespace(typeName) {
    // Schema-driven exact lookup — covers all known class hierarchies (RequirementNode
    // subtypes, SkinPack, etc.) without any hardcoding.
    const schemaMatch = CLASS_NS_MAP.get(typeName);
    if (schemaMatch !== undefined)
        return schemaMatch;
    // Longest-prefix fallback for virtual/unknown types not in the schema map (e.g. CConst).
    const withoutC = typeName.slice(1);
    let best;
    for (const ns of CATALOG_NAMESPACES) {
        if (withoutC === ns || withoutC.startsWith(ns)) {
            if (best === undefined || ns.length > best.length)
                best = ns;
        }
    }
    return best;
}
/**
 * Returns true if a tag name is a catalog entry type (starts with C + uppercase).
 */
export function isCatalogTypeName(name) {
    return name.length >= 2 && name[0] === 'C' && name[1] >= 'A' && name[1] <= 'Z';
}
