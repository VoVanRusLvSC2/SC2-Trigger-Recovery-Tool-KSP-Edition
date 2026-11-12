import { CCatalogReference, CConstType, CGameContentCreationData, CTargetFilters, CRefKey, CActorTerms, CActorMsgPayloadPtr, CActorKey, CAbilCommand, EAttachmentID, CDataEntryPath, TUpgradeEffectValue, CUserReference, CTextureExpression, CYawPitchRoll, CDataSoupKey } from "./schema.complex.js";
import { CObject } from "./schema.core.js";
import { EUnitSound, EStructId, ETypeId, EAbilOrderDisplayType, ECooldownLocation, ECooldownOperation, EChargeLocation, EResourceType, EUnitVital, EAbilCmdState, EAbilArmMagazineManage, EAbilInventoryAlignment, EDurationArray, EEffectArray, ESectionArray, EAbilMorphPhase, EAbilMorphSection, EAbilTrainLocation, EAbilTrainRotation, EEffectUnit, EEffectHistory, EEffectLocation, EEffectPlayer, EAchievementTagCheck, EActorRequestScope, EActorRequestActor, EActorModelAspectPerson, EActorModelAspectObservingPoV, EActorModelAspectRegardsAs, EActorModelAspectDuring, EActorModelAspectObservedPlayerType, EActorModelAspectModelOwnerType, EActorModelAspectTest, EAttachKeyword, EActorPhysicsImpactRangeType, EActorQuadDecorationFunction, EActorSoundValueSource, EActorResponseScope, EActorIntersectType, ESquibType, EStateArray, EActorAnimTransitionType, EActorAnimPropMatchType, ESerpentType, EActorOverkillTestType, ECmdResult, EDamageKind, EHeightTime, EUnitAttribute, EBehaviorCategory, ESoundCategory, ERateMultiplierArray, EPlane, EEffectTimeScale, EDamageLocation, EDamageResponseDamageValue, EDamageResponseHandledValue, ESCameraZoomParam, ESUIColorEntry, ECommanderTalentType, ECommanderMasteryTalentType, EConversationConditionOp, EConversationActionOp, EConversationLineObjects, EConversationConditionCheck, EConversationSelectionMethod, ETextTagEdge, EHeightMap, EUpgradeOperation, EEffectModifyTurret, EFootprintShapeMode, ETeamColor, EDamageCategory, EArmorType, ESoundFormat, ESoundResampler, ESpeakerMode, ESoundBlend, EMuteControl, EVolumeControl, ESoundMaxMethod, ESoundMaxPrioritization, EGameCategoryUsage, EGlueTheme, EHeroAbilCategoryState, EGameCatalog, EHeroAITalentBuildType, EHeroStatState, EVariationCommands, ETonemapRegionTypes, EDiffuseColor, EDiffuseMultiplier, ELightInfoParam, EDirectionalLight, EMissionState, ESAttachPropsKeys, EModelEvent, EModelQuality, EPhysicsMaterial, EMotionDriverType, EMotionTurnType, EMotionActorTrackingType, EMotionArrivalTestType, EMotionBlendType, EMotionRotationLaunchActorType, EMotionRotationActorType, EMotionThrowRotationType, EAdaptableParabolaDistances, EAdaptableParabolaAccels, EMotionOverlayType, EMotionOverlayPolarity, ERequirementState, TLocaleId, ETalentModification, ESamplingDistance, EChance, ECardButtonType, EValueCompare, EVoiceOverSkinState, EVoiceOverSoundType, EUserType, EEditorTextType } from "./schema.enums.js";
import { FEffectBehavior, FResourceType, FCharge, FMarker, FAbilCmd, FDisplay, FAbilArmMagazineInfo, FUseBuildTimeArray, FAbilSpecializeInfo, FAbilTrainInfo, FActorQuadDecoration, FActorPhysicsData, FReplacementLayers, FSerpentAggregate, FTerrainSquibVisual, FPlayerRelationship, FDeathType, FBehaviorModify, FBehaviorState, FUnitVital, FAbilCategories, FClassIdCAbil, FBehaviorCategory, FClassIdCBehavior, FDamageKind, FDamageResponseCategory, FAttackTypeResponse, FDamageTypeResponse, FConversationProductionLevel, FEffectReveal, FEffectModifyTurret, FPositive, FNegative, FDifficultyLevel, FClear, FSoundQuality, FSoundData, FDefaultGameVariantOptions, FHeroAbil, FAnimFile, FPathingDataBits, FStartingUnit, FSoundLocaleFlags, FAcceptWorldForces, FUserField } from "./schema.flags.js";
import { CConstLink, CModelFile, CImageLink, CBehaviorLink, TCooldownLink, TChargeLink, CTargetSortLink, TMarkerLink, CCursorLink, CIdentifier, CButtonLink, CRequirementLink, CAlertLink, CUnitLink, CValidatorLink, CItemContainerLink, CItemClassLink, CAbilLink, CEffectLink, CUpgradeLink, CAccumulatorLink, CShapeLink, CModelLink, CActorLabelKey, CActorCreateKey, CSoundLink, CStringLink, CPhysicsMaterialLink, CBankLink, CRewardLink, TBattleProductId, CScoreValueLink, CWeaponLink, CTurretLink, TTechAlias, CMovieFile, CAchievementLink, CActorLink, CTalentLink, CUserLink, TUserFieldId, TUserInstanceId, TConversationStateOpId, CConversationStateLink, TConversationStateIndexId, TConversationItemId, TConversationStateVariation, CCharacterLink, TConversationTag, TConversationStateInfoId, CTextureSheetLink, CMoverLink, CCampaignLink, CRaceLink, TTriggerLibId, CMapFile, CDSPLink, CCutsceneFile, CHerdNodeLink, CHeroAbilLink, CHeroStatLink, CMapLink, CLootLink, CAnimsFile, CTextureSlot, CRequirementNodeLink, CSoundFile, CFacialFile, TVoiceOverSkinId, TVoiceOverGroupId } from "./schema.links.js";
import { CString } from "./schema.primitives.js";
import { Month, Day, Year, CColor, Real32, UInt32, CGameTime, Real, Bit, Int32, TMarkerCount, TPreemptLevel, CFourCC, CActorSiteOps, CLabelExpression, CIdSetPlayers, CIdSetTeams, CSubNameKey, CAttachMethods, CVariatorActorReal32, TAbilCmdIndex, UInt8, CPitchRange, CiRange, CVolumeRange, CScaleVector, CAnimProps, CPhysicsMaterialLinks, CActorTableKeys1x3, CActorClassFilters, CActorAngle, CString80, C2iVector, C2Vector, C4Vector, C3Vector, CActorDeathMembers, TAttachPropIndex, TAttackTargetPriority, CGameSpeed, CGameAcceleration, CFangleArc, Int8, Int16, CGameRate, TPowerLevel, TCommanderLevel, TDifficultyLevel, CGamePoInt3D, CFangle, CEffectOffset, CString4, CiQuad, CString50, TFootprintOffsets, TFootprintBorders, TDifficulty, THandicap, CString32, TCmdResult, CVolume, UInt16, CTimeOfDay, CTextureProps, CVariatorGameFixed, CMissileAcceleration, CMissileSpeed, CPhaseOutro, C3fVector, CThrowBand, CFangleRateMissile, CFangleAccelMissile, CGamePoint, TSoundWeight, CPitch, TSoundBalance, CFangleRate, CCardId } from "./schema.types.js";
export class CStruct extends CObject.Ex({
    class: EStructId
}) {
}
export class SConst extends CStruct.Ex({
    id: CConstLink,
    type: ETypeId,
    path: CCatalogReference,
    value: CConstType
}) {
}
//Blizzard structures
export class SGameContentCreationData extends CStruct.Ex({
    value: CGameContentCreationData
}) {
}
export class SProductReleaseDate extends CStruct.Ex({
    Month: Month,
    Day: Day,
    Year: Year,
    value: CString
}) {
}
export class SAbilOrderDisplay extends CStruct.Ex({
    DisplayType: EAbilOrderDisplayType,
    Color: CColor,
    Model: CModelFile,
    Scale: Real32,
    LineTexture: CImageLink
}) {
}
export class SEffectBehavior extends CStruct.Ex({
    Behavior: CBehaviorLink,
    Count: UInt32,
    Flags: FEffectBehavior,
    Duration: CGameTime
}) {
}
export class SCooldown extends CStruct.Ex({
    Link: TCooldownLink,
    Location: ECooldownLocation,
    TimeStart: CGameTime,
    Operation: ECooldownOperation,
    TimeUse: CGameTime
}) {
}
export class SCharge extends CStruct.Ex({
    CountMax: Real,
    CountStart: Real,
    CountUse: Real,
    HideCount: Bit,
    Link: TChargeLink,
    Location: EChargeLocation,
    TimeDelay: CGameTime,
    TimeStart: CGameTime,
    TimeUse: CGameTime,
    Flags: FCharge
}) {
}
export class SCost extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FResourceType,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown
}) {
}
export class SCostFactor extends CStruct.Ex({
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Resource: { index: EResourceType, value: Real },
    Charge: Real,
    Cooldown: Real
}) {
}
export class STargetSorts extends CStruct.Ex({
    SortArray: [CTargetSortLink],
    RequestCount: UInt32,
    RequestPercentage: Real
}) {
}
export class SMarker extends CStruct.Ex({
    Count: TMarkerCount,
    Duration: CGameTime,
    MatchFlags: FMarker,
    MismatchFlags: FMarker,
    Link: TMarkerLink
}) {
}
export class SAbilTargetCursorInfo extends CStruct.Ex({
    Invalid: CCursorLink,
    Normal: CCursorLink,
    Allied: CCursorLink,
    Enemy: CCursorLink
}) {
}
export class SAbilCmdButton extends CStruct.Ex({
    AutoQueueId: CIdentifier,
    DefaultButtonFace: CButtonLink,
    Flags: FAbilCmd,
    State: EAbilCmdState,
    Requirements: CRequirementLink,
    PreemptLevel: TPreemptLevel
}) {
}
export class SAbilArmMagazineInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Count: UInt32,
    CountStart: UInt32,
    Distance: Real,
    Flags: FAbilArmMagazineInfo,
    Manage: EAbilArmMagazineManage,
    Unit: CUnitLink
}) {
}
export class SAbilBuildInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Unit: CUnitLink,
    Delay: CGameTime,
    Time: CGameTime,
    Alert: CAlertLink,
    ValidatorArray: [CValidatorLink],
    AddOnParentCmdPriority: Int32,
    PeonKillFinish: Bit
}) {
}
export class SAbilInventoryInfo extends CStruct.Ex({
    Alignment: EAbilInventoryAlignment,
    Container: CItemContainerLink,
    Item: CUnitLink,
    EmptyFace: CButtonLink,
    Classes: [CItemClassLink],
    Requirements: CRequirementLink
}) {
}
export class SAbilLearnInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Abil: CAbilLink,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32
}) {
}
export class SAbilMergeInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Unit: CUnitLink,
    Time: CGameTime
}) {
}
export class SAbilMorphSection extends CStruct.Ex({
    DurationArray: { index: EDurationArray, value: CGameTime },
    UseBuildTimeArray: FUseBuildTimeArray,
    EffectArray: { index: EEffectArray, value: CEffectLink }
}) {
}
export class SAbilMorphInfo extends CStruct.Ex({
    Score: Bit,
    Unit: CUnitLink,
    CollideRange: Real,
    SectionArray: { index: ESectionArray, value: SAbilMorphSection },
    RallyResetPhase: EAbilMorphPhase,
    RallyResetSection: EAbilMorphSection,
    RandomDelayMin: CGameTime,
    RandomDelayMax: CGameTime
}) {
}
export class SAbilPawnInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    ClassRequired: CItemClassLink,
    ClassesExcluded: [CItemClassLink],
    RefundFraction: { index: EResourceType, value: Real },
    TargetFilters: CTargetFilters,
    ValidatorArray: [CValidatorLink]
}) {
}
export class SAbilRallyInfo extends CStruct.Ex({
    AllowSetOnGround: Bit,
    AllowSetFilters: CTargetFilters,
    AllowSetValidators: [CValidatorLink],
    SetOnGround: Bit,
    SetFilters: CTargetFilters,
    SetValidators: [CValidatorLink],
    UseFilters: CTargetFilters,
    UseValidators: [CValidatorLink]
}) {
}
export class SAbilResearchInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Upgrade: CUpgradeLink
}) {
}
export class SAbilReviveCmdButton extends CStruct.Ex({
    AutoQueueId: CIdentifier,
    DefaultButtonFace: CButtonLink,
    Flags: FAbilCmd,
    State: EAbilCmdState,
    Requirements: CRequirementLink,
    TPreemptLevel: TPreemptLevel,
    ReviverIndex: UInt32,
    ValidatorArray: [CValidatorLink]
}) {
}
export class SAbilReviveInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Time: CGameTime,
    Alert: CAlertLink
}) {
}
export class SAbilReviveInfoMax extends CStruct.Ex({
    ResourceFactor: { index: EResourceType, value: Real },
    TimeFactor: Real,
    Resource: { index: EResourceType, value: Int32 },
    Time: CGameTime
}) {
}
export class SAbilSpecializeInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Effect: CEffectLink,
    Flags: FAbilSpecializeInfo
}) {
}
export class SAbilTrainInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Unit: [CUnitLink],
    Effect: CEffectLink,
    Location: EAbilTrainLocation,
    Rotation: EAbilTrainRotation,
    Flags: FAbilTrainInfo
}) {
}
export class SAbilWarpTrainInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Button: SAbilCmdButton,
    Time: CGameTime,
    Alert: CAlertLink,
    Unit: CUnitLink
}) {
}
export class SEffectWhichUnit extends CStruct.Ex({
    Effect: CEffectLink,
    Value: EEffectUnit,
    History: EEffectHistory
}) {
}
export class SEffectWhichLocation extends CStruct.Ex({
    Effect: CEffectLink,
    Value: EEffectLocation,
    History: EEffectHistory
}) {
}
export class SEffectWhichBehavior extends CStruct.Ex({
    Effect: CEffectLink,
    Value: EEffectUnit,
    History: EEffectHistory,
    Behavior: CBehaviorLink
}) {
}
export class SAccumulatorSwitchCase extends CStruct.Ex({
    Validator: CValidatorLink,
    Accumulator: CAccumulatorLink,
    FallThrough: Bit
}) {
}
export class SAccumulatedFixed extends CStruct.Ex({
    value: Real,
    AccumulatorArray: [CAccumulatorLink]
}) {
}
export class SAccumulatedUInt32 extends CStruct.Ex({
    AccumulatorArray: [CAccumulatorLink],
    value: UInt32
}) {
}
export class SAccumulatedGameRate extends CStruct.Ex({
    AccumulatorArray: [CAccumulatorLink],
    value: Real
}) {
}
export class SAccumulatedGameTime extends CStruct.Ex({
    AccumulatorArray: [CAccumulatorLink],
    value: Real
}) {
}
export class SEffectWhichPlayer extends CStruct.Ex({
    Effect: CEffectLink,
    Value: EEffectPlayer
}) {
}
export class SAchievementTag extends CStruct.Ex({
    Value: CFourCC,
    Check: EAchievementTagCheck
}) {
}
export class SActorRequest extends CStruct.Ex({
    Subject: CRefKey,
    Scope: EActorRequestScope,
    Actor: EActorRequestActor,
    Effect: CEffectLink,
    FailOnNoHost: Bit,
    ReachAcrossEffectTrees: Bit
}) {
}
export class SActorVisibilityShape extends CStruct.Ex({
    Shape: CShapeLink
}) {
}
export class SActorEvent extends CStruct.Ex({
    Terms: CActorTerms,
    Target: CRefKey,
    Send: CActorMsgPayloadPtr
}) {
}
export class SActorSiteOpsData extends CStruct.Ex({
    Ops: CActorSiteOps,
    HoldPosition: Bit,
    HoldRotation: Bit
}) {
}
export class SActorModelAspect extends CStruct.Ex({
    Person: EActorModelAspectPerson,
    ObservingPoV: EActorModelAspectObservingPoV,
    RegardsAs: EActorModelAspectRegardsAs,
    During: EActorModelAspectDuring,
    LabelExpression: CLabelExpression,
    ObservedPlayerType: EActorModelAspectObservedPlayerType,
    ObservedPlayerHasPlayerId: CIdSetPlayers,
    ObservedPlayerHasTeamId: CIdSetTeams,
    ModelOwnerType: EActorModelAspectModelOwnerType,
    ModelOwnerHasPlayerId: CIdSetPlayers,
    ModelOwnerHasTeamId: CIdSetTeams,
    ModelOwnerLabelExpression: CLabelExpression,
    Test: EActorModelAspectTest,
    Model: CModelLink,
    Name: CSubNameKey
}) {
}
export class SActorModelAspectSet extends CStruct.Ex({
    TriggerModel: CModelLink,
    Aspects: [SActorModelAspect]
}) {
}
export class SAttachQuery extends CStruct.Ex({
    Methods: CAttachMethods,
    Fallback: EAttachKeyword
}) {
}
export class SActorHostedAttach extends CStruct.Ex({
    Name: CActorLabelKey,
    AttachQuery: SAttachQuery,
    HostSiteOps: SActorSiteOpsData
}) {
}
export class SEventDataFootprint extends CStruct.Ex({
    Name: CActorLabelKey,
    Actor: CActorCreateKey,
    Model: CModelLink
}) {
}
export class SEventDataSound extends CStruct.Ex({
    Name: CActorLabelKey,
    Actor: CActorCreateKey,
    Sound: CSoundLink
}) {
}
export class SActorPhysicsImpactData extends CStruct.Ex({
    Name: CActorLabelKey,
    Group: CActorLabelKey,
    ActorModel: CActorCreateKey,
    ModelLink: CModelLink,
    ActorSound: CActorCreateKey,
    SoundLink: CSoundLink,
    AutoVolumeRange: EActorPhysicsImpactRangeType,
    AutoVolumeRangeMin: Real32,
    AutoVolumeRangeMax: Real32,
    SiteOps: SActorSiteOpsData,
    OccuranceThrottlingDistance: CVariatorActorReal32,
    OccuranceThrottlingDistanceTimeout: Real32,
    OccuranceThrottlingPeriod: CVariatorActorReal32
}) {
}
export class SActorRangeAbil extends CStruct.Ex({
    Link: CAbilLink,
    Index: TAbilCmdIndex
}) {
}
export class SActorQuadDecoration extends CStruct.Ex({
    Actor: CActorCreateKey,
    SpawnInterval: Real32,
    TravelSpeed: Real32,
    TravelFunction: EActorQuadDecorationFunction,
    TravelFunctionParam: Real32,
    Flags: FActorQuadDecoration
}) {
}
export class SActorSoundLayer extends CStruct.Ex({
    Sound: CSoundLink,
    Chance: [UInt8],
    Pitch: [CPitchRange],
    PitchSource: EActorSoundValueSource,
    PlayDelay: [CiRange],
    PlayDelaySource: EActorSoundValueSource,
    Volume: [CVolumeRange],
    VolumeSource: EActorSoundValueSource
}) {
}
export class SActorAVPair extends CStruct.Ex({
    Model: CModelLink,
    Scale: CScaleVector,
    AnimProps: CAnimProps,
    Sound: CSoundLink
}) {
}
export class SActorActionTerrainSquib extends CStruct.Ex({
    Model: CModelLink,
    Scale: CScaleVector,
    AnimProps: CAnimProps,
    Sound: CSoundLink,
    TerrainPhysicsMaterial: CPhysicsMaterialLinks,
    DistanceMaxFromTerrainToCreate: Real32
}) {
}
export class SActorAVCluster extends CStruct.Ex({
    Model: CModelLink,
    Scale: CScaleVector,
    AnimProps: CAnimProps,
    Sound: CSoundLink,
    ModelReaction: CModelLink,
    AnimPropsReaction: CAnimProps,
    ScaleReaction: CScaleVector
}) {
}
export class SActorPhysicsData extends CStruct.Ex({
    Name: CActorLabelKey,
    MatchKeys: CActorTableKeys1x3,
    AttackModelVariation: Int32,
    AttackAnimProps: CAnimProps,
    Physics: CActorCreateKey,
    Flags: FActorPhysicsData
}) {
}
export class SActorQuerySubject extends CStruct.Ex({
    Filters: CActorClassFilters,
    Terms: CActorTerms
}) {
}
export class SActorQueryResponse extends CStruct.Ex({
    Target: CRefKey,
    Send: CActorMsgPayloadPtr,
    Scope: EActorResponseScope
}) {
}
export class SActorSendBasics extends CStruct.Ex({
    Target: CRefKey,
    Send: CActorMsgPayloadPtr
}) {
}
export class SActorQuerySubjectResponse extends CStruct.Ex({
    Filters: CActorClassFilters,
    IntersectType: EActorIntersectType,
    Terms: CActorTerms,
    OnResponse: [SActorSendBasics]
}) {
}
export class SActorDeathBodySquib extends CStruct.Ex({
    Name: CActorLabelKey,
    ActorModel: CActorCreateKey,
    Model: CModelLink,
    ModelSiteOps: SActorSiteOpsData,
    ModelAttachQuery: SAttachQuery,
    ActorSound: CActorCreateKey,
    Sound: CSoundLink,
    SoundSiteOps: SActorSiteOpsData,
    SoundAttachQuery: SAttachQuery,
    RequiredSquibType: ESquibType,
    IsFallback: Bit
}) {
}
export class SActorCloakState extends CStruct.Ex({
    Enter: CAnimProps,
    Loop: CAnimProps
}) {
}
export class SActorCloakTransition extends CStruct.Ex({
    StateArray: { index: EStateArray, value: SActorCloakState }
}) {
}
export class SActorCreepHeightClass extends CStruct.Ex({
    Name: CActorLabelKey,
    StartOffset: Real32,
    SolidHeight: Real32,
    FadeHeight: Real32
}) {
}
export class SActorCreepRate extends CStruct.Ex({
    Name: CActorLabelKey,
    Rate: Real32
}) {
}
export class SActorDeathData extends CStruct.Ex({
    ActorModel: CActorCreateKey,
    ActorModelLow: CActorCreateKey,
    AnimProps: CAnimProps,
    ModelLink: CModelLink,
    SoundLink: CSoundLink,
    VoiceLink: CSoundLink,
    BodySquibs: [SActorDeathBodySquib]
}) {
}
export class SActorDeathDataCustom extends CStruct.Ex({
    ActorModel: CActorCreateKey,
    ActorModelLow: CActorCreateKey,
    AnimProps: CAnimProps,
    ModelLink: CModelLink,
    SoundLink: CSoundLink,
    VoiceLink: CSoundLink,
    BodySquibs: [SActorDeathBodySquib],
    Name: CActorLabelKey,
    PhysicsMatchKeysOrdered: CActorTableKeys1x3,
    InheritsFrom: CActorLabelKey,
    IsAbstract: Bit
}) {
}
export class SLookAtTypeInfo extends CStruct.Ex({
    Group: CActorKey,
    Weight: Real,
    Time: UInt32,
    Rate: CActorAngle
}) {
}
export class SLookAtType extends CStruct.Ex({
    Id: CString80,
    Name: CStringLink,
    Start: [SLookAtTypeInfo],
    Stop: [SLookAtTypeInfo]
}) {
}
export class SSplatEmitterMaterialInfo extends CStruct.Ex({
    MaterialId: UInt8,
    ReplacementLayers: FReplacementLayers
}) {
}
export class SSplatEmitterInitInfo extends CStruct.Ex({
    TextureResolution: C2iVector,
    ProjectorModel: CModelLink,
    MaskBlobPath: CImageLink,
    ScaleDeltaTime: C2Vector,
    ScaleUpdateTime: Real,
    MaxBlobScale: C2Vector,
    Tint: CColor,
    MaterialInfo: [SSplatEmitterMaterialInfo],
    TerrainUVTiling: C4Vector,
    MinHeightValue: Real32
}) {
}
export class SActorOverrideBlendTime extends CStruct.Ex({
    AnimProps: CAnimProps,
    BlendIn: Real32,
    BlendOut: Real32
}) {
}
export class SActorOverrideTransitionBlendTime extends CStruct.Ex({
    Type: EActorAnimTransitionType,
    From: CAnimProps,
    FromMatch: EActorAnimPropMatchType,
    To: CAnimProps,
    ToMatch: EActorAnimPropMatchType,
    Blend: Real32
}) {
}
export class SActorOverrideModel extends CStruct.Ex({
    Model: [CModelLink],
    Blend: [SActorOverrideBlendTime],
    Transition: [SActorOverrideTransitionBlendTime]
}) {
}
export class SActorProgressStage extends CStruct.Ex({
    AnimProps: CAnimProps,
    BlendTime: Real32,
    Sound: CSoundLink
}) {
}
export class SActorHostedDelta extends CStruct.Ex({
    Subject: CRefKey,
    LocalOffset: C3Vector,
    AttachQuerySource: SAttachQuery,
    AttachQueryTarget: SAttachQuery
}) {
}
export class SSerpentAggregate extends CStruct.Ex({
    Type: ESerpentType,
    BaseElementLengthMax: Real32,
    SegmentRotationRate: CActorAngle,
    SwimmingUndulationElementLength: Real32,
    SwimmingUndulationStartOffset: Real32,
    SwimmingUndulationAmplitudePerUnit: Real32,
    SwimmingUndulationWavelength: Real32,
    SwimmingUndulationIdlePhaseVelocity: Real32,
    TurnSmoothingActivationAngleMin: CActorAngle,
    TurnSmoothingActivationAngleMax: CActorAngle,
    TurnSmoothingRadiusMax: Real32,
    UncoilingWhileIdleRotationRateMin: CActorAngle,
    UncoilingWhileIdleRotationRateMax: CActorAngle,
    Flags: FSerpentAggregate
}) {
}
export class SSerpentSegment extends CStruct.Ex({
    Radius: Real32
}) {
}
export class SActorStateInfo extends CStruct.Ex({
    Name: CActorLabelKey,
    Terms: CActorTerms
}) {
}
export class SActorBaseline extends CStruct.Ex({
    AnimProps: CAnimProps,
    BlendIn: Real32,
    BlendOut: Real32
}) {
}
export class SActorDeathDataCustomGroup extends CStruct.Ex({
    Name: CActorLabelKey,
    Members: CActorDeathMembers,
    Supersedes: CActorTableKeys1x3,
    SyncPassChance: Real
}) {
}
export class SActorUnitImpactSoundExtras extends CStruct.Ex({
    TriggerModel: CModelLink,
    SoundActor: CActorCreateKey,
    Sound: CSoundLink
}) {
}
export class SDamagePastRemainingHealth extends CStruct.Ex({
    Value: Real,
    TestType: EActorOverkillTestType
}) {
}
export class SDamageOverInterval extends CStruct.Ex({
    Value: Real,
    Interval: Real,
    TestType: EActorOverkillTestType
}) {
}
export class STerrainSquibVisual extends CStruct.Ex({
    TerrainPhysicsMaterial: CPhysicsMaterialLink,
    ActorModel: CActorCreateKey,
    ActorModelLow: CActorCreateKey,
    ModelLink: CModelLink,
    Flags: FTerrainSquibVisual
}) {
}
export class STerrainSquib extends CStruct.Ex({
    GroupName: CActorLabelKey,
    AttachQuery: SAttachQuery,
    MovementDistance: CVariatorActorReal32,
    IdlePeriod: CVariatorActorReal32,
    RangeUp: Real32,
    RangeUpFade: Real32,
    RangeDown: Real32,
    RangeDownFade: Real32,
    Visuals: [STerrainSquibVisual]
}) {
}
export class SUnitAbilSound extends CStruct.Ex({
    AbilCmd: CAbilCommand,
    Sound: CSoundLink,
    GroupSound: CSoundLink
}) {
}
export class SErrorOverride extends CStruct.Ex({
    Error: ECmdResult,
    Text: CStringLink,
    Sound: CSoundLink,
    GroupSound: CSoundLink
}) {
}
export class SLayerIcon extends CStruct.Ex({
    Image: [CImageLink]
}) {
}
export class SLayerIconVariation extends CStruct.Ex({
    Image: [CImageLink],
    Number: Int32
}) {
}
export class SLayerIconShield extends CStruct.Ex({
    Image: [CImageLink]
}) {
}
export class SLayerIconShieldVariation extends CStruct.Ex({
    Image: [CImageLink],
    Number: UInt32
}) {
}
export class SVitalColor extends CStruct.Ex({
    ColorArray: [CColor]
}) {
}
export class SIconVariation extends CStruct.Ex({
    Number: UInt32,
    Image: CImageLink
}) {
}
export class SStatusColor extends CStruct.Ex({
    BackgroundColor: CColor,
    EmptyColor: CColor,
    ColorArray: [CColor]
}) {
}
export class SStatusChargeData extends CStruct.Ex({
    Text: CStringLink,
    AbilCmd: CAbilCommand
}) {
}
export class SStatusHarvesterData extends CStruct.Ex({
    Text: CStringLink,
    SearchFilters: CTargetFilters,
    SearchRadius: Real
}) {
}
export class STextTagParameters extends CStruct.Ex({
    Text: CStringLink,
    TextShadow: Bit,
    Offset: C2iVector,
    Attachment: EAttachmentID,
    FontSize: UInt32,
    TextColor: CColor,
    EdgeColor: CColor,
    BackgroundColor: CColor,
    BackgroundImage: CImageLink,
    BackgroundImageTiled: Bit
}) {
}
export class SUnitKillRank extends CStruct.Ex({
    MinKills: UInt32,
    Text: CStringLink
}) {
}
export class SBankPath extends CStruct.Ex({
    File: CBankLink,
    Section: CString,
    Key: CString
}) {
}
export class SArtifactRank extends CStruct.Ex({
    RequiredRewardArray: [CRewardLink],
    ProductId: TBattleProductId
}) {
}
export class SAttachKey extends CStruct.Ex({
    Keyword: EAttachKeyword,
    Index: TAttachPropIndex
}) {
}
export class SDeathResponse extends CStruct.Ex({
    Chance: Real,
    Cost: SCost,
    Effect: CEffectLink,
    Relationship: FPlayerRelationship,
    Type: FDeathType
}) {
}
export class SAttributeChange extends CStruct.Ex({
    Attribute: CBehaviorLink,
    Points: Int32
}) {
}
export class SDamageKind extends CStruct.Ex({
    KindArray: { index: EDamageKind, value: Real }
}) {
}
export class SScoreValueUpdate extends CStruct.Ex({
    Validator: CValidatorLink,
    Value: CScoreValueLink
}) {
}
export class SUnitResourceRatio extends CStruct.Ex({
    Amount: { index: EResourceType, value: Real }
}) {
}
export class SUnitWeaponData extends CStruct.Ex({
    Link: CWeaponLink,
    Turret: CTurretLink
}) {
}
export class SModification extends CStruct.Ex({
    ModifyFlags: FBehaviorModify,
    StateFlags: FBehaviorState,
    AttackTargetPriority: TAttackTargetPriority,
    RadiusMultiplier: Real,
    Height: Real,
    HeightTime: { index: EHeightTime, value: CGameTime },
    SightBonus: Real,
    SightMaximum: Real,
    SightMinimum: Real,
    QueueCount: Int32,
    QueueSize: Int32,
    TimeScale: Real,
    HealDealtMultiplier: Real,
    HealTakenMultiplier: Real,
    HealDealtAdditiveMultiplier: Real,
    HealTakenAdditiveMultiplier: Real,
    MoveSpeedBaseMaximumBonus: CGameSpeed,
    MoveSpeedMaximum: CGameSpeed,
    MoveSpeedMinimum: CGameSpeed,
    MoveSpeedBonus: CGameSpeed,
    MoveSpeedMultiplier: Real,
    UnifiedMoveSpeedFactor: Real,
    AdditiveMoveSpeedFactor: SAccumulatedFixed,
    AccelerationBonus: CGameAcceleration,
    AccelerationMultiplier: Real,
    DecelerationBonus: CGameAcceleration,
    DecelerationMultiplier: Real,
    SnareMultiplier: Real,
    AttackSpeedMultiplier: Real,
    UnifiedAttackSpeedFactor: Real,
    AdditiveAttackSpeedFactor: SAccumulatedFixed,
    WeaponRange: Real,
    MeleeWeaponRange: Real,
    RangedWeaponRange: Real,
    WeaponMinRange: Real,
    DamageDealtScaled: { index: EDamageKind, value: Real },
    DamageDealtFraction: { index: EDamageKind, value: SAccumulatedFixed },
    DamageDealtUnscaled: { index: EDamageKind, value: SAccumulatedFixed },
    DamageDealtMaximum: { index: EDamageKind, value: Real },
    DamageDealtMinimum: { index: EDamageKind, value: Real },
    DamageDealtAttributeScaled: { index: EUnitAttribute, value: Real },
    DamageDealtAttributeMultiplier: { index: EUnitAttribute, value: Real },
    DamageDealtAttributeUnscaled: { index: EUnitAttribute, value: Real },
    DamageTakenScaled: { index: EDamageKind, value: Real },
    DamageTakenFraction: { index: EDamageKind, value: Real },
    DamageTakenUnscaled: { index: EDamageKind, value: Real },
    DamageTakenMaximum: { index: EDamageKind, value: Real },
    DamageTakenMinimum: { index: EDamageKind, value: Real },
    DamageTotalMultiplier: { index: EDamageKind, value: Real },
    UnifiedDamageDealtFraction: { index: EDamageKind, value: Real },
    UnifiedDamageTakenFraction: { index: EDamageKind, value: Real },
    LifeArmorBonus: SAccumulatedFixed,
    LifeArmorMultiplier: Real,
    ShieldArmorBonus: Real,
    ShieldArmorMultiplier: Real,
    EnergyArmorBonus: Real,
    EnergyArmorMultiplier: Real,
    ShieldDamageRatioBonus: Real,
    ShieldDamageRatioMultiplier: Real,
    EnergyDamageRatioBonus: SAccumulatedFixed,
    EnergyDamageRatioMultiplier: Real,
    ResourceHarvestAmountBonus: { index: EResourceType, value: UInt32 },
    ResourceHarvestAmountMultiplier: { index: EResourceType, value: Real },
    ResourceHarvestTimeBonus: { index: EResourceType, value: CGameTime },
    ResourceHarvestTimeMultiplier: { index: EResourceType, value: Real },
    VitalMaxIncreaseAffectsCurrentArray: FUnitVital,
    VitalMaxDecreaseAffectsCurrentArray: FUnitVital,
    VitalMaxArray: { index: EUnitVital, value: Real },
    VitalMaxFractionArray: { index: EUnitVital, value: Real },
    VitalMaxAdditiveMultiplierArray: { index: EUnitVital, value: Real },
    VitalRegenArray: { index: EUnitVital, value: SAccumulatedGameRate },
    VitalRegenMultiplier: { index: EUnitVital, value: Real },
    VitalDamageGainArray: { index: EUnitVital, value: SDamageKind },
    VitalDamageGainScoreArray: { index: EUnitVital, value: SScoreValueUpdate },
    VitalDamageLeechArray: { index: EUnitVital, value: SDamageKind },
    VitalDamageLeechScoreArray: { index: EUnitVital, value: SScoreValueUpdate },
    ResourceDamageLeech: { index: EDamageKind, value: SUnitResourceRatio },
    AbilCategoriesEnable: FAbilCategories,
    AbilCategoriesDisable: FAbilCategories,
    AbilClassEnableArray: FClassIdCAbil,
    AbilClassDisableArray: FClassIdCAbil,
    AbilTechAliasEnableArray: [TTechAlias],
    AbilTechAliasDisableArray: [TTechAlias],
    AbilLinkEnableArray: [CAbilLink],
    AbilLinkDisableArray: [CAbilLink],
    BehaviorCategoriesEnable: FBehaviorCategory,
    BehaviorCategoriesDisable: FBehaviorCategory,
    BehaviorCategoryDurationFactor: { index: EBehaviorCategory, value: Real },
    BehaviorClassEnableArray: FClassIdCBehavior,
    BehaviorClassDisableArray: FClassIdCBehavior,
    BehaviorLinkEnableArray: [CBehaviorLink],
    BehaviorLinkDisableArray: [CBehaviorLink],
    WeaponArray: [SUnitWeaponData],
    WeaponScanBonus: Real,
    WeaponScanLimit: Real,
    WeaponEnableArray: [CWeaponLink],
    WeaponDisableArray: [CWeaponLink],
    TurretEnableArray: [CTurretLink],
    TurretDisableArray: [CTurretLink],
    SoundArray: { index: EUnitSound, value: CSoundLink },
    Detect: Real,
    DetectArc: CFangleArc,
    DetectBonus: Real,
    DetectFilters: CTargetFilters,
    Radar: Real,
    RadarArc: CFangleArc,
    RadarFilters: CTargetFilters,
    Food: Real,
    AttributeChangeArray: [SAttributeChange],
    RateMultiplierArray: { index: ERateMultiplierArray, value: Real },
    DeathResponse: SDeathResponse,
    PlaneDelta: { index: EPlane, value: Int8 },
    ScoreKillBonus: Int32,
    ScoreLostBonus: Int32,
    SubgroupPriority: Int16,
    UnitNameOverride: CStringLink,
    XPMultiplier: Real,
    XPScaledBonus: Real,
    XPUnscaledBonus: Real,
    KillXPBonus: Int32,
    CriticalAttackChanceMultiplier: Real,
    CriticalAttackChanceScaledBonus: Real,
    CriticalAttackChanceUnscaledBonus: Real
}) {
}
export class SVeterancyLevel extends CStruct.Ex({
    InfoIcon: CImageLink,
    MinVeterancyXP: UInt32,
    Modification: SModification,
    LevelGainEffect: CEffectLink,
    LevelLossEffect: CEffectLink,
    RankNameSchema: CStringLink
}) {
}
export class SBehaviorFraction extends CStruct.Ex({
    Fraction: SAccumulatedFixed,
    TargetFilters: CTargetFilters
}) {
}
export class SEffectWhichTimeScale extends CStruct.Ex({
    Effect: CEffectLink,
    Value: EEffectTimeScale
}) {
}
export class SBehaviorDuration extends CStruct.Ex({
    Duration: SAccumulatedGameTime,
    ValidatorArray: [CValidatorLink]
}) {
}
export class SDamageResponse extends CStruct.Ex({
    ClampMaximum: Real,
    ClampMinimum: Real,
    Exhausted: CEffectLink,
    Evade: Bit,
    Fatal: Bit,
    Handled: CEffectLink,
    Ignore: [Real],
    Kind: FDamageKind,
    Location: EDamageLocation,
    Maximum: Real,
    Minimum: Real,
    ModifyAmount: SAccumulatedFixed,
    ModifyFraction: Real,
    ModifyLimit: Real,
    ModifyLimitVitalMaxFractionArray: { index: EUnitVital, value: Real },
    ModifyMinimumDamage: Bit,
    TargetFilters: CTargetFilters,
    RequireEffectArray: [CEffectLink],
    ExcludeEffectArray: [CEffectLink],
    RequireEffectInChainArray: [CEffectLink],
    ExcludeEffectInChainArray: [CEffectLink],
    ValidatorArray: [CValidatorLink],
    DamageValue: EDamageResponseDamageValue,
    ModifyScoreArray: [SScoreValueUpdate],
    Priority: Int8,
    ProvideCategories: FDamageResponseCategory,
    PreventCategories: FDamageResponseCategory,
    BlockChance: SAccumulatedFixed,
    DeflectChance: SAccumulatedFixed,
    MissingChance: SAccumulatedFixed,
    Chance: SAccumulatedFixed,
    Cost: SCost,
    AttackType: FAttackTypeResponse,
    DamageType: FDamageTypeResponse,
    HandledValue: EDamageResponseHandledValue
}) {
}
export class SVitalRegenVitalRemain extends CStruct.Ex({
    AmountMissing: Real,
    RegenModification: CGameRate
}) {
}
export class SAbilReplace extends CStruct.Ex({
    Origin: CAbilLink,
    New: CAbilLink
}) {
}
export class SAbilAdd extends CStruct.Ex({
    Abil: CAbilLink,
    OverrideCardId: Bit,
    CardId: CFourCC
}) {
}
export class SPowerStage extends CStruct.Ex({
    MaxStackCount: UInt32,
    MinPowerLevel: TPowerLevel,
    Modification: SModification,
    LevelGainEffect: CEffectLink,
    LevelLossEffect: CEffectLink,
    AbilReplace: [SAbilReplace],
    AbilAdd: [SAbilAdd]
}) {
}
export class SSpawnInfo extends CStruct.Ex({
    Unit: CUnitLink,
    Count: UInt32,
    MaxCount: UInt32,
    StartCount: UInt32,
    Requirements: CRequirementLink,
    Delay: CGameTime,
    Effect: CEffectLink
}) {
}
export class STooltipBlock extends CStruct.Ex({
    Validator: CValidatorLink,
    Text: CStringLink,
    Face: CButtonLink
}) {
}
export class STooltipTimeAbilCmd extends CStruct.Ex({
    AbilCmd: CAbilCommand
}) {
}
export class SButtonCardLayout extends CStruct.Ex({
    Row: UInt8,
    Column: UInt8,
    CardId: CFourCC
}) {
}
export class SCameraParam extends CStruct.Ex({
    Modify: Bit,
    Value: Real32
}) {
}
export class SCameraZoom extends CStruct.Ex({
    Param: { index: ESCameraZoomParam, value: SCameraParam }
}) {
}
export class SCameraSmooth extends CStruct.Ex({
    SmoothTimeMin: Real32,
    SmoothTimeMax: Real32,
    DisplacementMin: Real32,
    VelocityMax: Real32
}) {
}
export class SMovieConfig extends CStruct.Ex({
    Name: CStringLink,
    Path: CMovieFile,
    Source: CIdentifier
}) {
}
export class SCampaignData extends CStruct.Ex({
    Id: CString,
    Name: CStringLink,
    Subtitle: CStringLink,
    Description: CStringLink,
    ImagePath: CImageLink,
    LaunchMap: CString,
    ProgressLaunchMap: CString,
    TutorialMap: CString,
    SaveName: CString,
    CompletedSaveName: CString,
    PublishArchiveName: CString,
    ProgressAchievement: CAchievementLink,
    Movie: SMovieConfig,
    CampaignBanks: [CString],
    TransitionBanks: [CString],
    ShowArchivesButton: Bit,
    ArchiveDisabledTooltip: CStringLink,
    PrerequisiteCampaignId: CString,
    PrerequisitesNotMetTooltip: CStringLink,
    PromoProduct: TBattleProductId,
    PromoPurchaseWarningTitle: CStringLink,
    PromoPurchaseWarningMessage: CStringLink,
    PromoText: CStringLink,
    PromoTextCN: CStringLink,
    CinematicsImagePath: CImageLink,
    StorySoFarImagePath: CImageLink,
    StorySoFarMovie: SMovieConfig,
    SubPanelImage: CImageLink,
    SubPanelName: CStringLink,
    UnavailableMessageNotPurchased: CStringLink,
    UnavailableMessagePreReleaseOwned: CStringLink,
    UnavailableMessagePreReleaseNotOwned: CStringLink,
    CompletedCampaignImagePath: CImageLink,
    FeaturedImagePath: CImageLink,
    FeaturedDescription: CStringLink
}) {
}
export class SCharacterVariation extends CStruct.Ex({
    Name: CStringLink,
    Model: CModelLink,
    Actor: CActorLink,
    DefaultCategories: [CString]
}) {
}
export class SUIColorEntry extends CStruct.Ex({
    Value: { index: ESUIColorEntry, value: C4Vector }
}) {
}
export class SCommanderUnit extends CStruct.Ex({
    Unit: CUnitLink,
    Upgrade: CUnitLink
}) {
}
export class SCommanderTalentTree extends CStruct.Ex({
    Talent: CTalentLink,
    Unit: CUnitLink,
    Level: TCommanderLevel,
    Type: ECommanderTalentType,
    IsHidden: Bit
}) {
}
export class SCommanderMasteryTalent extends CStruct.Ex({
    Talent: CTalentLink,
    ValuePerRank: Real32,
    MaxRank: UInt32,
    Type: ECommanderMasteryTalentType,
    Bucket: UInt32,
    MinValuePrecision: UInt32,
    MaxValuePrecision: UInt32
}) {
}
export class SCommanderAbil extends CStruct.Ex({
    Abil: CAbilLink,
    Button: CButtonLink
}) {
}
export class SCommanderDifficultyLevel extends CStruct.Ex({
    DifficultyLevel: TDifficultyLevel,
    CommanderLevel: TCommanderLevel,
    Name: CStringLink,
    Description: CStringLink,
    BonusModifier: UInt32,
    IsDefault: Bit,
    Icon: CImageLink,
    AISkillLevel: TDifficultyLevel,
    BeyondBrutalLevel: UInt8,
    RequirePartyToQueue: Bit,
    IsRetry: Bit
}) {
}
export class SConsoleSkinModel extends CStruct.Ex({
    Model: CString,
    Position: C3Vector,
    Scale: C3Vector
}) {
}
export class SConversationUserValue extends CStruct.Ex({
    Type: CUserLink,
    Field: TUserFieldId,
    Index: Int32,
    Instance: TUserInstanceId
}) {
}
export class SConversationCondition extends CStruct.Ex({
    FixedId: TConversationStateOpId,
    State: CConversationStateLink,
    Index: TConversationStateIndexId,
    User: SConversationUserValue,
    Operation: EConversationConditionOp,
    Value: Int32
}) {
}
export class SConversationProductionLevel extends CStruct.Ex({
    SubtitlePrefix: CString,
    Flags: FConversationProductionLevel
}) {
}
export class SConversationConditionSet extends CStruct.Ex({
    Conditions: [SConversationCondition],
    Text: CStringLink
}) {
}
export class SConversationAction extends CStruct.Ex({
    FixedId: TConversationStateOpId,
    State: CConversationStateLink,
    Index: TConversationStateIndexId,
    User: SConversationUserValue,
    Operation: EConversationActionOp,
    Value: Int32
}) {
}
export class SConversationActionSet extends CStruct.Ex({
    Actions: [SConversationAction],
    Text: CStringLink
}) {
}
export class SConversationFacialAnim extends CStruct.Ex({
    Id: TConversationItemId,
    Text: CStringLink,
    SpeechTag: CString,
    SpeechAtts: CString,
    AnimTag: CString,
    AnimAtts: CString
}) {
}
export class SConversationLine extends CStruct.Ex({
    Id: TConversationItemId,
    Text: CStringLink,
    Comment: CString,
    FacialAnim: TConversationItemId,
    FacialBlend: UInt32,
    FacialAsVoiceDir: Bit,
    Sound: CSoundLink,
    SoundIndex: Int32,
    FixedDuration: UInt32,
    NoWait: Bit,
    OverlapPrevious: UInt32,
    AnimProps: CAnimProps,
    AnimBlendIn: Int32,
    AnimBlendOut: Int32,
    LookAtType: CString,
    LookAtAttach: CAttachMethods,
    Objects: { index: EConversationLineObjects, value: TConversationStateIndexId },
    Variations: { index: EConversationLineObjects, value: TConversationStateVariation },
    CustomSpeaker: CStringLink,
    SpeakerCharacter: CCharacterLink,
    SpeakerVariation: CString,
    ListenerCharacter: CCharacterLink,
    AltLine: Bit,
    AltLineMatchText: Bit,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition],
    Actions: [SConversationAction],
    CutsceneFile: CString,
    CutscenePosition: CGamePoInt3D,
    Tags: [TConversationTag]
}) {
}
export class SConversationRunActions extends CStruct.Ex({
    Id: TConversationItemId,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition],
    Actions: [SConversationAction]
}) {
}
export class SConversationWait extends CStruct.Ex({
    Id: TConversationItemId,
    Duration: UInt32,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition]
}) {
}
export class SConversationJump extends CStruct.Ex({
    Id: TConversationItemId,
    Location: TConversationItemId,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition]
}) {
}
export class SConversationChoice extends CStruct.Ex({
    Id: TConversationItemId,
    Text: CStringLink,
    Comment: CString,
    RequiresPrevious: Bit,
    Permanent: Bit,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition],
    Actions: [SConversationAction],
    Children: [TConversationItemId]
}) {
}
export class SConversationGroup extends CStruct.Ex({
    Id: TConversationItemId,
    Name: CStringLink,
    Comment: CString,
    ChoiceSelection: EConversationSelectionMethod,
    MaxChoices: UInt32,
    LineSelection: EConversationSelectionMethod,
    MaxLines: UInt32,
    PlayOnceOnly: Bit,
    NoWait: Bit,
    ChoiceCamera: TConversationStateIndexId,
    ConditionCheck: EConversationConditionCheck,
    Conditions: [SConversationCondition],
    Children: [TConversationItemId],
    CutsceneFile: CString,
    CutscenePosition: CGamePoInt3D,
    ApplyCutsceneToChildren: Bit,
    Tags: [TConversationTag]
}) {
}
export class SConversationComment extends CStruct.Ex({
    Id: TConversationItemId,
    Text: CStringLink
}) {
}
export class SConversationStateInfoText extends CStruct.Ex({
    Id: TConversationStateInfoId,
    Text: CStringLink
}) {
}
export class SConversationStateInfoValue extends CStruct.Ex({
    Id: TConversationStateInfoId,
    Value: Real
}) {
}
export class SConversationStateInfoModel extends CStruct.Ex({
    Id: TConversationStateInfoId,
    Model: CModelLink
}) {
}
export class SConversationStateInfoUpgrade extends CStruct.Ex({
    Id: TConversationStateInfoId,
    Upgrade: CUpgradeLink
}) {
}
export class SConversationStateInfoAbilCmd extends CStruct.Ex({
    Id: TConversationStateInfoId,
    Abil: CAbilLink,
    Cmd: TAbilCmdIndex
}) {
}
export class SConversationStateVariation extends CStruct.Ex({
    Value: TConversationStateVariation,
    DefaultCategories: [CString80]
}) {
}
export class SConversationStateInfoIds extends CStruct.Ex({
    Id: [TConversationStateInfoId]
}) {
}
export class SConversationStateIndex extends CStruct.Ex({
    Id: TConversationStateIndexId,
    Name: CStringLink,
    EditorPrefix: CStringLink,
    EditorSuffix: CStringLink,
    Color: CColor,
    ImagePath: CImageLink,
    ImageEdge: ETextTagEdge,
    ImageAttach: EAttachmentID,
    MoviePath: CMovieFile,
    InfoText: [SConversationStateInfoText],
    InfoValue: [SConversationStateInfoValue],
    InfoModel: [SConversationStateInfoModel],
    InfoUpgrade: [SConversationStateInfoUpgrade],
    InfoAbilCmd: [SConversationStateInfoAbilCmd],
    Variations: [SConversationStateVariation]
}) {
}
export class SDataCollectionRecord extends CStruct.Ex({
    Entry: CDataEntryPath
}) {
}
export class SUpgradeInfoWeapon extends CStruct.Ex({
    UpgradeWeapon: CWeaponLink,
    UpgradeEffect: CEffectLink,
    DamagePerDice: Real
}) {
}
export class SDataFieldsPattern extends CStruct.Ex({
    Reference: CCatalogReference,
    NameOverride: CStringLink,
    UserData: CIdentifier
}) {
}
export class SDataTokensPattern extends CStruct.Ex({
    Reference: CCatalogReference, //"Effect,^ParamId^@Damage,parent".  Effect,^ParamId^@Damage,AreaArray[2].Fraction
    NameOverride: CStringLink,
    UserData: CIdentifier
}) {
}
export class STextureSheetEntry extends CStruct.Ex({
    TextureSheet: CTextureSheetLink,
    Index: UInt32,
    Count: UInt32,
    DurationPerFrame: UInt32
}) {
}
export class SEffectDamageArea extends CStruct.Ex({
    Arc: CFangleArc,
    MaxCount: UInt32,
    Radius: Real,
    RectangleWidth: Real,
    RectangleHeight: Real,
    RadiusBonus: Real,
    FacingAdjustment: CFangle,
    Bonus: Real,
    Fraction: Real,
    Validator: CValidatorLink
}) {
}
export class SEffectSearchRevealerParams extends CStruct.Ex({
    RevealFlags: FEffectReveal,
    DetectFilters: CTargetFilters,
    RadarFilters: CTargetFilters,
    HeightMap: EHeightMap,
    Duration: CGameTime,
    ShapeExpansion: Real
}) {
}
export class SEffectEnumArea extends CStruct.Ex({
    Arc: CFangleArc,
    MaxCount: UInt32,
    Radius: Real,
    RectangleWidth: Real,
    RectangleHeight: Real,
    RadiusBonus: Real,
    FacingAdjustment: CFangle,
    Effect: CEffectLink
}) {
}
export class SEffectMover extends CStruct.Ex({
    Link: CMoverLink,
    IfRangeLTE: Real
}) {
}
export class SEffectMissileBounce extends CStruct.Ex({
    DistanceMultiplier: Real,
    ImpactEffect: CEffectLink,
    Offset: CEffectOffset
}) {
}
export class SUpgradeEffect extends CStruct.Ex({
    Operation: EUpgradeOperation,
    Reference: CCatalogReference,
    Value: TUpgradeEffectValue
}) {
}
export class SEffectUpgrade extends CStruct.Ex({
    Upgrade: CUpgradeLink,
    Count: Int8
}) {
}
export class SEffectModifyPlayerCost extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Abil: CAbilLink,
    Unit: SEffectWhichUnit
}) {
}
export class SEffectModifyUnitCost extends CStruct.Ex({
    Abil: CAbilCommand,
    Behavior: CBehaviorLink,
    Player: SEffectWhichPlayer,
    ChargeCountUse: Real,
    ChargeTimeUse: CGameTime,
    CooldownOperation: ECooldownOperation,
    CooldownTimeUse: CGameTime,
    Fraction: SCostFactor
}) {
}
export class SEffectModifyWeapon extends CStruct.Ex({
    Weapon: CWeaponLink,
    CooldownOperation: ECooldownOperation,
    CooldownAmount: CGameTime,
    CooldownFraction: Real
}) {
}
export class SEffectModifyVital extends CStruct.Ex({
    Change: SAccumulatedFixed,
    ChangeFraction: SAccumulatedFixed,
    ScoreArray: [SScoreValueUpdate]
}) {
}
export class SEffectModifyTurret extends CStruct.Ex({
    Action: EEffectModifyTurret,
    Turret: CTurretLink,
    Target: SEffectWhichLocation,
    Flags: FEffectModifyTurret,
    AimCompleteEffect: CEffectLink
}) {
}
export class SEffectSwitchCase extends CStruct.Ex({
    Validator: CValidatorLink,
    Effect: CEffectLink,
    FallThrough: Bit
}) {
}
export class SEmoticonPackCampaign extends CStruct.Ex({
    Campaign: CCampaignLink
}) {
}
export class SFootprintBitSet extends CStruct.Ex({
    Character: CString4,
    Positive: FPositive,
    Negative: FNegative
}) {
}
export class SFootprintLayer extends CStruct.Ex({
    Area: CiQuad,
    Sets: [SFootprintBitSet],
    Rows: [CString50]
}) {
}
export class SFootprintShape extends CStruct.Ex({
    Mode: EFootprintShapeMode,
    Radius: Real,
    Offsets: TFootprintOffsets,
    Borders: TFootprintBorders
}) {
}
export class SDifficultyLevel extends CStruct.Ex({
    AttributeId: CFourCC,
    Name: CStringLink,
    NameCampaign: CStringLink,
    NameMelee: CStringLink,
    MenuTooltip: CStringLink,
    Enabled: Bit,
    Flags: FDifficultyLevel,
    ActionsPerMinute: Int32,
    DefaultRebuildUnit: UInt8,
    DefaultRebuildStructure: UInt8
}) {
}
export class SAIBuild extends CStruct.Ex({
    AttributeId: CFourCC,
    Name: CStringLink,
    MenuTooltip: CStringLink,
    Enabled: Bit,
    Race: CRaceLink,
    MinDiff: TDifficulty,
    MaxDiff: TDifficulty,
    BuildScriptNum: Int32
}) {
}
export class SHandicap extends CStruct.Ex({
    MenuTooltip: CStringLink,
    Percent: THandicap
}) {
}
export class SMapSize extends CStruct.Ex({
    Name: CStringLink,
    MaxCells: UInt32
}) {
}
export class SAspectMargin extends CStruct.Ex({
    AspectWidth: UInt32,
    AspectHeight: UInt32,
    Margin: CiQuad
}) {
}
export class STeamColor extends CStruct.Ex({
    HDRMultiplier: Real32,
    Name: CStringLink,
    Value: { index: ETeamColor, value: C4Vector },
    UserChoice: Bit,
    MinPlayerCount: Int32,
    AttributeId: CFourCC
}) {
}
export class SAIDescription extends CStruct.Ex({
    Id: CFourCC,
    Name: CStringLink,
    File: CIdentifier,
    Suffix: CString32
}) {
}
export class STriggerLib extends CStruct.Ex({
    Id: TTriggerLibId,
    IncludePath: CString
}) {
}
export class STargetFilterResult extends CStruct.Ex({
    Filter: CTargetFilters,
    Result: TCmdResult
}) {
}
export class SBeaconInfo extends CStruct.Ex({
    Alert: CAlertLink,
    Unit: CUnitLink,
    Tooltip: CStringLink,
    Clear: FClear
}) {
}
export class SDamageTypeInfo extends CStruct.Ex({
    Category: EDamageCategory,
    SupportedFilters: CTargetFilters
}) {
}
export class SAttackTypeInfo extends CStruct.Ex({
    ArmorFactor: { index: EArmorType, value: Real },
    SupportedFilters: CTargetFilters,
    FailThroughToDamageType: Bit
}) {
}
export class SResourceConvert extends CStruct.Ex({
    RatioArray: { index: EResourceType, value: Real }
}) {
}
export class SMeleePointThreshold extends CStruct.Ex({
    Value: UInt32,
    Factor: Real
}) {
}
export class SChallenge extends CStruct.Ex({
    Id: CString,
    Name: CStringLink,
    Description: CStringLink,
    Score: CStringLink,
    MapPath: CMapFile,
    ThumbnailImagePath: CImageLink,
    Achievement: [CAchievementLink],
    IsAllowedInTrial: Bit
}) {
}
export class SChallengeCategory extends CStruct.Ex({
    Name: CStringLink,
    Challenge: [SChallenge]
}) {
}
export class SSoundQuality extends CStruct.Ex({
    AutoDetectCPUCoreMaximum: UInt32,
    Channels: UInt32,
    Flags: FSoundQuality,
    Name: CStringLink,
    Format: ESoundFormat,
    Resampler: ESoundResampler,
    SampleRate: UInt32,
    SpeakerMode: ESpeakerMode,
    VariationMaximum: { index: ESoundCategory, value: UInt32 }
}) {
}
export class SMinimapData extends CStruct.Ex({
    InnerBorderColor: CColor,
    OuterBorderColor: CColor,
    FrustumColor: CColor,
    ResourceUnitColor: CColor,
    ResourceUnitColorBlindColor: CColor,
    BlipUnitColor: CColor,
    UnitBorderColor: CColor,
    SelectedUnitBorderColor: CColor,
    BackGroundColor: CColor,
    BorderSize: Real32,
    SelectedBorderSize: Real32,
    MinUnitDotSize: Real32,
    RadarAlpha: UInt8
}) {
}
export class SSelectionData extends CStruct.Ex({
    SelectionWidth: Real32,
    SelectionFallOff: Real32,
    SelectionAlpha: C3Vector,
    SelectionTiming: C3Vector,
    SelectionSegmentCount: UInt32,
    SelectionSegmentPercentSolid: Real32,
    SelectionRotationSpeed: Real32,
    SelectionInnerOffsetRatio: Real32,
    SelectionInnerBoundaryRatio: Real32,
    SelectionInnerBoundaryFallOffRatio: Real32,
    PreselectionWidth: Real32,
    PreselectionFallOff: Real32,
    PreselectionAlpha: C3Vector,
    PreselectionTiming: C3Vector,
    PreselectionSegmentCount: UInt32,
    PreselectionSegmentPercentSolid: Real32,
    PreselectionRotationSpeed: Real32
}) {
}
export class SVolumeFade extends CStruct.Ex({
    Time: UInt32,
    Volume: CVolume
}) {
}
export class SReverbRolloff extends CStruct.Ex({
    Distance: Real32,
    Direct: Real32,
    Room: Real32
}) {
}
export class SVolumeThreshold extends CStruct.Ex({
    Count: UInt32,
    Volume: CVolume
}) {
}
export class SVolumeRolloff extends CStruct.Ex({
    Distance: Real32,
    Volume: CVolume
}) {
}
export class SSoundData extends CStruct.Ex({
    DupeFadeBlend: ESoundBlend,
    DupeFadeIn: [SVolumeFade],
    DupeFadeOut: [SVolumeFade],
    FogFadeBlend: ESoundBlend,
    FogFadeIn: [SVolumeFade],
    FogFadeOut: [SVolumeFade],
    MixerPriority: Int16,
    MixerPriorityNonLocal: Int16,
    Mute: Bit,
    MuteFadeBlend: ESoundBlend,
    MuteFadeIn: [SVolumeFade],
    MuteFadeOut: [SVolumeFade],
    ReverbRolloffBlend: ESoundBlend,
    ReverbRolloffPoints: [SReverbRolloff],
    Solo: Bit,
    ThresholdFadeTime: UInt32,
    ThresholdPoints: [SVolumeThreshold],
    Volume: CVolume,
    VolumeBaseline: CVolume,
    VolumeRolloffBlend: ESoundBlend,
    VolumeRolloffFadeBlend: ESoundBlend,
    VolumeRolloffFadeIn: [SVolumeFade],
    VolumeRolloffFadeOut: [SVolumeFade],
    VolumeRolloffPoints: [SVolumeRolloff],
    MaxFadeBlend: ESoundBlend,
    MaxFadeOut: [SVolumeFade],
    AlertFadeTimeOut: UInt32,
    AlertFadeTimeIn: UInt32,
    AlertFadeVolume: CVolumeRange,
    StartupDSPArray: [CDSPLink],
    DSPArray: [CDSPLink],
    Flags: FSoundData,
    MuteControl: EMuteControl,
    VolumeControl: EVolumeControl,
    LocalVolumeAdjustment: CVolumeRange,
    NonLocalVolumeAdjustment: CVolumeRange,
    CategoryDuckingFadeTimeIn: UInt32,
    CategoryDuckingFadeTimeOut: UInt32,
    CategoryDucking: [CVolume],
    CategoryDuckingNonLocal: [CVolume],
    MinimumDuckingLevel: CVolume,
    MaxMethod: ESoundMaxMethod,
    MaxCountPerPlayer: UInt16,
    MaxCountGlobal: UInt16,
    MaxPrioritization: ESoundMaxPrioritization
}) {
}
export class SMixRoute extends CStruct.Ex({
    ParentCategory: ESoundCategory
}) {
}
export class SGlobalSoundData extends CStruct.Ex({
    SoundDistanceFactor: Real32,
    SoundDopplerFactor: Real32,
    SoundRolloffFactor: Real32,
    HeadphoneModeMinAngle: Real32,
    HeadphoneModeMaxAngle: Real32,
    HeadphoneModeFrequency: Real32
}) {
}
export class SPointModel extends CStruct.Ex({
    Model: CModelFile,
    Scale: Real32,
    NameSize: UInt32,
    HeightOffset: Real32,
    SelectionOffset: C3Vector,
    SelectionRadius: Real32
}) {
}
export class SCameraShakeRotation extends CStruct.Ex({
    Yaw: Real32,
    Pitch: Real32,
    Roll: Real32
}) {
}
export class SCameraShakeFrequency extends CStruct.Ex({
    Id: CString80,
    Name: CStringLink,
    Position: C3Vector,
    Rotation: SCameraShakeRotation
}) {
}
export class SCameraShakeAmplitude extends CStruct.Ex({
    Id: CString80,
    Name: CStringLink,
    Position: C3Vector,
    Rotation: SCameraShakeRotation
}) {
}
export class SListenerRolloff extends CStruct.Ex({
    CameraValue: Real32,
    ListenerFactor: Real32
}) {
}
export class SUnitSpeedText extends CStruct.Ex({
    MinSpeed: CGameSpeed,
    Text: CStringLink
}) {
}
export class SWeaponSpeedText extends CStruct.Ex({
    MinSpeed: CGameTime,
    Text: CStringLink
}) {
}
export class SObjectGroupData extends CStruct.Ex({
    MinLevel: UInt32,
    MinimapIcon: CImageLink
}) {
}
export class SLoadingScreenHelp extends CStruct.Ex({
    Text: CStringLink,
    Race: CRaceLink
}) {
}
export class SLoadingBar extends CStruct.Ex({
    Name: CStringLink,
    FrameSuffix: CString
}) {
}
export class SGameModeInfo extends CStruct.Ex({
    Id: UInt32,
    CanOverrideText: Bit,
    IsTutorial: Bit,
    Name: CStringLink,
    Description: CStringLink
}) {
}
export class SGameCategory extends CStruct.Ex({
    Usage: EGameCategoryUsage,
    Info: SGameModeInfo,
    Modes: [SGameModeInfo]
}) {
}
export class SDefaultGameVariant extends CStruct.Ex({
    CategoryId: UInt32,
    ModeId: UInt32,
    MinPlayers: Int32,
    MaxPlayers: Int32,
    TeamCount: Int32,
    PlayersPerTeam: Int32,
    PlayersPerTandem: Int32,
    AIDifficulty: TDifficultyLevel,
    Options: FDefaultGameVariantOptions,
    AchievementTags: [CFourCC]
}) {
}
export class STutorialConfig extends CStruct.Ex({
    Title: CStringLink,
    Description: CStringLink,
    Icon: CImageLink,
    Movie: CMovieFile
}) {
}
export class SHotkeyInfo extends CStruct.Ex({
    Category: CStringLink,
    Name: CStringLink,
    Tooltip: CStringLink
}) {
}
export class SResourceUI extends CStruct.Ex({
    Icon: CImageLink,
    IconBackground: CImageLink,
    Tooltip: CStringLink
}) {
}
export class SHelpControlCategoryInfo extends CStruct.Ex({
    Name: CStringLink,
    Description: CStringLink
}) {
}
export class SHelpControlInfo extends CStruct.Ex({
    Category: CStringLink,
    Name: CStringLink,
    Description: CStringLink,
    Basic: Bit
}) {
}
export class SHelpGameMechanicInfo extends CStruct.Ex({
    Icon: CImageLink,
    IconBackground: CImageLink,
    Name: CStringLink,
    Description: CStringLink
}) {
}
export class SAltSoundtrack extends CStruct.Ex({
    AltSoundtrackName: CStringLink,
    Suffix: CString
}) {
}
export class SCutsceneAssetPath extends CStruct.Ex({
    Path: CCutsceneFile,
    Theme: EGlueTheme
}) {
}
export class SHerdLevel extends CStruct.Ex({
    Weight: Real32
}) {
}
export class SHerdNode extends CStruct.Ex({
    Weight: Real32,
    Link: CHerdNodeLink
}) {
}
export class SHeroAbilCategory extends CStruct.Ex({
    Name: CStringLink,
    Tooltip: CStringLink,
    Image: CImageLink,
    RequiredLevel: UInt32,
    State: EHeroAbilCategoryState,
    AbilArray: [CHeroAbilLink],
    UserReference: CUserReference
}) {
}
export class SHeroAbil extends CStruct.Ex({
    Abil: CAbilLink,
    Button: CButtonLink,
    Unit: CUnitLink,
    Flags: FHeroAbil
}) {
}
export class SHeroHeroicAbility extends CStruct.Ex({
    Abil: CAbilLink
}) {
}
export class SHeroSpecificVO extends CStruct.Ex({
    Target: CUnitLink,
    Sound: CSoundLink
}) {
}
export class SHeroTalentTree extends CStruct.Ex({
    Talent: CTalentLink,
    Tier: UInt32,
    Column: UInt32,
    PrerequisiteTalentArray: [CTalentLink]
}) {
}
export class SHeroTalentTier extends CStruct.Ex({
    Tier: UInt32,
    Level: UInt32
}) {
}
export class SHeroSpecificIntroVO extends CStruct.Ex({
    Target: CUnitLink,
    Question: CSoundLink,
    Response: CSoundLink
}) {
}
export class SHeroLevelModification extends CStruct.Ex({
    Catalog: EGameCatalog,
    Entry: CIdentifier,
    Field: CIdentifier,
    FieldIsInteger: Bit,
    Value: Real32,
    AffectedByAbilityPower: Bit,
    AffectedByOverdrive: Bit
}) {
}
export class SHeroLevelScaling extends CStruct.Ex({
    Ability: CAbilLink,
    Modifications: [SHeroLevelModification]
}) {
}
export class SHeroRatings extends CStruct.Ex({
    Damage: UInt8,
    Utility: UInt8,
    Survivability: UInt8,
    Complexity: UInt8
}) {
}
export class SHeroAITalentBuild extends CStruct.Ex({
    BuildType: EHeroAITalentBuildType,
    AIOnly: Bit,
    ChanceToPick: UInt8,
    MinDifficulty: TDifficulty,
    MaxDifficulty: TDifficulty,
    TalentsArray: [CTalentLink]
}) {
}
export class SHeroSpecificUI extends CStruct.Ex({
    Location: CIdentifier,
    Desname: CString
}) {
}
export class SHeroStatModifier extends CStruct.Ex({
    Stat: CHeroStatLink,
    Value: Int32,
    State: EHeroStatState
}) {
}
export class SItemContainerSlot extends CStruct.Ex({
    EmptyFace: CButtonLink,
    Classes: [CItemClassLink],
    Requirements: CRequirementLink,
    Equip: Bit,
    Row: UInt8,
    Column: UInt8
}) {
}
export class SFlareInfo extends CStruct.Ex({
    Model: CModelLink,
    Template: CIdentifier
}) {
}
export class STimeEvent extends CStruct.Ex({
    Time: CTimeOfDay,
    Name: CStringLink
}) {
}
export class SDirectionalLight extends CStruct.Ex({
    UseAmbientOcclusion: Bit,
    Color: C3Vector,
    ColorMultiplier: Real32,
    SpecularColor: C3Vector,
    SpecColorMultiplier: Real32,
    Direction: C3Vector
}) {
}
export class SVariationConfig extends CStruct.Ex({
    Command: EVariationCommands,
    Sensitivity: UInt32,
    Region: ETonemapRegionTypes
}) {
}
export class SLightRegionInfo extends CStruct.Ex({
    UseDefault: Bit,
    AmbientColor: C3Vector,
    AmbientEnvironmentMultiplier: Real32,
    DiffuseColor: { index: EDiffuseColor, value: C3Vector },
    DiffuseMultiplier: { index: EDiffuseMultiplier, value: Real32 },
    SpecularColor: C3Vector,
    SpecularMultiplier: Real32,
    FogColor: C3Vector
}) {
}
export class SLightInfo extends CStruct.Ex({
    Id: CIdentifier,
    TimeOfDay: CTimeOfDay,
    AmbientColor: C3Vector,
    AmbientEnvironmentMultiplier: Real32,
    OperatorHDR: Int8,
    TerrainUseBackLight: Bit,
    DirectionalLightShadows: Bit,
    CorrectGamma: Bit,
    Param: { index: ELightInfoParam, value: Real32 },
    DirectionalLight: { index: EDirectionalLight, value: SDirectionalLight },
    TriggerTransition: UInt32,
    Colorize: Bit,
    UseSeparateDetailSSAO: Bit,
    Variations: [SVariationConfig],
    LightRegions: [SLightRegionInfo]
}) {
}
export class SMissionCategory extends CStruct.Ex({
    Name: CStringLink,
    Map: CMapLink,
    Tooltip: CStringLink,
    CompletedTooltip: CStringLink,
    RewardImage: CImageLink,
    RewardTooltip: CStringLink,
    State: EMissionState
}) {
}
export class SLootChoice extends CStruct.Ex({
    Chance: UInt8,
    Child: CLootLink
}) {
}
export class SAnimFile extends CStruct.Ex({
    FilePath: CAnimsFile,
    Flags: FAnimFile
}) {
}
export class SAnimAlias extends CStruct.Ex({
    Anim: CAnimProps,
    Alias: CAnimProps
}) {
}
export class SAttachProps extends CStruct.Ex({
    Id: EAttachmentID,
    Keys: { index: ESAttachPropsKeys, value: TAttachPropIndex },
    SquibType: ESquibType,
    WeightExplicit: Real32,
    WeightFactor: Real32,
    RadiusTarget: Real32,
    RadiusShield: Real32
}) {
}
export class SModelDataEvent extends CStruct.Ex({
    Variation: Int32,
    Anim: CAnimProps,
    Name: CIdentifier,
    Type: EModelEvent,
    Time: Real32,
    Attachment: EAttachmentID,
    Payload: CSoundLink, // old-parser sc-schema CModel.Events[].Payload: 'sound'
    ModelQuality: EModelQuality
}) {
}
export class SPhysicsMaterialMapping extends CStruct.Ex({
    PhysicsMaterialInnate: EPhysicsMaterial,
    PhysicsMaterialOverride: CPhysicsMaterialLink
}) {
}
export class STextureNameAdaption extends CStruct.Ex({
    TriggerOnSubstring: CIdentifier,
    Slot: CTextureSlot,
    PropsAdd: CTextureProps,
    PropsRemove: CTextureProps,
    PropsSet: CTextureProps,
    AppliesToInnate: Bit,
    AppliesToFile: Bit
}) {
}
export class STextureDeclare extends CStruct.Ex({
    Prefix: CIdentifier,
    Slot: CTextureSlot,
    Adaptions: [STextureNameAdaption]
}) {
}
export class STextureInfo extends CStruct.Ex({
    Slot: CTextureSlot,
    Expression: CTextureExpression,
    Probability: UInt32
}) {
}
export class STextureExpressionSpec extends CStruct.Ex({
    Slot: CTextureSlot,
    Expression: CTextureExpression
}) {
}
export class STextureMatchSpec extends CStruct.Ex({
    Slot: CTextureSlot,
    Source: CTextureSlot
}) {
}
export class SModelVariation extends CStruct.Ex({
    Number: Int32,
    Probability: UInt32,
    Radius: Real32,
    RadiusLoose: Real32,
    PhysicsForceFactor: Real32,
    PhysicsDeathMotionFactor: CVariatorActorReal32,
    TextureAppliedGroups: CTextureProps,
    TextureExpressionsForEditor: [STextureExpressionSpec],
    TextureMatchesForEditor: [STextureMatchSpec]
}) {
}
export class SPathingData extends CStruct.Ex({
    Bits: FPathingDataBits
}) {
}
export class SMotionOverlayPhase extends CStruct.Ex({
    Scale: CVariatorGameFixed
}) {
}
export class SMotionPhase extends CStruct.Ex({
    Driver: EMotionDriverType,
    Acceleration: CMissileAcceleration,
    AccelerationRange: CMissileAcceleration,
    Speed: CMissileSpeed,
    SpeedRange: CMissileSpeed,
    MinSpeed: CMissileSpeed,
    MaxSpeed: CMissileSpeed,
    Gravity: Real,
    Clearance: Real,
    ClearanceLookahead: Real,
    ClearanceAcceleration: CMissileAcceleration,
    ClearanceIgnoresTargetProximity: Bit,
    IgnoresTerrain: Bit,
    TurnType: EMotionTurnType,
    ActorTracking: EMotionActorTrackingType,
    ArrivalTestType: EMotionArrivalTestType,
    BlendType: EMotionBlendType,
    Outro: CPhaseOutro,
    RotationLaunchActorType: EMotionRotationLaunchActorType,
    RotationActorType: EMotionRotationActorType,
    Timeout: Real,
    ThrowRotationType: EMotionThrowRotationType,
    ThrowVector: C3fVector,
    ThrowBandYaw: CThrowBand,
    ThrowBandPitch: CThrowBand,
    ThrowForward: C3fVector,
    AdaptableParabolaIsUpright: Bit,
    AdaptableParabolaClearance: CVariatorGameFixed,
    AdaptableParabolaDistances: { index: EAdaptableParabolaDistances, value: Real },
    AdaptableParabolaAccels: { index: EAdaptableParabolaAccels, value: CMissileAcceleration },
    YawPitchRoll: CYawPitchRoll,
    YawPitchRollRange: CYawPitchRoll,
    YawPitchRollAccel: CYawPitchRoll,
    YawPitchRollAccelRange: CYawPitchRoll,
    PowerslideAngle: CFangle,
    PowerslideDecel: CMissileAcceleration,
    FlightTime: CVariatorGameFixed,
    OutroAltitude: CPhaseOutro,
    Overlays: [SMotionOverlayPhase]
}) {
}
export class SMotionOverlay extends CStruct.Ex({
    Type: EMotionOverlayType,
    Polarity: EMotionOverlayPolarity,
    PolarityDriver: CDataSoupKey,
    Axis: C3fVector,
    Wavelength: CVariatorGameFixed,
    WavelengthChangeProbability: Real,
    RevolverSpeed: CFangleRateMissile,
    RevolverSpeedRange: CFangleRateMissile,
    RevolverMaxSpeed: CFangleRateMissile,
    RevolverMaxSpeedRange: CFangleRateMissile,
    RevolverAccel: CFangleAccelMissile,
    RevolverAccelRange: CFangleAccelMissile
}) {
}
export class SStartingUnit extends CStruct.Ex({
    Count: UInt32,
    Flags: FStartingUnit,
    Offset: [CGamePoint],
    Range: Real,
    Unit: CUnitLink
}) {
}
export class SUpkeepTax extends CStruct.Ex({
    FoodLevel: UInt32,
    Tax: { index: EResourceType, value: Real }
}) {
}
export class SRequirementNode extends CStruct.Ex({
    Link: CRequirementNodeLink
}) {
}
export class SRequirementCount extends CStruct.Ex({
    Link: TTechAlias,
    State: ERequirementState,
    Unlock: TTechAlias
}) {
}
// Per-node-class Count.Link target namespaces (old-parser sc-schema:
// CRequirementCountUpgrade.Count.Link='upgrade', CountUnit='unit', CountBehavior='behavior', …)
export class SRequirementCountAbil extends CStruct.Ex({
    Link: CAbilLink, State: ERequirementState, Unlock: CAbilLink
}) {
}
export class SRequirementCountBehavior extends CStruct.Ex({
    Link: CBehaviorLink, State: ERequirementState, Unlock: CBehaviorLink
}) {
}
export class SRequirementCountEffect extends CStruct.Ex({
    Link: CEffectLink, State: ERequirementState, Unlock: CEffectLink
}) {
}
export class SRequirementCountUnit extends CStruct.Ex({
    Link: CUnitLink, State: ERequirementState, Unlock: CUnitLink
}) {
}
export class SRequirementCountUpgrade extends CStruct.Ex({
    Link: CUpgradeLink, State: ERequirementState, Unlock: CUpgradeLink
}) {
}
export class SRewardCategory extends CStruct.Ex({
    File: CString,
    Tag: CFourCC
}) {
}
export class SRewardSpecificUI extends CStruct.Ex({
    Location: CIdentifier,
    Desname: CString
}) {
}
export class SGameReplacement extends CStruct.Ex({
    Catalog: EGameCatalog,
    From: CIdentifier,
    To: CIdentifier
}) {
}
export class SSkinModelGroup extends CStruct.Ex({
    Name: CIdentifier,
    Models: [CModelLink]
}) {
}
export class SSkinModelMacroRun extends CStruct.Ex({
    Models: CIdentifier,
    Macro: CActorLink
}) {
}
export class SSkinPackEntry extends CStruct.Ex({
    Unit: CUnitLink,
    Reward: CRewardLink,
    UnitAlternate: CUnitLink,
    RewardAlternate: CRewardLink
}) {
}
export class SSyncPointRange extends CStruct.Ex({
    BarAndBeat: C2iVector,
    TimeSignature: C2iVector,
    BeatsPerMinute: UInt16,
    SyncPointsPerBar: UInt16
}) {
}
export class SSoundAsset extends CStruct.Ex({
    TemplateParam: CString,
    File: CSoundFile,
    LoopCount: Int32,
    LoopTime: CiRange,
    Offset: CiRange,
    Pitch: CPitchRange,
    SyncPoints: [UInt32],
    SyncPointRanges: [SSyncPointRange],
    Volume: CVolumeRange,
    Weight: TSoundWeight,
    FacialAnim: CIdentifier,
    FacialGroup: CIdentifier,
    PortraitAnim: CIdentifier,
    FacialFile: CFacialFile,
    PortraitModel: CModelLink,
    PortraitActor: CActorLink,
    Speaker: CStringLink,
    Subtitle: CStringLink
}) {
}
export class SSoundAssetTemplate extends CStruct.Ex({
    File: CIdentifier,
    FacialAnim: CIdentifier,
    FacialGroup: CIdentifier,
    FacialFile: CIdentifier,
    PortraitAnim: CIdentifier
}) {
}
export class SSoundLocaleFlags extends CStruct.Ex({
    Locale: TLocaleId,
    Flags: FSoundLocaleFlags
}) {
}
export class SPitchShift extends CStruct.Ex({
    Time: UInt32,
    Pitch: CPitch
}) {
}
export class SReverbBalance extends CStruct.Ex({
    Direct: TSoundBalance,
    Room: TSoundBalance
}) {
}
export class SSoundtrackMasterLayer extends CStruct.Ex({
    Sound: CSoundLink
}) {
}
export class SSoundtrackSection extends CStruct.Ex({
    Chance: Real32,
    Sound: CSoundLink,
    Start: UInt32
}) {
}
export class SSoundtrackSlaveLayer extends CStruct.Ex({
    Sections: [SSoundtrackSection]
}) {
}
export class SSoundtrackCue extends CStruct.Ex({
    MasterLayer: SSoundtrackMasterLayer,
    SlaveLayers: [SSoundtrackSlaveLayer],
    Weight: TSoundWeight
}) {
}
export class STacAbilData extends CStruct.Ex({
    AbilLink: CAbilLink,
    Cooldown: [Real]
}) {
}
export class STalentRank extends CStruct.Ex({
    Face: CButtonLink,
    Item: CUnitLink,
    Upgrade: CUpgradeLink,
    BehaviorArray: [CBehaviorLink],
    AbilityPower: Real,
    CooldownReduction: Real,
    AttackDamage: Real,
    AttackSpeed: Real,
    Life: Real,
    Energy: Real,
    Shields: Real,
    LifeRegenRate: CGameRate,
    EnergyRegenRate: CGameRate,
    ShieldRegenRate: CGameRate,
    MovementSpeed: Real,
    LifeLeech: Real,
    SiegeDamage: Real,
    LifeRegenRateFraction: Real,
    CrowdControlReduction: Real,
    DeathTimerReduction: Real,
    AmplifiedHealing: Real,
    MountSpeed: Real
}) {
}
export class STalentModification extends CStruct.Ex({
    Type: ETalentModification,
    Catalog: EGameCatalog,
    Entry: CIdentifier,
    Field: CIdentifier,
    FieldIsInteger: Bit,
    Value: Real32,
    StringReplacement: CString
}) {
}
export class STalentAbilityModification extends CStruct.Ex({
    ModifyAbil: CAbilLink,
    OriginalAbilButton: CButtonLink,
    ModifiedAbilButton: CButtonLink,
    Modifications: [STalentModification],
    TooltipAddendum: CStringLink
}) {
}
export class STargetFindEnumArea extends CStruct.Ex({
    Arc: CFangleArc,
    MaxCount: UInt32,
    Radius: Real,
    RadiusBonus: Real,
    Validator: CValidatorLink
}) {
}
export class SDSPArray extends CStruct.Ex({
    LinkArray: [CDSPLink]
}) {
}
export class SCreepSettings extends CStruct.Ex({
    CreepOpaqueAlphaThreshold: Real32,
    CreepTranslucentMinThreshold: Real32,
    CreepTranslucentMaxThreshold: Real32,
    CreepNoiseSpeed: Real32,
    CreepNoiseTiling: Real32,
    CreepHeightMapStrength: Real32,
    CreepNoiseStrength: Real32,
    CreepBaseTextureTileValue: C2Vector,
    CreepBaseNormalMapTileValue: C2Vector,
    CreepEdgeNormalMapTileValue: C2Vector,
    CreepEdgeNormalMapMinRampThreshold: Real32,
    CreepTranslucentPassTint: C3Vector,
    CreepTranslucentPassEmissiveFactor: C3Vector,
    CreepDiffuseColorTint: C3Vector,
    CreepTextureRotation: Real32,
    CreepGroundNormalBlend: Real32
}) {
}
export class SFoliageSimulationConfig extends CStruct.Ex({
    SamplingDistance: { index: ESamplingDistance, value: Real32 },
    AcceptWorldForces: FAcceptWorldForces
}) {
}
export class STerrainDoodad extends CStruct.Ex({
    Model: CModelLink,
    RandomRotation: Bit,
    Probability: Real32,
    PlacementRadius: Real32
}) {
}
export class SFidget extends CStruct.Ex({
    ChanceArray: { index: EChance, value: UInt8 },
    DelayMax: CGameTime,
    DelayMin: CGameTime,
    DistanceMax: Real,
    DistanceMin: Real,
    TurnAngle: CFangle,
    TurningRate: CFangleRate
}) {
}
export class SUnitArmorFormula extends CStruct.Ex({
    NegativeArmorMultiplier: Real,
    NegativeDamageBase: Real,
    NegativeDamageUnscaled: Real,
    PositiveArmorMultiplier: Real,
    PositiveDamageRatio: Real
}) {
}
export class SStockCharge extends CStruct.Ex({
    CountMax: Real,
    TimeDelay: CGameTime,
    TimeUse: CGameTime
}) {
}
export class SUnitAbilData extends CStruct.Ex({
    Link: CAbilLink
}) {
}
export class SUnitBehaviorData extends CStruct.Ex({
    Link: CBehaviorLink
}) {
}
export class SCardLayoutButton extends CStruct.Ex({
    Face: CButtonLink,
    Type: ECardButtonType,
    AbilCmd: CAbilCommand,
    Behavior: CBehaviorLink,
    Requirements: CRequirementLink,
    SubmenuAbilState: CAbilLink,
    SubmenuCardId: CCardId,
    SubmenuFullSubCmdValidation: Bit,
    SubmenuIsSticky: Bit,
    ShowInGlossary: Bit,
    Row: UInt8,
    Column: UInt8
}) {
}
export class SCardLayout extends CStruct.Ex({
    CardId: CCardId,
    LayoutButtons: [SCardLayoutButton],
    RowText: [CStringLink]
}) {
}
export class SAddedOnData extends CStruct.Ex({
    UnitLink: CUnitLink,
    BehaviorLink: CBehaviorLink,
    ParentBehaviorLink: CBehaviorLink
}) {
}
export class SUnitEquipment extends CStruct.Ex({
    Effect: CEffectLink,
    Icon: CImageLink,
    Name: CStringLink,
    Tooltip: CStringLink,
    Weapon: CWeaponLink
}) {
}
export class SUnitReviveInfo extends CStruct.Ex({
    Resource: { index: EResourceType, value: Int32 },
    Display: FDisplay,
    Vital: { index: EUnitVital, value: Real },
    VitalFraction: { index: EUnitVital, value: Real },
    Charge: SCharge,
    Cooldown: SCooldown,
    Time: CGameTime
}) {
}
export class SAttributePointsInfo extends CStruct.Ex({
    Attribute: CBehaviorLink,
    Points: Int32,
    PointsPerLevel: Real
}) {
}
export class SUpgradeEffectTemplate extends CStruct.Ex({
    Operation: EUpgradeOperation,
    Reference: CCatalogReference, //CCatalogReference?
    Value: CString
}) {
}
export class SValidatorCondition extends CStruct.Ex({
    Test: CValidatorLink,
    Return: CValidatorLink
}) {
}
export class SValidatorFunction extends CStruct.Ex({
    Test: CValidatorLink,
    Return: CValidatorLink,
    Success: CValidatorLink,
    Failure: CValidatorLink,
    Ignored: CValidatorLink,
    Break: Bit
}) {
}
export class SValidatorEnumArea extends CStruct.Ex({
    Arc: CFangleArc,
    Compare: EValueCompare,
    Count: UInt32,
    Radius: Real,
    RadiusBonus: Real,
    Validator: CValidatorLink
}) {
}
export class SVoiceOverSkin extends CStruct.Ex({
    Id: TVoiceOverSkinId,
    State: EVoiceOverSkinState
}) {
}
export class SVoiceOverGroup extends CStruct.Ex({
    Id: TVoiceOverGroupId,
    SoundParent: CSoundLink
}) {
}
export class SVoiceOverLine extends CStruct.Ex({
    Group: TVoiceOverGroupId,
    SoundIndex: Int32,
    SoundType: EVoiceOverSoundType,
    SoundText: CString,
    Comment: CString,
    FacialAnim: CString,
    FacialBlend: UInt32,
    FacialAsVoiceDir: Bit,
    Skins: [SVoiceOverSkin]
}) {
}
export class SVoicePackExampleLine extends CStruct.Ex({
    Description: CStringLink,
    Sound: CSoundLink
}) {
}
export class SUserInstanceField extends CStruct.Ex({
    Id: TUserFieldId,
    Index: UInt32
}) {
}
export class SUserInstanceItem extends CStruct.Ex({
    Field: SUserInstanceField,
    Index: UInt32
}) {
}
export class SUserInstanceAbilCmd extends SUserInstanceItem.Ex({
    Abil: CAbilLink,
    Cmd: TAbilCmdIndex
}) {
}
export class SUserInstanceActor extends SUserInstanceItem.Ex({
    Actor: CActorLink
}) {
}
export class SUserInstanceColor extends SUserInstanceItem.Ex({
    Color: CColor
}) {
}
export class SUserInstanceCompare extends SUserInstanceItem.Ex({
    Compare: EValueCompare
}) {
}
export class SUserInstanceFixed extends SUserInstanceItem.Ex({
    Fixed: Real
}) {
}
export class SUserInstanceGameLink extends SUserInstanceItem.Ex({
    GameLink: CString
}) {
}
export class SUserInstanceImage extends SUserInstanceItem.Ex({
    Image: CImageLink,
    Edge: ETextTagEdge,
    Attach: EAttachmentID
}) {
}
export class SUserInstanceInt extends SUserInstanceItem.Ex({
    Int: Int32
}) {
}
export class SUserInstanceModel extends SUserInstanceItem.Ex({
    Model: CModelLink
}) {
}
export class SUserInstanceMovie extends SUserInstanceItem.Ex({
    Movie: CMovieFile
}) {
}
export class SUserInstanceSound extends SUserInstanceItem.Ex({
    Sound: CSoundLink
}) {
}
export class SUserInstanceString extends SUserInstanceItem.Ex({
    String: CString
}) {
}
export class SUserInstanceText extends SUserInstanceItem.Ex({
    Text: CStringLink
}) {
}
export class SUserInstanceUnit extends SUserInstanceItem.Ex({
    Unit: CUnitLink
}) {
}
export class SUserInstanceUpgrade extends SUserInstanceItem.Ex({
    Upgrade: CUpgradeLink
}) {
}
export class SUserInstanceUser extends SUserInstanceItem.Ex({
    Type: CUserLink,
    Instance: TUserInstanceId
}) {
}
export class SUserField extends CStruct.Ex({
    Id: TUserFieldId,
    Type: EUserType,
    GameLinkType: EGameCatalog,
    UserType: CUserLink,
    Count: UInt32,
    Flags: FUserField,
    EditorColumn: UInt32,
    EditorText: EEditorTextType
}) {
}
export class SUserInstance extends CStruct.Ex({
    Id: TUserInstanceId,
    AbilCmd: [SUserInstanceAbilCmd],
    Actor: [SUserInstanceActor],
    Color: [SUserInstanceColor],
    Compare: [SUserInstanceCompare],
    Fixed: [SUserInstanceFixed],
    GameLink: [SUserInstanceGameLink],
    Image: [SUserInstanceImage],
    Int: [SUserInstanceInt],
    Model: [SUserInstanceModel],
    Movie: [SUserInstanceMovie],
    Sound: [SUserInstanceSound],
    String: [SUserInstanceString],
    Text: [SUserInstanceText],
    Unit: [SUserInstanceUnit],
    Upgrade: [SUserInstanceUpgrade],
    User: [SUserInstanceUser]
}) {
}
export class SWaterStateDesc extends CStruct.Ex({
    Name: CString32,
    Height: Real32,
    Color: C4Vector,
    ColorFallOff: Real32,
    CausticsFallOff: Real32,
    Specularity: Real32,
    SpecularScaler: Real32,
    UvRate: C4Vector,
    UvRotate: Real32,
    MeshRoughness: Real32,
    TextureRoughness: Real32,
    ReflectionDistortion: Real32,
    RefractionDistortion: Real32,
    ShadowDistortion: Real32,
    MinReflection: Real32,
    ReflectivityPower: Real32
}) {
}
export class SWaterDoodad extends CStruct.Ex({
    Model: CModelLink,
    Density: Real32,
    MinSize: Real32,
    MaxSize: Real32,
    Lifetime: UInt32
}) {
}
export const DATA_STRUCT_SCHEMA = { SGameContentCreationData, SProductReleaseDate, SAbilOrderDisplay, SEffectBehavior, SCooldown, SCharge, SCost, SCostFactor, STargetSorts, SMarker, SAbilTargetCursorInfo, SAbilCmdButton, SAbilArmMagazineInfo, SAbilBuildInfo, SAbilInventoryInfo, SAbilLearnInfo, SAbilMergeInfo, SAbilMorphSection, SAbilMorphInfo, SAbilPawnInfo, SAbilRallyInfo, SAbilResearchInfo, SAbilReviveCmdButton, SAbilReviveInfo, SAbilReviveInfoMax, SAbilSpecializeInfo, SAbilTrainInfo, SAbilWarpTrainInfo, SEffectWhichUnit, SEffectWhichLocation, SEffectWhichBehavior, SAccumulatorSwitchCase, SAccumulatedFixed, SAccumulatedUInt32, SAccumulatedGameRate, SAccumulatedGameTime, SEffectWhichPlayer, SAchievementTag, SActorRequest, SActorVisibilityShape, SActorEvent, SActorSiteOpsData, SActorModelAspect, SActorModelAspectSet, SAttachQuery, SActorHostedAttach, SEventDataFootprint, SEventDataSound, SActorPhysicsImpactData, SActorRangeAbil, SActorQuadDecoration, SActorSoundLayer, SActorAVPair, SActorActionTerrainSquib, SActorAVCluster, SActorPhysicsData, SActorQuerySubject, SActorQueryResponse, SActorSendBasics, SActorQuerySubjectResponse, SActorDeathBodySquib, SActorCloakState, SActorCloakTransition, SActorCreepHeightClass, SActorCreepRate, SActorDeathData, SActorDeathDataCustom, SLookAtTypeInfo, SLookAtType, SSplatEmitterMaterialInfo, SSplatEmitterInitInfo, SActorOverrideBlendTime, SActorOverrideTransitionBlendTime, SActorOverrideModel, SActorProgressStage, SActorHostedDelta, SSerpentAggregate, SSerpentSegment, SActorStateInfo, SActorBaseline, SActorDeathDataCustomGroup, SActorUnitImpactSoundExtras, SDamagePastRemainingHealth, SDamageOverInterval, STerrainSquibVisual, STerrainSquib, SUnitAbilSound, SErrorOverride, SLayerIcon, SLayerIconVariation, SLayerIconShield, SLayerIconShieldVariation, SVitalColor, SIconVariation, SStatusColor, SStatusChargeData, SStatusHarvesterData, STextTagParameters, SUnitKillRank, SBankPath, SArtifactRank, SAttachKey, SDeathResponse, SAttributeChange, SDamageKind, SScoreValueUpdate, SUnitResourceRatio, SUnitWeaponData, SModification, SVeterancyLevel, SBehaviorFraction, SEffectWhichTimeScale, SBehaviorDuration, SDamageResponse, SVitalRegenVitalRemain, SAbilReplace, SAbilAdd, SPowerStage, SSpawnInfo, STooltipBlock, STooltipTimeAbilCmd, SButtonCardLayout, SCameraParam, SCameraZoom, SCameraSmooth, SMovieConfig, SCampaignData, SCharacterVariation, SUIColorEntry, SCommanderUnit, SCommanderTalentTree, SCommanderMasteryTalent, SCommanderAbil, SCommanderDifficultyLevel, SConsoleSkinModel, SConversationUserValue, SConversationCondition, SConversationProductionLevel, SConversationConditionSet, SConversationAction, SConversationActionSet, SConversationFacialAnim, SConversationLine, SConversationRunActions, SConversationWait, SConversationJump, SConversationChoice, SConversationGroup, SConversationComment, SConversationStateInfoText, SConversationStateInfoValue, SConversationStateInfoModel, SConversationStateInfoUpgrade, SConversationStateInfoAbilCmd, SConversationStateVariation, SConversationStateInfoIds, SConversationStateIndex, SDataCollectionRecord, SUpgradeInfoWeapon, SDataFieldsPattern, SDataTokensPattern, STextureSheetEntry, SEffectDamageArea, SEffectSearchRevealerParams, SEffectEnumArea, SEffectMover, SEffectMissileBounce, SUpgradeEffect, SEffectUpgrade, SEffectModifyPlayerCost, SEffectModifyUnitCost, SEffectModifyWeapon, SEffectModifyVital, SEffectModifyTurret, SEffectSwitchCase, SEmoticonPackCampaign, SFootprintBitSet, SFootprintLayer, SFootprintShape, SDifficultyLevel, SAIBuild, SHandicap, SMapSize, SAspectMargin, STeamColor, SAIDescription, STriggerLib, STargetFilterResult, SBeaconInfo, SDamageTypeInfo, SAttackTypeInfo, SResourceConvert, SMeleePointThreshold, SChallenge, SChallengeCategory, SSoundQuality, SMinimapData, SSelectionData, SVolumeFade, SReverbRolloff, SVolumeThreshold, SVolumeRolloff, SSoundData, SMixRoute, SGlobalSoundData, SPointModel, SCameraShakeRotation, SCameraShakeFrequency, SCameraShakeAmplitude, SListenerRolloff, SUnitSpeedText, SWeaponSpeedText, SObjectGroupData, SLoadingScreenHelp, SLoadingBar, SGameModeInfo, SGameCategory, SDefaultGameVariant, STutorialConfig, SHotkeyInfo, SResourceUI, SHelpControlCategoryInfo, SHelpControlInfo, SHelpGameMechanicInfo, SAltSoundtrack, SCutsceneAssetPath, SHerdLevel, SHerdNode, SHeroAbilCategory, SHeroAbil, SHeroHeroicAbility, SHeroSpecificVO, SHeroTalentTree, SHeroTalentTier, SHeroSpecificIntroVO, SHeroLevelModification, SHeroLevelScaling, SHeroRatings, SHeroAITalentBuild, SHeroSpecificUI, SHeroStatModifier, SItemContainerSlot, SFlareInfo, STimeEvent, SDirectionalLight, SVariationConfig, SLightRegionInfo, SLightInfo, SMissionCategory, SLootChoice, SAnimFile, SAnimAlias, SAttachProps, SModelDataEvent, SPhysicsMaterialMapping, STextureNameAdaption, STextureDeclare, STextureInfo, STextureExpressionSpec, STextureMatchSpec, SModelVariation, SPathingData, SMotionOverlayPhase, SMotionPhase, SMotionOverlay, SStartingUnit, SUpkeepTax, SRequirementNode, SRequirementCount, SRewardCategory, SRewardSpecificUI, SGameReplacement, SSkinModelGroup, SSkinModelMacroRun, SSkinPackEntry, SSyncPointRange, SSoundAsset, SSoundAssetTemplate, SSoundLocaleFlags, SPitchShift, SReverbBalance, SSoundtrackMasterLayer, SSoundtrackSection, SSoundtrackSlaveLayer, SSoundtrackCue, STacAbilData, STalentRank, STalentModification, STalentAbilityModification, STargetFindEnumArea, SDSPArray, SCreepSettings, SFoliageSimulationConfig, STerrainDoodad, SFidget, SUnitArmorFormula, SStockCharge, SUnitAbilData, SUnitBehaviorData, SCardLayoutButton, SCardLayout, SAddedOnData, SUnitEquipment, SUnitReviveInfo, SAttributePointsInfo, SUpgradeEffectTemplate, SValidatorCondition, SValidatorFunction, SValidatorEnumArea, SVoiceOverSkin, SVoiceOverGroup, SVoiceOverLine, SVoicePackExampleLine, SUserInstanceField, SUserInstanceAbilCmd, SUserInstanceActor, SUserInstanceColor, SUserInstanceCompare, SUserInstanceFixed, SUserInstanceGameLink, SUserInstanceImage, SUserInstanceInt, SUserInstanceModel, SUserInstanceMovie, SUserInstanceSound, SUserInstanceString, SUserInstanceText, SUserInstanceUnit, SUserInstanceUpgrade, SUserInstanceUser, SUserField, SUserInstance, SWaterStateDesc, SWaterDoodad };
