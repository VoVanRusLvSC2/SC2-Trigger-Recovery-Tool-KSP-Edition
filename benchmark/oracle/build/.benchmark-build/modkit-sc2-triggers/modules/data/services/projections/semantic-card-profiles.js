const field = (fieldId, label = fieldId) => Object.freeze({ fieldId, label });
const section = (id, label, fields) => Object.freeze({
    id,
    label,
    fields: Object.freeze(fields),
});
/**
 * Stable semantic sections for the nine Product-GA SC2 catalog cards.
 *
 * These profiles are deliberately a presentation index, not a second schema:
 * values still come from the dependency-resolved snapshot and the complete
 * generated schema remains available as the "All resolved fields" section.
 */
export const STARCRAFT2_SEMANTIC_CARD_PROFILES = Object.freeze({
    Unit: Object.freeze([
        section('vitals', 'Vitals', [
            field('LifeMax', 'Maximum life'),
            field('LifeArmor', 'Life armor'),
            field('LifeRegenRate', 'Life regeneration'),
            field('ShieldsMax', 'Maximum shields'),
            field('ShieldArmor', 'Shield armor'),
            field('ShieldRegenRate', 'Shield regeneration'),
            field('EnergyMax', 'Maximum energy'),
            field('EnergyRegenRate', 'Energy regeneration'),
        ]),
        section('movement', 'Movement and classification', [
            field('Speed', 'Movement speed'),
            field('Acceleration', 'Acceleration'),
            field('Deceleration', 'Deceleration'),
            field('TurningRate', 'Turning rate'),
            field('Sight', 'Sight radius'),
            field('Race', 'Race'),
            field('Attributes', 'Attributes'),
        ]),
        section('cost', 'Cost and production', [
            field('CostResource', 'Resource cost'),
            field('CostTime', 'Build time'),
            field('Food', 'Supply used'),
            field('FoodMade', 'Supply provided'),
            field('KillXP', 'Kill experience'),
        ]),
        section('command-cards', 'Command cards', [field('CardLayouts', 'Command-card layouts')]),
        section('abilities', 'Abilities', [field('AbilArray', 'Ability slots')]),
        section('behaviors', 'Behaviors', [field('BehaviorArray', 'Initial behaviors')]),
        section('weapons', 'Weapons', [field('WeaponArray', 'Weapon slots')]),
    ]),
    Weapon: Object.freeze([
        section('combat', 'Combat', [
            field('Range', 'Range'),
            field('MinimumRange', 'Minimum range'),
            field('Period', 'Attack period'),
            field('DisplayAttackCount', 'Displayed attacks per period'),
            field('Arc', 'Attack arc'),
            field('AllowedMovement', 'Allowed movement'),
        ]),
        section('effects', 'Effects', [
            field('Effect', 'Root effect'),
            field('DisplayEffect', 'Displayed effect'),
        ]),
        section('targeting', 'Targeting', [
            field('TargetFilters', 'Target filters'),
            field('AcquireFilters', 'Acquire filters'),
            field('SupportedFilters', 'Supported filters'),
            field('Options', 'Weapon options'),
        ]),
    ]),
    Abil: Object.freeze([
        section('commands', 'Commands and products', [
            field('InfoArray', 'Command entries'),
            field('Info', 'Command entry'),
            field('InfoArrayUnmorph', 'Unmorph entries'),
            field('CmdButtonArray', 'Command buttons'),
        ]),
        section('effects', 'Effects', [
            field('Effect', 'Root effect'),
            field('EffectArray', 'Effect entries'),
            field('InitialEffect', 'Initial effect'),
            field('FinalEffect', 'Final effect'),
        ]),
        section('use', 'Use rules', [
            field('Cost', 'Ability cost'),
            field('Range', 'Ability range'),
            field('Flags', 'Ability flags'),
            field('ValidatorArray', 'Validators'),
        ]),
    ]),
    Effect: Object.freeze([
        section('execution', 'Execution', [
            field('Amount', 'Amount'),
            field('Effect', 'Nested effect'),
            field('EffectArray', 'Nested effects'),
            field('InitialEffect', 'Initial effect'),
            field('PeriodicEffect', 'Periodic effect'),
            field('FinalEffect', 'Final effect'),
            field('ImpactEffect', 'Impact effect'),
            field('PeriodCount', 'Period count'),
            field('SpawnUnit', 'Spawned units'),
            field('MorphUnit', 'Morph target'),
        ]),
        section('constraints', 'Constraints', [
            field('ValidatorArray', 'Validators'),
            field('TargetFilters', 'Target filters'),
            field('Flags', 'Effect flags'),
        ]),
    ]),
    Behavior: Object.freeze([
        section('lifecycle', 'Lifecycle', [
            field('Duration', 'Duration'),
            field('Period', 'Period'),
            field('InitialEffect', 'Initial effect'),
            field('PeriodicEffect', 'Periodic effect'),
            field('FinalEffect', 'Final effect'),
            field('ExpireEffect', 'Expire effect'),
        ]),
        section('modification', 'Modification', [
            field('Modification', 'Unit modification'),
            field('DamageResponse', 'Damage response'),
            field('ValidatorArray', 'Validators'),
            field('StackAlias', 'Stack alias'),
            field('MaxStackCount', 'Maximum stacks'),
        ]),
    ]),
    Upgrade: Object.freeze([
        section('levels', 'Levels and changes', [
            field('MaxLevel', 'Maximum level'),
            field('EffectArray', 'Data changes'),
            field('AffectedUnitArray', 'Affected units'),
        ]),
        section('cost', 'Cost', [
            field('CostResource', 'Resource cost'),
            field('CostTime', 'Research time'),
            field('BonusResourcePerLevel', 'Resource increase per level'),
            field('BonusTimePerLevel', 'Time increase per level'),
        ]),
    ]),
    Button: Object.freeze([
        section('presentation', 'Presentation', [
            field('Name', 'Name'),
            field('Tooltip', 'Tooltip'),
            field('TooltipAppender', 'Tooltip appender'),
            field('Icon', 'Icon'),
            field('Hotkey', 'Hotkey'),
            field('AlertName', 'Alert name'),
            field('AlertTooltip', 'Alert tooltip'),
            field('AlertIcon', 'Alert icon'),
        ]),
    ]),
    Actor: Object.freeze([
        section('binding', 'Game-data binding', [
            field('UnitName', 'Unit'),
            field('AbilName', 'Ability'),
            field('Effect', 'Effect'),
            field('Behavior', 'Behavior'),
            field('Weapon', 'Weapon'),
        ]),
        section('presentation', 'Presentation', [
            field('Model', 'Model'),
            field('ModelFlags', 'Model flags'),
            field('Sound', 'Sound'),
            field('Events', 'Actor events'),
            field('Macros', 'Actor macros'),
        ]),
    ]),
    Model: Object.freeze([
        section('asset', 'Model asset', [
            field('Model', 'Model file'),
            field('AnimFile', 'Animation file'),
            field('Image', 'Image'),
            field('Scale', 'Scale'),
            field('AnimSpeed', 'Animation speed'),
            field('AnimBlendTime', 'Animation blend time'),
            field('AnimAliases', 'Animation aliases'),
        ]),
        section('bounds', 'Bounds and flags', [
            field('Bounds', 'Bounds'),
            field('Radius', 'Radius'),
            field('Flags', 'Model flags'),
        ]),
    ]),
});
export const STARCRAFT2_PRODUCT_GA_CARD_NAMESPACES = Object.freeze(Object.keys(STARCRAFT2_SEMANTIC_CARD_PROFILES));
export function semanticCardProfile(namespace) {
    return STARCRAFT2_SEMANTIC_CARD_PROFILES[namespace];
}
