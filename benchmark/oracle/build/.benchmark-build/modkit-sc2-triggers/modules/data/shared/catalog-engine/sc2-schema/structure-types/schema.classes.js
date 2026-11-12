import { CBooleanAttribute, CClassName, CNamespaceClassLink, CTokenDefinitions, CTokenValues, TEditorCategories, CTargetFilters, CCmdResult, CAbilCommand, CDataSoupKey, CActorKey, CActorTerms, CRefKey, EAttachmentID, CUserReference, CDataEntryPath, TCatalogFieldPath, CActorAttributePath } from "./schema.complex.js";
import { CObject } from "./schema.core.js";
import { ECostDisplay, EAbilArmMagazineEffect, EAbilTechPlayer, EAbilAlignment, EUnitVital, EAcquireLevel, EAlertArray, EProgressButtonArray, ECursorRangeMode, EAbilLastTarget, ECancelEffect, ECancelDelay, EAbilArmMagazineLaunch, EAbilArmMagazineCmd, EEffectArray, EAbilAttackCmd, EAbilAugmentCmd, EEffectLocationType, EAbilAttackModifierCmd, EAbilBatteryCmd, EAbilBeaconCmd, EAbilBehaviorCmd, EAbilBehaviorCycleMode, EAbilBuildCmd, EAbilBuildType, EAbilBuildableCmd, EAbilEffectInstantCmd, EAbilEffectTargetCmd, EAbilHarvestCmd, EResourceType, EAbilInteractCmd, EAbilInventoryCmd, EAbilLearnCmd, EAbilMergeCmd, EAbilMergeableCmd, EAbilMorphCmd, EAbilMoveCmd, EAbilPawnCmd, EAbilQueueCmd, EAbilRallyCmd, EAbilRedirectInstantCmd, EAbilRedirectTargetCmd, EAbilResearchCmd, EAbilReviveCmd, EAbilReviveVital, EDeathType, EAbilSpecializeCmd, EAbilStopCmd, EAbilTrainCmd, EAbilTransportCmd, EAbilWarpableCmd, EAccumulatorApplicationRule, EVitalsAccumulatorModificationType, EAccumulatorBehaviorType, ECargoSpace, EEffectAmount, EAccumulatorOperation, EAchievementTermEvaluate, EValueCompare, EAchievementTermPrevious, EAchievementTermCombine, EActorRequestCreateSharing, EActorHostedPropInheritType, EFogVisibility, EActorPlayerIdSource, EActorScopeBearingsTrackingType, EActorSplatHeight, EActorProximity, EActorModelMaterialType, EActorForceField, EActorSoundPlayMode, ESplatLayer, EActorEffectScope, EImpactMap, EDamageMap, EActorShieldFlashType, EActorCombatRevealDurationType, EBoostedHeight, EMinimapShape, EActorForceOrigin, EActorForceDirection, ECloakTransitionArray, ESquibType, EActorSiteBillboardType, EActorSiteOrbiterType, EActorSiteOpActionLocation, EActorSiteOpAttachSource, EActorSiteOpBasicType, EActorEffectLocation, EActorHeightSourceType, EActorIncomingType, EActorSiteOpOrientAttachPointToType, EActorRadialDistribution, EActorSiteOpPhysicsImpactType, EActorCrossbarDistribution, EActorSiteOpRotatorType, EActorHeightTestType, EActorSiteOpTetherEnableType, EActorTiltType, EActorSquibMap, EActorTextAlignment, EBaselines, EDeathArray, EGroupSoundArray, ESoundArray, EUnitStatus, EUnitSound, EAlertPeripheral, EArmyCategoryState, EArmyUnitState, EArmyUpgradeState, EHeroUniverse, EArtifactType, EAMArcTestType, EAMFilterLogic, EAMFilterAttachType, EAMFilterType, EAMAttachType, EAMOccupancyLogic, EAMNumericField, EAMNumericFieldOp, EAMPatternType, EAttachKeyword, EAMRandomDistribution, EAMReductionType, EBankConditionCombine, EBehaviorAlignment, EDamageKind, EBehaviorUnitTrackerAtMaxRule, EBehaviorUnitTrackerSnapRule, EBehaviorBuffReplace, EAllianceId, EShareFilters, ETargetFilters, EXPFraction, ESharedXPRadius, ESharedXPFraction, ESharedXPMaxCount, EXPReceiveFraction, EParamInitial, EParamSmooth, ECameraScale, ECameraHeightMap, ECharacterGender, ECharacterRace, ECharacterRelevance, EColorEntry, EConversationProductionLevel, EObjectStates, EInfoIds, EGameCatalog, EImplementionLevel, EOscillator, EEffectHistory, EHeightMap, EListWalkMode, EUnitAttribute, EDamageVisibility, EDamageType, EDamageTotal, EEffectContainer, EMoverPatternType, EEffectModifyFacing, EClassIdCBehavior, EEffectRemoveBehaviorAlignment, EBehaviorHeroicState, EUpgradeOperation, EFootprintLayer, EAttackType, EBeaconInfoArray, ETeleportResetRange, ESoundCategory, EUIColorRelation, EGameUIMixRouting, EGameUIPointModels, EGameUIBehaviorIconColors, EGameUIBehaviorBorderColors, EGameUISelectionColors, EGameUISelectionColorBlindColors, EGameUIOverrideColors, EGameUIColorBlindColors, EGameUIDefaultPathColor, EGameUIDefaultPathLineWidth, EGameUIDefaultPathTileLength, EGameUIDefaultPathTexture, EGameUIDefaultPathStepModel, EGameUIDefaultPathStepModelScale, EHotkey, ETargetModeValidation, EQuickCastMode, EGlueTheme, EHerdClosestTo, EHeroState, EHeroRole, EHeroImageFacing, EHeroCutsceneSize, EHeroDifficulty, EHeroGender, EPurchaseWarningCondition, EHeroAbilState, EKineticFollow, EGameTimeEvent, EEffectLocation, EEffectPlayer, EMapKind, EOcclusion, EPausedParticleSystemBehavior, EFoliageLayer, EPathMode, EPlacementArray, EObjectiveType, ERewardArray, EDamageLocation, EResponseContinueMethod, EDamageResponseDamageValue, EPreloadTiming, ENodeArray, ESpeakerMode, EScoreSort, EScoreValueReport, EScoreCollapse, EScoreValueType, EScoreValue, EScoreValueOperation, ESoundBlend, ESoundDupe, ESoundDupePriority, ESoundMode, ESoundSelect, EExclusivityAction, EExclusivityQueueAction, EMix, ETargetFindSet, ECreepSettingsArray, EFoliageSettingsArray, ETurretIdle, EDeathReveal, EUnitMob, EUnitGender, EResourceState, EUnitResponse, EArmorType, ECostCategory, EUnitDisplay, EUnitTaunt, EValidateCombine, EGameResult, EPlayerType, EUnitAIFlag, EAlliancePlayer, EClassIdCAbil, EBehaviorState, EUnitTestState, EPlayerRelationship, EUnitType, EPlane, EWeaponType, ESkillPoint, EAbilEffectStage, EChargeLocation, ECooldownLocation, EVitalType, EWeaponPrioritization, EWeaponLegacyMovement, TLocaleId, NAMESPACE_CLASS_MAP } from "./schema.enums.js";
import { FEffectMissileSearch, FAbilShared, FAbilityCategories, FAbilEffect, FAbilEffectStage, FAbilRedirect, FAbilArmMagazine, FAbilAttack, FAbilAugment, FAbilAttackModifier, FAbilBattery, FAbilBehavior, FAbilBuild, FAbilHarvest, FResourceType, FAbilHarvestStage, FAbilInteract, FAbilInventory, FAbilLearn, FAbilMerge, FAbilMorph, FClassIdCAbil, FAbilMove, FAbilPawn, FAbilQueue, FAbilRally, FAbilRedirectInstant, FAbilRedirectTarget, FAbilResearch, FAbilRevive, FAbilSpecialize, FAbilStop, FAbilTrain, FAbilTransport, FAbilWarpTrain, FAccumulatorAttributePoints, FAchievement, FAchievementFilters, FAchievementTerm, FActorFlags, FActorFilter, FActorFilterAtCreation, FActorVisibleTo, FActorVisibleToAtCreation, FActorFilterPlayers, FActorVisibleToPlayers, FActorInherits, FActorTransfer, FActorHostedPropTransfer, FActorModel, FActorModelMaterial, FActorQuad, FForceFlags, FRangeFlags, FCliffLevelCompare, FSoundFlags, FActionFlags, FActorDoodad, FEditor, FRegionFlags, FSelectionFlags, FSelectionFilter, FSiteFlags, FDeltaSumFlags, FTerrainAndWaterFlags, FShadowFlags, FTipabilityFlags, FTerrainDeformerFlags, FActorTextOptions, FUnitStatus, FUnitStatusGroup, FUnitFlags, FAlertPrimaryActions, FAlertSecondaryActions, FAlertDisplay, FAlertFlags, FArmyCategory, FPlayerRelationship, FArtifactType, FTests, FAttachMethodBestMatch, FBehaviorFlags, FInfoFlags, FBehaviorCategory, FAttackModifierFlags, FWeaponIndexEnableArray, FWeaponIndexDisableArray, FEquipmentDisplay, FUnitTrackerFlags, FDisplayDuration, FDisplayShield, FBuffFlags, FConjoinedFlags, FBehaviorPowerSource, FBehaviorPowerUser, FBehaviorResource, FBehaviorSpawn, FBehaviorVeterancy, FBundle, FTooltipFlags, FConversationState, FNotifyArea, FResponse, FEffectApplyBehavior, FEffectCancelOrder, FEffectCreateHealer, FCreepFlags, FEffectCreatePersistent, FEffectReveal, FTeleportTrack, FCreateFlags, FUnitAttribute, FDamage, FSearchFlags, FCmd, FEffectLaunchMissile, FModifyFlags, FSelectionTransfer, FMorphFlags, FEffectRedirectMissile, FTeleportFlags, FFootprint, FPathingConfig, FPlayerLeave, FHero, FItem, FAbilFlags, FEffectFlags, FModel, FMount, FMover, FPing, FDamageResponseCategory, FDeathType, FDamageKind, FResponseUnitBirthType, FPreload, FModelFlags, FRace, FRequirement, FRequirementNode, FReward, FScoreResult, FScoreValueFlags, FSound, FSoundExclusivity, FSoundMixSnapshot, FSoundtrack, FTalentProfile, FTargetFind, FHeightFlags, FTexture, FTile, FUnit, FUnitUser, FPlane, FUnitCollide, FTauntDoesntStopUnit, FUpgrade, FPathingType, FValidatorUnitDetected, FValidatorUnitCompareAttackPriority, FWeaponOptions, FWeaponLegacyOptions } from "./schema.flags.js";
import { CStringLink, CAbilSetId, TTechAlias, TGalaxyFunction, CBehaviorLink, CDataCollectionLink, CEffectLink, CUnitLink, CValidatorLink, CAlertLink, CButtonLink, CImageLink, CAbilLink, CMoverLink, CRequirementLink, CIdentifier, CAccumulatorLink, CScoreValueLink, CRewardLink, CRaceLink, CAchievementTermLink, CAchievementLink, CPreloadLink, CCameraLink, CModelLink, CActorCreateKey, CActorLabelKey, CWeaponLink, CSoundLink, CBeamLink, CCutsceneFile, CTerrainLink, CFootprintLink, CActorLink, CDescPath, CHerdNodeLink, CUpgradeLink, CArmyUnitLink, CArmyUpgradeLink, CMovieFile, CSkinLink, CTalentLink, THyperlinkId, CItemLink, CPlayerResponseLink, TBattleProductId, CModelFile, CBankConditionLink, TPowerLink, CBoostLink, CHotkeyLink, CCliffMeshLink, CCampaignLink, CConsoleSkinLink, CCommanderLink, CConversationStateLink, CCharacterLink, TConversationItemId, CDataCollectionPatternLink, CKineticLink, CEmoticonLink, CBundleLink, CScoreResultLink, CSoundtrackLink, CDSPLink, CFontStyleFile, CLayoutFile, CMapFile, CHeroStatLink, CMountLink, CTalentProfileLink, CMapLink, CItemClassLink, CItemContainerLink, TCooldownLink, CArmyCategoryLink, CLocationLink, CObjectiveLink, CAnimsFile, CFacialFile, CLightLink, CPhysicsMaterialLink, CAssetFile, CConversationLink, TProductHyperlinkId, CRequirementNodeLink, CHeroLink, TBattleLicenseName, CDecalPackLink, CTextureLink, CSprayLink, CPortraitPackLink, CTrophyLink, CVoicePackLink, CRaceBannerPackLink, CStimPackLink, CSoundExclusivityLink, CSoundMixSnapshotLink, CTargetFindLink, CTacticalLink, TChargeLink, CReverbLink, CTerrainTexLink, CTileLink, CCliffLink, CTextureSlot, CTurretLink, CSyncModelDataFile, CLootLink } from "./schema.links.js";
import { CString } from "./schema.primitives.js";
import { SAbilOrderDisplay, SEffectBehavior, SCost, SAccumulatedFixed, SCostFactor, STargetSorts, SMarker, SAbilTargetCursorInfo, SAbilArmMagazineInfo, SAbilCmdButton, SAbilBuildInfo, SAbilInventoryInfo, SAbilLearnInfo, SAbilMergeInfo, SAbilMorphInfo, SAbilPawnInfo, SAbilRallyInfo, SAbilResearchInfo, SAbilReviveCmdButton, SAbilReviveInfo, SAbilReviveInfoMax, SAbilSpecializeInfo, SAbilTrainInfo, SAbilWarpTrainInfo, SEffectWhichUnit, SEffectWhichLocation, SEffectWhichBehavior, SAccumulatorSwitchCase, SEffectWhichPlayer, SAchievementTag, SActorRequest, SActorVisibilityShape, SActorEvent, SActorSiteOpsData, SActorModelAspectSet, SActorHostedAttach, SEventDataFootprint, SEventDataSound, SActorPhysicsImpactData, SActorQuadDecoration, SActorRangeAbil, SActorSoundLayer, SAttachQuery, SActorAVPair, SActorActionTerrainSquib, SActorAVCluster, SActorPhysicsData, SActorQuerySubjectResponse, SActorDeathBodySquib, SActorCloakTransition, SActorCreepRate, SActorDeathDataCustom, SLookAtType, SSplatEmitterInitInfo, SActorOverrideModel, SActorProgressStage, SActorQuerySubject, SActorQueryResponse, SActorHostedDelta, SSerpentAggregate, SSerpentSegment, SActorStateInfo, SAccumulatedUInt32, SActorBaseline, SActorDeathData, SActorDeathDataCustomGroup, SActorUnitImpactSoundExtras, SDamagePastRemainingHealth, SDamageOverInterval, STerrainSquib, SUnitAbilSound, SErrorOverride, SLayerIcon, SLayerIconVariation, SIconVariation, SStatusColor, SStatusChargeData, SStatusHarvesterData, STextTagParameters, SUnitKillRank, SVitalColor, SLayerIconShield, SLayerIconShieldVariation, SBankPath, SArtifactRank, SProductReleaseDate, SAttachKey, SModification, SEffectWhichTimeScale, SAccumulatedGameTime, SBehaviorDuration, SDamageResponse, SVitalRegenVitalRemain, SPowerStage, SSpawnInfo, SBehaviorFraction, SVeterancyLevel, STooltipBlock, STooltipTimeAbilCmd, SButtonCardLayout, SCameraZoom, SCameraSmooth, SCampaignData, SCharacterVariation, SUIColorEntry, SCommanderUnit, SCommanderTalentTree, SCommanderMasteryTalent, SCommanderAbil, SGameContentCreationData, SCommanderDifficultyLevel, SConsoleSkinModel, SConversationProductionLevel, SConversationConditionSet, SConversationActionSet, SConversationFacialAnim, SConversationLine, SConversationRunActions, SConversationWait, SConversationJump, SConversationChoice, SConversationGroup, SConversationComment, SConversationStateIndex, SConversationStateInfoIds, SDataCollectionRecord, SUpgradeInfoWeapon, SDataFieldsPattern, SDataTokensPattern, STextureSheetEntry, SAccumulatedGameRate, SScoreValueUpdate, SEffectDamageArea, SEffectSearchRevealerParams, SEffectEnumArea, SEffectMover, SEffectMissileBounce, SUpgradeEffect, SEffectUpgrade, SEffectModifyPlayerCost, SEffectModifyUnitCost, SEffectModifyWeapon, SEffectModifyVital, SEffectModifyTurret, SEffectSwitchCase, SEmoticonPackCampaign, SFootprintLayer, SFootprintShape, SDifficultyLevel, SAIBuild, SHandicap, SMapSize, SAspectMargin, STeamColor, SAIDescription, STriggerLib, STargetFilterResult, SBeaconInfo, SDamageTypeInfo, SAttackTypeInfo, SResourceConvert, SMeleePointThreshold, SChallengeCategory, SMovieConfig, SSoundQuality, SMinimapData, SSelectionData, SSoundData, SGlobalSoundData, SCameraShakeAmplitude, SCameraShakeFrequency, SListenerRolloff, SMixRoute, SPointModel, SUnitSpeedText, SWeaponSpeedText, SObjectGroupData, SLoadingScreenHelp, SLoadingBar, SGameCategory, SDefaultGameVariant, STutorialConfig, SHotkeyInfo, SResourceUI, SHelpControlCategoryInfo, SHelpControlInfo, SHelpGameMechanicInfo, SAltSoundtrack, SCutsceneAssetPath, SHerdLevel, SHerdNode, SHeroAbilCategory, SHeroAbil, SHeroHeroicAbility, SHeroSpecificVO, SHeroTalentTree, SHeroTalentTier, SHeroSpecificIntroVO, SHeroLevelScaling, SHeroRatings, SHeroAITalentBuild, SHeroSpecificUI, SHeroStatModifier, SCharge, SUnitWeaponData, SItemContainerSlot, SFlareInfo, STimeEvent, SLightInfo, SMissionCategory, SLootChoice, SAnimFile, SAnimAlias, SAttachProps, SModelDataEvent, SPhysicsMaterialMapping, STextureDeclare, STextureInfo, STextureExpressionSpec, STextureMatchSpec, SModelVariation, SPathingData, SMotionPhase, SMotionOverlay, SStartingUnit, SUpkeepTax, SRequirementNode, SRequirementCount, SRequirementCountAbil, SRequirementCountBehavior, SRequirementCountEffect, SRequirementCountUnit, SRequirementCountUpgrade, SRewardCategory, SRewardSpecificUI, SGameReplacement, SSkinModelGroup, SSkinModelMacroRun, SSkinPackEntry, SSoundAsset, SSoundAssetTemplate, SVolumeFade, SVolumeThreshold, SSoundLocaleFlags, SPitchShift, SReverbBalance, SReverbRolloff, SVolumeRolloff, SSoundtrackCue, STacAbilData, STalentRank, STalentAbilityModification, STargetFindEnumArea, SDSPArray, SCreepSettings, SFoliageSimulationConfig, STerrainDoodad, SFidget, SUnitArmorFormula, SUnitResourceRatio, SStockCharge, SUnitAbilData, SUnitBehaviorData, SCardLayout, SAddedOnData, SUnitEquipment, SUnitReviveInfo, SAttributePointsInfo, SUpgradeEffectTemplate, SUserField, SUserInstance, SValidatorCondition, SValidatorFunction, SValidatorEnumArea, SVoiceOverSkin, SVoiceOverGroup, SVoiceOverLine, SVoicePackExampleLine, SWaterStateDesc, SWaterDoodad, SActorCreepHeightClass } from "./schema.struct.js";
import { UInt32, Bit, CFourCC, Real, CFangleArc, CGameTime, CfRange, TAbilCmdIndex, CFangle, CGamePoint, TCargoSize, TCargoCapacity, Int32, UInt, Real32, CScaleVector, C3Vector, CQuad, CRange, CVariatorActorReal32, C2Vector, CColor, CActorAngle, CAnimNameKey, CAnimProps, CFacing, TCliffLevel, CVariatorActorAngle, CColorHDR, CVariatorActorFangle, CFangleRate, CActorTableKeys1x3, CGameRate, C2iVector, CColorRGB, CAttachKeys, TPowerLevel, CRect, UInt8, CiRange, CEffectOffset, TDifficultyLevel, TAIBuild, CiQuad, UInt16, EPlayerId, CGameSpeed, TPlayerId, TMountCategory, CVariatorGameFangle, CVariatorGameFixed, CTimeOfDay, CStyleName, CTextureProps, CfQuad, Int16, CPitchRange, CVolumeRange, CVolume, TAttackTargetPriority, C2fVector, CGameAcceleration, TUnitRadius, Int8, C4Vector } from "./schema.types.js";
class CClass extends CObject.Ex({
    default: CBooleanAttribute,
    class: CClassName,
    id: CNamespaceClassLink,
    parent: CNamespaceClassLink,
    token: CTokenDefinitions,
    tokens: CTokenValues
}) {
}
class CAbil extends CClass.Ex({
    Name: CStringLink,
    TechPlayer: EAbilTechPlayer,
    Alignment: EAbilAlignment,
    OrderArray: [SAbilOrderDisplay],
    AbilSetId: CAbilSetId,
    EditorCategories: TEditorCategories,
    InfoTooltipPriority: UInt32,
    TargetMessage: CStringLink,
    TechAliasArray: [TTechAlias],
    SharedFlags: FAbilShared,
    DebugTrace: Bit,
    AbilityCategories: FAbilityCategories,
    TacticalAIFunc: TGalaxyFunction,
    StateBehavior: CBehaviorLink,
    DefaultButtonCardId: CFourCC,
    DataCollection: CDataCollectionLink
}) {
    static namespace;
}
class CAbilProgress extends CAbil.Ex({
    Activity: CStringLink,
    Cancelable: Bit,
    VitalStartFactor: { index: EUnitVital, value: Real }
}) {
}
class CAbilEffect extends CAbil.Ex({
    Levels: UInt32,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    Activity: CStringLink,
    PrepEffect: [CEffectLink],
    Effect: [CEffectLink],
    PreEffectBehavior: SEffectBehavior,
    PostEffectBehavior: SEffectBehavior,
    Flags: FAbilEffect,
    Cost: [SCost],
    ExtraVitalCost: { index: EUnitVital, value: SAccumulatedFixed },
    CancelCost: [SCost],
    RefundArray: FAbilEffectStage,
    RefundFraction: SCostFactor,
    InterruptArray: FAbilEffectStage,
    InterruptCost: SCost,
    Placeholder: CUnitLink,
    TargetFilters: [CTargetFilters],
    TargetSorts: STargetSorts,
    Range: [Real],
    RangeSlop: Real,
    Arc: CFangleArc,
    ArcSlop: CFangleArc,
    TrackingArc: CFangleArc,
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink],
    AutoCastAcquireLevel: EAcquireLevel,
    AutoCastFilters: CTargetFilters,
    AutoCastRange: Real,
    AutoCastValidatorArray: [CValidatorLink],
    CastMovementLimit: Real,
    Precast: [CGameTime],
    PrepTime: [CGameTime],
    CastIntroTime: [CGameTime],
    CastOutroTime: [CGameTime],
    FinishTime: [CGameTime],
    Marker: SMarker,
    UseMarkerArray: FAbilEffectStage,
    ShowProgressArray: FAbilEffectStage,
    CancelableArray: FAbilEffectStage,
    PauseableArray: FAbilEffectStage,
    PreemptableArray: FAbilEffectStage,
    UninterruptibleArray: FAbilEffectStage,
    ValidatedArray: FAbilEffectStage,
    InheritAttackPriorityArray: FAbilEffectStage,
    ErrorAlert: CAlertLink,
    AlertArray: { index: EAlertArray, value: CAlertLink },
    CursorEffect: [CEffectLink],
    CastOutroTimeEffect: [CEffectLink],
    CalldownEffect: CEffectLink,
    AINotifyEffect: CEffectLink,
    ProducedUnitArray: [CUnitLink],
    ProgressButtonArray: { index: EProgressButtonArray, value: CButtonLink },
    DefaultError: CCmdResult,
    LevelButtonImage: [CImageLink],
    LevelButtonName: [CStringLink],
    LevelButtonTooltip: [CStringLink],
    LevelButtonTooltipImage: [CImageLink],
    EffectRange: [CfRange],
    LearnButtonImage: [CImageLink],
    LearnButtonName: [CStringLink],
    LearnButtonTooltip: [CStringLink],
    LearnButtonTooltipImage: [CImageLink],
    IgnoreFilters: CTargetFilters,
    AcquirePriority: UInt32,
    CursorRangeMode: ECursorRangeMode,
    SetLastTarget: EAbilLastTarget,
    TargetCursorInfo: SAbilTargetCursorInfo,
    CancelEffect: { index: ECancelEffect, value: CEffectLink },
    CancelDelay: { index: ECancelDelay, value: CGameTime }
}) {
}
class CAbilQueueable extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink
}) {
}
class CAbilRedirect extends CAbil.Ex({
    Abil: CAbilLink,
    Index: TAbilCmdIndex,
    Flags: FAbilRedirect
}) {
}
class CAbilArmMagazine extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    Launch: EAbilArmMagazineLaunch,
    Flags: FAbilArmMagazine,
    Leash: Real,
    InfoArray: { index: EAbilArmMagazineCmd, value: SAbilArmMagazineInfo },
    Alert: CAlertLink,
    EffectArray: { index: EAbilArmMagazineEffect, value: CEffectLink },
    ReturnLifeFraction: Real,
    CalldownEffect: CEffectLink,
    ExternalAngle: [CFangle],
    MaxCount: UInt32
}) {
}
class CAbilAttack extends CAbil.Ex({
    CmdButtonArray: { index: EAbilAttackCmd, value: SAbilCmdButton },
    AcquireFilters: CTargetFilters,
    SmartFilters: CTargetFilters,
    SmartPriority: UInt32,
    SupportedFilters: CTargetFilters,
    MinAttackSpeedMultiplier: Real,
    MaxAttackSpeedMultiplier: Real,
    AcquirePriority: UInt32,
    Flags: FAbilAttack,
    TargetCursorInfo: SAbilTargetCursorInfo
}) {
}
class CAbilAugment extends CAbil.Ex({
    CmdButtonArray: { index: EAbilAugmentCmd, value: SAbilCmdButton },
    Flags: FAbilAugment,
    AbilCmd: CAbilCommand,
    TargetType: EEffectLocationType,
    Cost: SCost,
    Effect: CEffectLink,
    AutoCastFilters: CTargetFilters,
    AutoCastValidatorArray: [CValidatorLink],
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink]
}) {
}
class CAbilAttackModifier extends CAbil.Ex({
    Levels: UInt32,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    CmdButtonArray: { index: EAbilAttackModifierCmd, value: SAbilCmdButton },
    Flags: FAbilAttackModifier,
    TargetType: EEffectLocationType,
    Cost: [SCost],
    AutoCastFilters: CTargetFilters,
    AutoCastValidatorArray: [CValidatorLink],
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink],
    AttackModifierBehavior: CBehaviorLink
}) {
}
class CAbilBattery extends CAbil.Ex({
    CmdButtonArray: { index: EAbilBatteryCmd, value: SAbilCmdButton },
    Flags: FAbilBattery,
    TargetFilters: CTargetFilters,
    Range: Real,
    EnumFilters: CTargetFilters,
    EnumRange: Real,
    Effect: CEffectLink,
    SmartPriority: UInt32,
    AutoCastFilters: CTargetFilters,
    AutoCastRange: Real,
    AutoCastValidatorArray: [CValidatorLink]
}) {
}
class CAbilBeacon extends CAbil.Ex({
    CmdButtonArray: { index: EAbilBeaconCmd, value: SAbilCmdButton },
    SmartPriority: UInt32
}) {
}
class CAbilBehavior extends CAbil.Ex({
    Levels: UInt32,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    CmdButtonArray: { index: EAbilBehaviorCmd, value: SAbilCmdButton },
    Flags: FAbilBehavior,
    Cost: [SCost],
    OffCost: [SCost],
    ExpireCost: [SCost],
    BehaviorArray: [CBehaviorLink],
    CycleMode: EAbilBehaviorCycleMode,
    ValidatorArray: [CValidatorLink],
    AutoCastValidatorArray: [CValidatorLink],
    AutoCastToggleOnValidatorArray: [CValidatorLink],
    AutoCastToggleOffValidatorArray: [CValidatorLink],
    LevelButtonOnImage: [CImageLink],
    LevelButtonOnName: [CStringLink],
    LevelButtonOnTooltip: [CStringLink],
    LevelButtonOnTooltipImage: [CImageLink],
    LevelButtonOffImage: [CImageLink],
    LevelButtonOffName: [CStringLink],
    LevelButtonOffTooltip: [CStringLink],
    LevelButtonOffTooltipImage: [CImageLink],
    LearnButtonImage: [CImageLink],
    LearnButtonName: [CStringLink],
    LearnButtonTooltip: [CStringLink],
    LearnButtonTooltipImage: [CImageLink]
}) {
}
class CAbilBuild extends CAbil.Ex({
    HaltCmdButton: SAbilCmdButton,
    BuildMorphAbil: CAbilLink,
    UnlinkMorphAbil: CAbilLink,
    FlagArray: FAbilBuild,
    Alert: CAlertLink,
    ErrorAlert: CAlertLink,
    InfoArray: { index: EAbilBuildCmd, value: SAbilBuildInfo },
    Type: EAbilBuildType,
    Range: Real,
    RefundFraction: SCostFactor,
    FidgetDelayMin: CGameTime,
    FidgetDelayMax: CGameTime,
    ConstructionMover: CMoverLink,
    EffectArray: { index: EEffectArray, value: CEffectLink },
    SmartPriority: UInt32
}) {
}
class CAbilBuildable extends CAbil.Ex({
    Activity: CStringLink,
    Cancelable: Bit,
    VitalStartFactor: { index: EUnitVital, value: Real },
    CmdButtonArray: { index: EAbilBuildableCmd, value: SAbilCmdButton },
    MaxBuilders: UInt32,
    PowerBuildBonusRate: Real,
    PowerBuildCostFactor: Real
}) {
}
class CAbilEffectInstant extends CAbil.Ex({
    Levels: UInt32,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    Activity: CStringLink,
    PrepEffect: [CEffectLink],
    Effect: [CEffectLink],
    PreEffectBehavior: SEffectBehavior,
    PostEffectBehavior: SEffectBehavior,
    Flags: FAbilEffect,
    Cost: [SCost],
    ExtraVitalCost: { index: EUnitVital, value: SAccumulatedFixed },
    CancelCost: [SCost],
    RefundArray: FAbilEffectStage,
    RefundFraction: SCostFactor,
    InterruptArray: FAbilEffectStage,
    InterruptCost: SCost,
    Placeholder: CUnitLink,
    TargetFilters: [CTargetFilters],
    TargetSorts: STargetSorts,
    Range: [Real],
    RangeSlop: Real,
    Arc: CFangleArc,
    ArcSlop: CFangleArc,
    TrackingArc: CFangleArc,
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink],
    AutoCastAcquireLevel: EAcquireLevel,
    AutoCastFilters: CTargetFilters,
    AutoCastRange: Real,
    AutoCastValidatorArray: [CValidatorLink],
    CastMovementLimit: Real,
    Precast: [CGameTime],
    PrepTime: [CGameTime],
    CastIntroTime: [CGameTime],
    CastOutroTime: [CGameTime],
    FinishTime: [CGameTime],
    Marker: SMarker,
    UseMarkerArray: FAbilEffectStage,
    ShowProgressArray: FAbilEffectStage,
    CancelableArray: FAbilEffectStage,
    PauseableArray: FAbilEffectStage,
    PreemptableArray: FAbilEffectStage,
    UninterruptibleArray: FAbilEffectStage,
    ValidatedArray: FAbilEffectStage,
    InheritAttackPriorityArray: FAbilEffectStage,
    ErrorAlert: CAlertLink,
    AlertArray: { index: EAlertArray, value: CAlertLink },
    CursorEffect: [CEffectLink],
    CastOutroTimeEffect: [CEffectLink],
    CalldownEffect: CEffectLink,
    AINotifyEffect: CEffectLink,
    ProducedUnitArray: [CUnitLink],
    ProgressButtonArray: { index: EProgressButtonArray, value: CButtonLink },
    DefaultError: CCmdResult,
    LevelButtonImage: [CImageLink],
    LevelButtonName: [CStringLink],
    LevelButtonTooltip: [CStringLink],
    LevelButtonTooltipImage: [CImageLink],
    EffectRange: [CfRange],
    LearnButtonImage: [CImageLink],
    LearnButtonName: [CStringLink],
    LearnButtonTooltip: [CStringLink],
    LearnButtonTooltipImage: [CImageLink],
    IgnoreFilters: CTargetFilters,
    AcquirePriority: UInt32,
    CursorRangeMode: ECursorRangeMode,
    SetLastTarget: EAbilLastTarget,
    TargetCursorInfo: SAbilTargetCursorInfo,
    CancelEffect: { index: ECancelEffect, value: CEffectLink },
    CancelDelay: { index: ECancelDelay, value: CGameTime },
    CmdButtonArray: { index: EAbilEffectInstantCmd, value: SAbilCmdButton }
}) {
}
class CAbilEffectTarget extends CAbil.Ex({
    Levels: UInt32,
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    Activity: CStringLink,
    PrepEffect: [CEffectLink],
    Effect: [CEffectLink],
    PreEffectBehavior: SEffectBehavior,
    PostEffectBehavior: SEffectBehavior,
    Flags: FAbilEffect,
    Cost: [SCost],
    ExtraVitalCost: { index: EUnitVital, value: SAccumulatedFixed },
    CancelCost: [SCost],
    RefundArray: FAbilEffectStage,
    RefundFraction: SCostFactor,
    InterruptArray: FAbilEffectStage,
    InterruptCost: SCost,
    Placeholder: CUnitLink,
    TargetFilters: [CTargetFilters],
    TargetSorts: STargetSorts,
    Range: [Real],
    RangeSlop: Real,
    Arc: CFangleArc,
    ArcSlop: CFangleArc,
    TrackingArc: CFangleArc,
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink],
    AutoCastAcquireLevel: EAcquireLevel,
    AutoCastFilters: CTargetFilters,
    AutoCastRange: Real,
    AutoCastValidatorArray: [CValidatorLink],
    CastMovementLimit: Real,
    Precast: [CGameTime],
    PrepTime: [CGameTime],
    CastIntroTime: [CGameTime],
    CastOutroTime: [CGameTime],
    FinishTime: [CGameTime],
    Marker: SMarker,
    UseMarkerArray: FAbilEffectStage,
    ShowProgressArray: FAbilEffectStage,
    CancelableArray: FAbilEffectStage,
    PauseableArray: FAbilEffectStage,
    PreemptableArray: FAbilEffectStage,
    UninterruptibleArray: FAbilEffectStage,
    ValidatedArray: FAbilEffectStage,
    InheritAttackPriorityArray: FAbilEffectStage,
    ErrorAlert: CAlertLink,
    AlertArray: { index: EAlertArray, value: CAlertLink },
    CursorEffect: [CEffectLink],
    CastOutroTimeEffect: [CEffectLink],
    CalldownEffect: CEffectLink,
    AINotifyEffect: CEffectLink,
    ProducedUnitArray: [CUnitLink],
    ProgressButtonArray: { index: EProgressButtonArray, value: CButtonLink },
    DefaultError: CCmdResult,
    LevelButtonImage: [CImageLink],
    LevelButtonName: [CStringLink],
    LevelButtonTooltip: [CStringLink],
    LevelButtonTooltipImage: [CImageLink],
    EffectRange: [CfRange],
    LearnButtonImage: [CImageLink],
    LearnButtonName: [CStringLink],
    LearnButtonTooltip: [CStringLink],
    LearnButtonTooltipImage: [CImageLink],
    IgnoreFilters: CTargetFilters,
    AcquirePriority: UInt32,
    CursorRangeMode: ECursorRangeMode,
    SetLastTarget: EAbilLastTarget,
    TargetCursorInfo: SAbilTargetCursorInfo,
    CancelEffect: { index: ECancelEffect, value: CEffectLink },
    CancelDelay: { index: ECancelDelay, value: CGameTime },
    CmdButtonArray: { index: EAbilEffectTargetCmd, value: SAbilCmdButton },
    PlaceUnit: CUnitLink,
    AcquireAttackers: Bit,
    FollowRange: Real,
    FinishCommand: CAbilCommand
}) {
}
class CAbilHarvest extends CAbil.Ex({
    CmdButtonArray: { index: EAbilHarvestCmd, value: SAbilCmdButton },
    FlagArray: FAbilHarvest,
    Range: Real,
    AcquireRadius: Real,
    Effect: CEffectLink,
    EffectDelay: CGameTime,
    ReservedMarker: SMarker,
    ResourceAcquire: FResourceType,
    ResourceAllowed: FResourceType,
    ResourceDestroy: FResourceType,
    ResourceAmountBonus: { index: EResourceType, value: UInt32 },
    ResourceAmountMultiplier: { index: EResourceType, value: Real },
    ResourceAmountRequest: { index: EResourceType, value: UInt32 },
    ResourceAmountCapacity: { index: EResourceType, value: UInt32 },
    ResourceTimeBonus: { index: EResourceType, value: CGameTime },
    ResourceTimeMultiplier: { index: EResourceType, value: Real },
    CancelableArray: FAbilHarvestStage,
    UninterruptibleArray: FAbilHarvestStage,
    SmartPriority: UInt32,
    ResourceQueueIndex: UInt32
}) {
}
class CAbilInteract extends CAbil.Ex({
    CmdButtonArray: { index: EAbilInteractCmd, value: SAbilCmdButton },
    Flags: FAbilInteract,
    Range: Real,
    TargetFilters: CTargetFilters,
    ValidatorArray: [CValidatorLink],
    SmartPriority: UInt32,
    SmartValidatorArray: [CValidatorLink],
    AutoCastFilters: CTargetFilters,
    AutoCastRange: Real,
    AutoCastValidatorArray: [CValidatorLink]
}) {
}
class CAbilInventory extends CAbil.Ex({
    CmdButtonArray: { index: EAbilInventoryCmd, value: SAbilCmdButton },
    Flags: FAbilInventory,
    TargetFilters: CTargetFilters,
    ValidatorArray: [CValidatorLink],
    Range: Real,
    MaxDropRange: Real,
    InfoArray: [SAbilInventoryInfo],
    SmartPriority: UInt32,
    Requirements: CRequirementLink
}) {
}
class CAbilLearn extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    InfoArray: { index: EAbilLearnCmd, value: SAbilLearnInfo },
    Flags: FAbilLearn,
    Points: UInt32,
    PointsPerLevel: UInt32,
    VeterancyBehavior: CBehaviorLink
}) {
}
class CAbilMerge extends CAbil.Ex({
    CmdButtonArray: { index: EAbilMergeCmd, value: SAbilCmdButton },
    Flags: FAbilMerge,
    Alert: CAlertLink,
    Effect: CEffectLink,
    Info: SAbilMergeInfo,
    Range: Real
}) {
}
class CAbilMergeable extends CAbil.Ex({
    Activity: CStringLink,
    Cancelable: Bit,
    VitalStartFactor: { index: EUnitVital, value: Real },
    CmdButtonArray: { index: EAbilMergeableCmd, value: SAbilCmdButton }
}) {
}
class CAbilMorph extends CAbil.Ex({
    VeterancyLevelMin: UInt32,
    VeterancyLevelSkip: UInt32,
    CmdButtonArray: { index: EAbilMorphCmd, value: SAbilCmdButton },
    ActorKey: CDataSoupKey,
    Flags: FAbilMorph,
    RefundFraction: SCostFactor,
    Cost: SCost,
    CostUnmorph: SCost,
    CancelUnit: CUnitLink,
    InfoArray: [SAbilMorphInfo],
    InfoArrayUnmorph: [SAbilMorphInfo],
    StartGlobalAlert: CAlertLink,
    FinishGlobalAlert: CAlertLink,
    Alert: CAlertLink,
    ErrorAlert: CAlertLink,
    Range: Real,
    AutoCastAcquireLevel: EAcquireLevel,
    AutoCastFilters: CTargetFilters,
    AutoCastValidatorArray: [CValidatorLink],
    AutoCastRange: Real,
    AutoCastCountMin: UInt32,
    AutoCastCountMax: UInt32,
    TargetSorts: STargetSorts,
    CantFindTargetError: CCmdResult,
    CantFindTargetErrorUnmorph: CCmdResult,
    Activity: CStringLink,
    ValidatorArray: [CValidatorLink],
    ValidatorArrayUnmorph: [CValidatorLink],
    AbilClassEnableArray: FClassIdCAbil,
    AbilClassDisableArray: FClassIdCAbil,
    AbilLinkEnableArray: [CAbilLink],
    AbilLinkDisableArray: [CAbilLink],
    ProgressButton: CButtonLink,
    AcquirePriority: UInt32,
    BehaviorOn: CBehaviorLink,
    BehaviorOff: CBehaviorLink
}) {
}
class CAbilMorphPlacement extends CAbilMorph.Ex({}) {
}
class CAbilMove extends CAbil.Ex({
    CmdButtonArray: { index: EAbilMoveCmd, value: SAbilCmdButton },
    FleeRange: Real,
    FleeTime: CGameTime,
    FollowRangeSlop: Real,
    FollowAcquireRange: Real,
    MinPatrolDistance: Real,
    FollowFilters: CTargetFilters,
    MoveFilters: CTargetFilters,
    Flags: FAbilMove,
    MoveSmartPriority: UInt32,
    BoardBunkerSmartPriority: UInt32,
    BoardTransportSmartPriority: UInt32,
    PowerupSmartPriority: UInt32,
    RechargeSmartPriority: UInt32,
    IgnoreRange: Real
}) {
}
class CAbilPawn extends CAbil.Ex({
    InfoArray: { index: EAbilPawnCmd, value: SAbilPawnInfo },
    Flags: FAbilPawn,
    Range: Real
}) {
}
class CAbilQueue extends CAbil.Ex({
    CmdButtonArray: { index: EAbilQueueCmd, value: SAbilCmdButton },
    QueueCount: UInt32,
    QueueSize: UInt32,
    Flags: FAbilQueue,
    AddOnParentAbilClassDisableArray: FClassIdCAbil
}) {
}
class CAbilRally extends CAbil.Ex({
    CmdButtonArray: { index: EAbilRallyCmd, value: SAbilCmdButton },
    InfoArray: [SAbilRallyInfo],
    Flags: FAbilRally,
    SmartPriority: UInt32
}) {
}
class CAbilRedirectInstant extends CAbil.Ex({
    Abil: CAbilLink,
    Index: TAbilCmdIndex,
    Flags: FAbilRedirectInstant,
    CmdButtonArray: { index: EAbilRedirectInstantCmd, value: SAbilCmdButton }
}) {
}
class CAbilRedirectTarget extends CAbil.Ex({
    Abil: CAbilLink,
    Index: TAbilCmdIndex,
    Flags: FAbilRedirectTarget,
    CmdButtonArray: { index: EAbilRedirectTargetCmd, value: SAbilCmdButton }
}) {
}
class CAbilResearch extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    InfoArray: { index: EAbilResearchCmd, value: SAbilResearchInfo },
    Flags: FAbilResearch
}) {
}
class CAbilRevive extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    CmdButtonArray: { index: EAbilReviveCmd, value: SAbilReviveCmdButton },
    Flags: FAbilRevive,
    BaseInfo: SAbilReviveInfo,
    LevelInfo: SAbilReviveInfo,
    MaxInfo: SAbilReviveInfoMax,
    BaseUnitCostFactor: SCostFactor,
    LevelUnitCostFactor: SCostFactor,
    LevelUnitBuildTimeFactor: Real,
    ActorKey: CDataSoupKey,
    Effect: CEffectLink,
    Offset: [CGamePoint],
    Range: Real,
    VitalArray: { index: EUnitVital, value: EAbilReviveVital },
    Alert: CAlertLink,
    NameOverride: CStringLink,
    ReplaceFilters: CTargetFilters,
    ReplaceDeathType: EDeathType,
    SelfReviveCmd: EAbilReviveCmd,
    ValidatorArray: [CValidatorLink],
    TargetType: EEffectLocationType,
    VeterancyBehavior: CBehaviorLink
}) {
}
class CAbilSpecialize extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    InfoArray: { index: EAbilSpecializeCmd, value: SAbilSpecializeInfo },
    MaxCount: UInt32,
    Alert: CAlertLink,
    Flags: FAbilSpecialize
}) {
}
class CAbilStop extends CAbil.Ex({
    CmdButtonArray: { index: EAbilStopCmd, value: SAbilCmdButton },
    Flags: FAbilStop,
    RequestPickupBunkerSmartPriority: UInt32,
    RequestPickupTransportSmartPriority: UInt32
}) {
}
class CAbilTrain extends CAbil.Ex({
    RefundFraction: SCostFactor,
    ErrorAlert: CAlertLink,
    Activity: CStringLink,
    ActorKey: CDataSoupKey,
    Flags: FAbilTrain,
    MorphUnit: CUnitLink,
    Offset: [CGamePoint],
    Range: Real,
    InfoArray: { index: EAbilTrainCmd, value: SAbilTrainInfo },
    IgnoreUnitCostRequirements: CRequirementLink,
    Alert: CAlertLink,
    ProxyOffset: [CGamePoint],
    ProxyUnit: CUnitLink,
    DeathTypeOnFinish: EDeathType,
    DeathTypeOnCancel: EDeathType,
    AgentUnitValidator: CValidatorLink
}) {
}
class CAbilTransport extends CAbil.Ex({
    CmdButtonArray: { index: EAbilTransportCmd, value: SAbilCmdButton },
    Flags: FAbilTransport,
    Range: Real,
    MaxUnloadRange: Real,
    MaxCargoCount: UInt32,
    MaxCargoSize: TCargoSize,
    TotalCargoSpace: TCargoCapacity,
    LoadCargoBehavior: CBehaviorLink,
    LoadCargoEffect: CEffectLink,
    LoadTransportEffect: CEffectLink,
    LoadTransportBehavior: CBehaviorLink,
    UnloadCargoBehavior: CBehaviorLink,
    UnloadCargoEffect: CEffectLink,
    UnloadTransportEffect: CEffectLink,
    UnloadTransportBehavior: CBehaviorLink,
    InitialLoadDelay: CGameTime,
    InitialUnloadDelay: CGameTime,
    LoadPeriod: CGameTime,
    UnloadPeriod: CGameTime,
    TargetFilters: CTargetFilters,
    SearchRadius: Real,
    LoadValidatorArray: [CValidatorLink],
    UnloadValidatorArray: [CValidatorLink],
    TargetSorts: STargetSorts,
    CalldownEffect: CEffectLink,
    DeathUnloadEffect: CEffectLink,
    ErrorAlert: CAlertLink,
    LoadSmartPriority: UInt32,
    CargoFilter: CIdentifier
}) {
}
class CAbilWarpable extends CAbil.Ex({
    Activity: CStringLink,
    Cancelable: Bit,
    VitalStartFactor: { index: EUnitVital, value: Real },
    CmdButtonArray: { index: EAbilWarpableCmd, value: SAbilCmdButton },
    PowerUserBehavior: CBehaviorLink
}) {
}
class CAbilWarpTrain extends CAbil.Ex({
    InfoArray: { index: EAbilTrainCmd, value: SAbilWarpTrainInfo },
    Alert: CAlertLink,
    RefundFraction: SCostFactor,
    Flags: FAbilWarpTrain
}) {
}
class CAccumulator extends CClass.Ex({
    SourceEffect: CEffectLink,
    MinAccumulation: Real,
    MaxAccumulation: Real,
    ApplicationRule: EAccumulatorApplicationRule
}) {
    static namespace;
}
class CAccumulatorConstant extends CAccumulator.Ex({
    Amount: Real
}) {
}
class CAccumulatorVitals extends CAccumulator.Ex({
    Ratio: Real,
    Missing: Bit,
    VitalType: EUnitVital,
    UnitSource: SEffectWhichUnit,
    ModificationType: EVitalsAccumulatorModificationType,
    ClampToMaxVitalForFractionalDamage: Bit
}) {
}
class CAccumulatorDistance extends CAccumulator.Ex({
    StartLocation: SEffectWhichLocation,
    EndLocation: SEffectWhichLocation,
    Scale: Real
}) {
}
class CAccumulatorBehavior extends CAccumulator.Ex({
    Behavior: CBehaviorLink,
    UnitSource: SEffectWhichUnit,
    Type: EAccumulatorBehaviorType
}) {
}
class CAccumulatorAttributePoints extends CAccumulator.Ex({
    Attribute: CBehaviorLink,
    Flags: FAccumulatorAttributePoints,
    UnitSource: SEffectWhichUnit,
    Scale: Real
}) {
}
class CAccumulatorTrackedUnitCount extends CAccumulator.Ex({
    Scale: Real,
    TrackerUnit: SEffectWhichUnit,
    TrackingBehavior: CBehaviorLink,
    TrackedUnitValidatorArray: [CValidatorLink],
    TrackedUnitFilters: CTargetFilters
}) {
}
class CAccumulatorLevel extends CAccumulator.Ex({
    Amount: [Real],
    LevelFactor: Real,
    PreviousValueFactor: Real,
    BonusPerLevel: Real
}) {
}
class CAccumulatorAbilLevel extends CAccumulator.Ex({
    Amount: [Real],
    LevelFactor: Real,
    PreviousValueFactor: Real,
    BonusPerLevel: Real
}) {
}
class CAccumulatorUnitLevel extends CAccumulator.Ex({
    Amount: [Real],
    LevelFactor: Real,
    PreviousValueFactor: Real,
    BonusPerLevel: Real,
    UnitSource: SEffectWhichUnit
}) {
}
class CAccumulatorVeterancyLevel extends CAccumulator.Ex({
    Amount: [Real],
    LevelFactor: Real,
    PreviousValueFactor: Real,
    BonusPerLevel: Real,
    UnitSource: SEffectWhichUnit
}) {
}
class CAccumulatorCargo extends CAccumulator.Ex({
    UnitSource: SEffectWhichUnit,
    Type: ECargoSpace
}) {
}
class CAccumulatorEffectAmount extends CAccumulator.Ex({
    AmountType: EEffectAmount,
    Total: Bit
}) {
}
class CAccumulatorUserData extends CAccumulator.Ex({
    Key: CIdentifier,
    FallbackValue: Real,
    BehaviorScope: SEffectWhichBehavior
}) {
}
class CAccumulatorUnitCustomValue extends CAccumulator.Ex({
    Index: Int32,
    FallbackValue: Real,
    UnitSource: SEffectWhichUnit
}) {
}
class CAccumulatorSwitch extends CAccumulator.Ex({
    CaseArray: [SAccumulatorSwitchCase],
    CaseDefault: CAccumulatorLink
}) {
}
class CAccumulatorArithmetic extends CAccumulator.Ex({
    Parameters: [SAccumulatedFixed],
    Operation: EAccumulatorOperation
}) {
}
class CAccumulatorPlayerScoreValue extends CAccumulator.Ex({
    Player: SEffectWhichPlayer,
    Value: CScoreValueLink
}) {
}
class CAchievement extends CClass.Ex({
    Category: CStringLink,
    Name: CStringLink,
    Description: CStringLink,
    Icon: CRewardLink,
    Points: UInt32,
    RewardTable: [CRewardLink],
    Flags: FAchievement,
    Race: CRaceLink,
    Filters: FAchievementFilters,
    MinTermCount: UInt32,
    TermTable: [CAchievementTermLink],
    SharesTerms: CAchievementLink,
    Supersedes: CAchievementLink,
    Tags: [SAchievementTag]
}) {
    static namespace;
}
class CAchievementTerm extends CClass.Ex({
    Name: CStringLink,
    Description: CStringLink,
    Evaluate: EAchievementTermEvaluate,
    Flags: FAchievementTerm,
    Compare: EValueCompare,
    Previous: EAchievementTermPrevious,
    Quantity: UInt,
    Repeat: UInt
}) {
    static namespace;
}
class CAchievementTermAbil extends CAchievementTerm.Ex({
    AbilCmd: CAbilCommand,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermAbilInteract extends CAchievementTerm.Ex({
    AbilCmd: CAbilCommand,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermAbilLoad extends CAchievementTerm.Ex({
    AbilCmd: CAbilCommand,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermAbilUse extends CAchievementTerm.Ex({
    AbilCmd: CAbilCommand,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermAchievement extends CAchievementTerm.Ex({
    Child: CAchievementLink
}) {
}
class CAchievementTermBehavior extends CAchievementTerm.Ex({
    Behavior: CBehaviorLink
}) {
}
class CAchievementTermBehaviorAbsorbed extends CAchievementTerm.Ex({
    Behavior: CBehaviorLink
}) {
}
class CAchievementTermBehaviorCount extends CAchievementTerm.Ex({
    Behavior: CBehaviorLink
}) {
}
class CAchievementTermBehaviorElapsed extends CAchievementTerm.Ex({
    Behavior: CBehaviorLink,
    ElapsedTime: CGameTime,
    ElapsedCompare: EValueCompare
}) {
}
class CAchievementTermBehaviorState extends CAchievementTerm.Ex({
    Behavior: CBehaviorLink,
    State: Bit,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermCombine extends CAchievementTerm.Ex({
    Type: EAchievementTermCombine,
    ChildTable: [CAchievementTermLink]
}) {
}
class CAchievementTermEffect extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectAbsorbed extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectDamaged extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectDodged extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectHealed extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectKilled extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermEffectUse extends CAchievementTerm.Ex({
    Effect: CEffectLink,
    WhichPlayer: SEffectWhichPlayer,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermGeneric extends CAchievementTerm.Ex({}) {
}
class CAchievementTermReplay extends CAchievementTerm.Ex({}) {
}
class CAchievementTermScoreValue extends CAchievementTerm.Ex({
    ScoreValue: CScoreValueLink
}) {
}
class CAchievementTermTime extends CAchievementTerm.Ex({}) {
}
class CAchievementTermUnit extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermUnitBirth extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermUnitDeath extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermUnitKills extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink]
}) {
}
class CAchievementTermUnitRegen extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink],
    Vital: EUnitVital
}) {
}
class CAchievementTermUnitSupplyLoss extends CAchievementTerm.Ex({
    Unit: CUnitLink,
    ValidatorArray: [CValidatorLink],
    Period: CGameTime
}) {
}
class CActor extends CClass.Ex({
    CopySource: CActorKey,
    Terms: CActorTerms,
    Aliases: [CActorKey],
    Macros: [CActorKey],
    Sharing: EActorRequestCreateSharing,
    Flags: FActorFlags,
    Filter: FActorFilter,
    FilterAtCreation: FActorFilterAtCreation,
    VisibleTo: FActorVisibleTo,
    VisibleToAtCreation: FActorVisibleToAtCreation,
    FilterPlayers: FActorFilterPlayers,
    VisibleToPlayers: FActorVisibleToPlayers,
    Inherits: FActorInherits,
    InheritType: EActorHostedPropInheritType,
    AcceptedTransfers: FActorTransfer,
    AcceptedHostedPropTransfers: FActorHostedPropTransfer,
    FogVisibility: EFogVisibility,
    EditorCategories: TEditorCategories,
    PlayerIdSource: EActorPlayerIdSource,
    Supporter: SActorRequest,
    Preload: [CPreloadLink],
    VisibilityShape: SActorVisibilityShape
}) {
    static namespace;
}
CActorAttributePath.dataClass = CActor;
class CActorSupport extends CActor.Ex({}) {
}
class CActorBase extends CActor.Ex({
    Remove: [SActorEvent],
    On: [SActorEvent]
}) {
}
class CActorBearings extends CActorBase.Ex({
    AddToProximitySystem: Bit,
    HostForProps: SActorRequest,
    Host: SActorRequest,
    HostSiteOps: SActorSiteOpsData,
    ScopeBearingsTracking: EActorScopeBearingsTrackingType,
    MaxScale: Real32
}) {
}
class CActorCamera extends CActorBearings.Ex({
    Camera: CCameraLink,
    HostEye: SActorRequest,
    HostEyeSiteOps: SActorSiteOpsData
}) {
}
class CActorModel extends CActorBearings.Ex({
    Model: CModelLink,
    ModelAspectSets: [SActorModelAspectSet],
    Scale: CScaleVector,
    AutoScaleFactor: Real32,
    AutoScaleFromSelectionFactor: Real32,
    AnimBlendTime: Real32,
    HostedAttaches: [SActorHostedAttach],
    InternalSplatHeight: EActorSplatHeight,
    HostFor2ndVisibilityTest: SActorRequest,
    HostSiteOpsFor2ndVisibilityTest: SActorSiteOpsData,
    LocalOffsetFor2ndVisibilityTest: C3Vector,
    ModelFlags: FActorModel,
    EventDataFootprint: [SEventDataFootprint],
    EventDataFootprintActor: CActorCreateKey,
    EventDataSound: [SEventDataSound],
    EventDataSoundActor: CActorCreateKey,
    ProximityPosition: EActorProximity,
    CreepHeightClass: CActorLabelKey,
    CreepRateGrow: CActorLabelKey,
    CreepRateShrink: CActorLabelKey,
    PhysicsImpactDefault: SActorPhysicsImpactData,
    PhysicsImpacts: [SActorPhysicsImpactData],
    ModelMaterialGlazeDisplayLimit: UInt32,
    LookAtPriorityList: [CActorKey]
}) {
}
class CActorModelMaterial extends CActorModel.Ex({
    MaterialType: EActorModelMaterialType,
    ModelMaterialFlags: FActorModelMaterial
}) {
}
class CActorQuad extends CActorBearings.Ex({
    LaunchActor: CActorCreateKey,
    LaunchHeight: Real32,
    CenterActor: CActorCreateKey,
    CenterHeight: Real32,
    ImpactActor: CActorCreateKey,
    ImpactHeight: Real32,
    Quad: CQuad,
    Height: Real32,
    Width: Real32,
    HeightRange: CRange,
    QuadFlags: FActorQuad,
    Decoration: SActorQuadDecoration,
    OriginHeightLookaheadDistance: Real32,
    OriginHeightLookaheadIncrement: Real32,
    HostImpact: SActorRequest,
    HostImpactSiteOps: SActorSiteOpsData
}) {
}
class CActorForce extends CActorModel.Ex({
    Receiver: SActorRequest,
    Field: EActorForceField,
    Duration: CVariatorActorReal32,
    Magnitude: CVariatorActorReal32,
    ForceFlags: FForceFlags
}) {
}
class CActorForceLineSegment extends CActorForce.Ex({
    HostEnd: SActorRequest,
    HostEndSiteOps: SActorSiteOpsData
}) {
}
class CActorBeam extends CActorModel.Ex({
    HostLaunch: SActorRequest,
    HostLaunchSiteOps: SActorSiteOpsData,
    HostImpact: SActorRequest,
    HostImpactSiteOps: SActorSiteOpsData
}) {
}
class CActorRange extends CActorBearings.Ex({
    Abil: SActorRangeAbil,
    Behavior: CBehaviorLink,
    Sight: CUnitLink,
    Weapon: CWeaponLink,
    Range: Real32,
    Arc: Real32,
    Icon: CImageLink,
    IconScale: C2Vector,
    IconArcLength: Real32,
    IconTint: CColor,
    RangeFlags: FRangeFlags,
    CliffLevelFlags: FCliffLevelCompare
}) {
}
class CActorSound extends CActorBearings.Ex({
    Sound: CSoundLink,
    SoundFlags: FSoundFlags,
    Layers: [SActorSoundLayer],
    PlayMode: EActorSoundPlayMode,
    LoopCount: Int32
}) {
}
class CActorSplat extends CActorBearings.Ex({
    Color: CColor,
    FadeIn: Real32,
    FadeOut: Real32,
    HoldTime: Real32,
    Layer: ESplatLayer,
    Model: CModelLink,
    Scale: CScaleVector,
    AutoScaleFactor: Real32,
    AutoScaleFromSelectionFactor: Real32,
    Height: EActorSplatHeight
}) {
}
class CActorAction extends CActorBase.Ex({
    LaunchGuideAlias: CActorKey,
    LaunchSiteOps: SActorSiteOpsData,
    LaunchSite: CActorCreateKey,
    LaunchSiteFallback: CActorCreateKey,
    LaunchAttachQuery: SAttachQuery,
    LaunchRequest: SActorRequest,
    LaunchAssets: SActorAVPair,
    LaunchModel: CActorCreateKey,
    LaunchSound: CActorCreateKey,
    LaunchTerrainSquibModel: CActorCreateKey,
    LaunchTerrainSquibSound: CActorCreateKey,
    LaunchTerrainSquibMap: [SActorActionTerrainSquib],
    ContainerSiteOps: SActorSiteOpsData,
    ContainerSite: CActorCreateKey,
    ContainerAttachQuery: SAttachQuery,
    ContainerAssets: SActorAVPair,
    ContainerModel: CActorCreateKey,
    ContainerSound: CActorCreateKey,
    ContainerTerrainSquibModel: CActorCreateKey,
    ContainerTerrainSquibSound: CActorCreateKey,
    ContainerTerrainSquibMap: [SActorActionTerrainSquib],
    Beam: CActorKey,
    BeamScope: EActorEffectScope,
    Missile: CActorKey,
    HostImpactSource: SActorRequest,
    ImpactGuideAlias: CActorKey,
    ImpactSiteOps: SActorSiteOpsData,
    ImpactSiteOpsReaction: SActorSiteOpsData,
    ImpactSite: CActorCreateKey,
    ImpactSiteFallback: CActorCreateKey,
    ImpactAttachQuery: SAttachQuery,
    ImpactReattachQuery: SAttachQuery,
    ImpactPointSiteOps: SActorSiteOpsData,
    ImpactPointSite: CActorCreateKey,
    ImpactMap: { index: EImpactMap, value: SActorAVCluster },
    ImpactModel: CActorCreateKey,
    ImpactModelReaction: CActorCreateKey,
    ImpactSound: CActorCreateKey,
    ImpactPhysics: [SActorPhysicsData],
    ImpactTerrainSquibModel: CActorCreateKey,
    ImpactTerrainSquibSound: CActorCreateKey,
    ImpactTerrainSquibMap: [SActorActionTerrainSquib],
    DamageSiteOps: SActorSiteOpsData,
    DamageSiteOpsReaction: SActorSiteOpsData,
    DamageSite: CActorCreateKey,
    DamageAttachQuery: SAttachQuery,
    DamageReattachQuery: SAttachQuery,
    DamageMap: { index: EDamageMap, value: SActorAVCluster },
    DamageModel: CActorCreateKey,
    DamageModelReaction: CActorCreateKey,
    DamageSound: CActorCreateKey,
    DamagePhysics: [SActorPhysicsData],
    DamageTerrainSquibModel: CActorCreateKey,
    DamageTerrainSquibSound: CActorCreateKey,
    DamageTerrainSquibMap: [SActorActionTerrainSquib],
    AcquisitionYawHalfArc: CActorAngle,
    AcquisitionPitchHalfArc: CActorAngle,
    AccuracyHalfArc: CActorAngle,
    WeaponFireTrackingTimeWindow: Real32,
    ShieldFlashType: EActorShieldFlashType,
    ShieldRippleScaleFactor: Real32,
    ActionFlags: FActionFlags,
    AttackAnimSource: CRefKey,
    AttackAnimName: CAnimNameKey,
    ForceCommencementFrom: CEffectLink,
    CombatRevealDurationType: EActorCombatRevealDurationType,
    Lifetime: Real32
}) {
}
class CActorActionOverride extends CActorBase.Ex({
    MissileModel: CModelLink,
    ImpactModel: CModelLink,
    DamageModel: CModelLink
}) {
}
class CActorArc extends CActorModel.Ex({
    Angle: Real32,
    Radius: Real32,
    AngleAnimProps: CAnimProps
}) {
}
class CActorBeamSimple extends CActorModel.Ex({
    HostLaunch: SActorRequest,
    HostLaunchSiteOps: SActorSiteOpsData,
    HostImpact: SActorRequest,
    HostImpactSiteOps: SActorSiteOpsData
}) {
}
class CActorBeamStandard extends CActorBeamSimple.Ex({
    Beam: CBeamLink
}) {
}
class CActorBlob extends CActorBase.Ex({
    InitScale: C2Vector,
    MaxScale: C2Vector,
    ScaleDeltaTime: C2Vector
}) {
}
class CActorCameraModel extends CActorModel.Ex({
    Camera: CRefKey,
    DoFAttenuationStartModel: CModelLink,
    DoFAttenuationEndModel: CModelLink
}) {
}
class CActorCreep extends CActorBase.Ex({
    FoliageSpawnTarget: CActorCreateKey,
    SubjectResponses: [SActorQuerySubjectResponse]
}) {
}
class CActorCutscene extends CActorBearings.Ex({
    FilePath: CCutsceneFile
}) {
}
class CActorDoodad extends CActorModel.Ex({
    DoodadFlags: FActorDoodad,
    EditorFlags: FEditor,
    EditorModel: CModelLink,
    EditorAnim: CAnimProps,
    EditorIcon: CImageLink,
    TexSets: [CTerrainLink],
    Facing: CFacing,
    EditorFacingAlignment: CFangle,
    Footprint: CFootprintLink,
    Radius: Real32,
    RandomScaleRange: CRange,
    OccludeHeight: Real,
    BoostedCliffLevel: TCliffLevel,
    BoostedHeight: { index: EBoostedHeight, value: Real },
    MinimapIcon: CImageLink,
    MinimapRenderPriority: CActorKey,
    MinimapSize: C2Vector,
    MinimapShape: EMinimapShape,
    MinimapColor: CColor,
    MinimapImage: CImageLink,
    VisibleOpacity: Real32,
    ShadowWhenTransparent: Bit,
    VisibleOpacityBlendDuration: Real32,
    IgnoreDurationOnLow: Bit,
    NoFlyZoneSoftRadius: Real,
    NoFlyZoneHardRadius: Real
}) {
}
class CActorDoodadPreserver extends CActorModel.Ex({}) {
}
class CActorFoliageFXSpawner extends CActorBearings.Ex({
    Radius: Real32,
    SpawnTarget: CActorCreateKey
}) {
}
class CActorEditorCamera extends CActorModel.Ex({}) {
}
class CActorEditorPoint extends CActorModel.Ex({}) {
}
class CActorEventMacro extends CActorBase.Ex({}) {
}
class CActorEventMacroRunnable extends CActorBase.Ex({
    Do: [SActorEvent]
}) {
}
class CActorForceBox extends CActorForce.Ex({
    Height: CVariatorActorReal32,
    Length: CVariatorActorReal32,
    Width: CVariatorActorReal32,
    Origin: EActorForceOrigin
}) {
}
class CActorForceConeRoundedEnd extends CActorForce.Ex({
    HostEnd: SActorRequest,
    HostEndSiteOps: SActorSiteOpsData,
    Angle: CVariatorActorAngle,
    Length: CVariatorActorReal32
}) {
}
class CActorForceCylinder extends CActorForce.Ex({
    HostEnd: SActorRequest,
    HostEndSiteOps: SActorSiteOpsData,
    Radius: CVariatorActorReal32,
    Length: CVariatorActorReal32
}) {
}
class CActorForceSphere extends CActorForce.Ex({
    Radius: CVariatorActorReal32,
    IsHemisphere: Bit,
    Direction: EActorForceDirection
}) {
}
class CActorGlobalConfig extends CActorBase.Ex({
    ActorUnitFallback: CActorCreateKey,
    AttachHarnessActor: CActorCreateKey,
    AttachHarnessSOpAttach: CActorLink,
    AttachHarnessSOpLocalOffset: CActorLink,
    AttachHarnessSOpRotationExplicit: CActorLink,
    BodySquibs: [SActorDeathBodySquib],
    CloakModel: CModelLink,
    CloakModelLow: CModelLink,
    CloakTransitionArray: { index: ECloakTransitionArray, value: SActorCloakTransition },
    CommandUIActor: CActorCreateKey,
    CreepEngulfmentModel: CModelLink,
    CreepHeightClasses: [SActorCreepHeightClass],
    CreepRates: [SActorCreepRate],
    DeathCustomPriorityList: [CActorKey],
    DeathCustoms: [SActorDeathDataCustom],
    MainActor: CActorKey,
    MaxSpeedForSound: Real,
    MinimapRenderPriorityList: [CActorKey],
    MissileBoundsOptSpeedThreshold: Real32,
    ModelCacheFallback: CModelLink,
    ModelMaterialPriorityList: [CActorKey],
    PopulationLimitModel: UInt32,
    RevealTint: CColorHDR,
    SceneActor: CActorKey,
    LookAtTypes: [SLookAtType],
    SplatEmitterInit: SSplatEmitterInitInfo
}) {
}
class CActorOverrides extends CActorBase.Ex({
    ModelOverrides: [SActorOverrideModel]
}) {
}
class CActorLight extends CActorModel.Ex({}) {
}
class CActorLightOmni extends CActorModel.Ex({}) {
}
class CActorLightSpot extends CActorModel.Ex({}) {
}
class CActorLightModel extends CActorModel.Ex({
    Light: CRefKey
}) {
}
class CActorLightOmniModel extends CActorModel.Ex({
    Light: CRefKey
}) {
}
class CActorLightSpotModel extends CActorModel.Ex({
    Light: CRefKey
}) {
}
class CActorLookAt extends CActorBase.Ex({
    HostTarget: SActorRequest,
    HostTargetSiteOps: SActorSiteOpsData,
    Type: CActorKey,
    Types: [SLookAtType]
}) {
}
class CActorList extends CActorBase.Ex({
    IsAutoDestroy: Bit
}) {
}
class CActorListPerPlayer extends CActorList.Ex({}) {
}
class CActorPortrait extends CActorModel.Ex({
    FaceFXTarget: CRefKey,
    AnimTargets: CRefKey
}) {
}
class CActorPower extends CActorBase.Ex({
    PowerSource: CBehaviorLink,
    VisualArray: [CActorCreateKey]
}) {
}
class CActorProgress extends CActorBase.Ex({
    StageArray: [SActorProgressStage]
}) {
}
class CActorPropertyCurveSet extends CActorBase.Ex({}) {
}
class CActorQueryResponse extends CActorBase.Ex({
    Subject: SActorQuerySubject,
    OnResponse: [SActorQueryResponse]
}) {
}
class CActorRegion extends CActorBearings.Ex({
    QueryAbilCmd: CAbilCommand,
    QueryEffect: CEffectLink,
    QueryFilters: CTargetFilters,
    QueryRange: Real32,
    NotifyRadiusKey: CRefKey,
    NotifyArcKey: CRefKey,
    NotifyClosestScaleKey: CRefKey,
    RegionFlags: FRegionFlags
}) {
}
class CActorRegionArc extends CActorRegion.Ex({
    Angle: Real32,
    Radius: Real32
}) {
}
class CActorRegionCircle extends CActorRegion.Ex({
    Radius: Real32
}) {
}
class CActorRegionCombine extends CActorRegion.Ex({
    ChildArray: [CActorCreateKey]
}) {
}
class CActorRegionGame extends CActorRegion.Ex({}) {
}
class CActorRegionPolygon extends CActorRegion.Ex({
    PointArray: [C2Vector]
}) {
}
class CActorRegionQuad extends CActorRegion.Ex({
    Quad: CQuad,
    Height: Real32,
    Width: Real32
}) {
}
class CActorRegionWater extends CActorRegion.Ex({}) {
}
class CActorScene extends CActorBase.Ex({}) {
}
class CActorSelection extends CActorBearings.Ex({
    Color: CColor,
    FadeIn: Real32,
    FadeOut: Real32,
    HoldTime: Real32,
    Layer: ESplatLayer,
    Model: CModelLink,
    Scale: CScaleVector,
    AutoScaleFactor: Real32,
    AutoScaleFromSelectionFactor: Real32,
    Height: EActorSplatHeight,
    Alpha: C3Vector,
    FallOff: Real32,
    InnerBoundaryFallOffRatio: Real32,
    InnerBoundaryRatio: Real32,
    InnerOffsetRatio: Real32,
    InnerWidth: Real32,
    OuterWidth: Real32,
    HalfHeight: Real32,
    Attenuation: Real32,
    HostRadiusPercent: Real32,
    RotationSpeed: Real32,
    SegmentCount: UInt32,
    SegmentPercentSolid: Real32,
    SelectionFlags: FSelectionFlags,
    SelectionFilter: FSelectionFilter
}) {
}
class CActorSetQueried extends CActorBase.Ex({
    Host: SActorRequest,
    AttachQuery: SAttachQuery,
    SpawnTarget: CActorCreateKey,
    RequiredSquibType: ESquibType
}) {
}
class CActorShadow extends CActorBearings.Ex({
    Color: CColor,
    FadeIn: Real32,
    FadeOut: Real32,
    HoldTime: Real32,
    Layer: ESplatLayer,
    Model: CModelLink,
    Scale: CScaleVector,
    AutoScaleFactor: Real32,
    AutoScaleFromSelectionFactor: Real32,
    Height: EActorSplatHeight,
    Alpha: C3Vector,
    FallOff: Real32,
    HalfHeight: Real32,
    Attenuation: Real32,
    HostRadiusPercent: Real32
}) {
}
class CActorShield extends CActorModel.Ex({
    Ripple: CActorCreateKey,
    ScaleDamageMin: Real32,
    ScaleDamageMax: Real32,
    RadiusMin: Real32,
    RadiusMax: Real32
}) {
}
class CActorShieldImpact extends CActorBase.Ex({
    VisualDirectionalFacer: CActorCreateKey,
    VisualDirectionalHeader: CActorCreateKey,
    VisualDirectionless: CActorCreateKey,
    RadiusMedium: Real32,
    RadiusLarge: Real32,
    MaxCountSmall: UInt32,
    MaxCountMedium: UInt32,
    MaxCountLarge: UInt32
}) {
}
class CActorSimple extends CActorBase.Ex({}) {
}
class CActorSite extends CActorBearings.Ex({
    SiteFlags: FSiteFlags
}) {
}
class CActorSiteBillboard extends CActorSite.Ex({
    BillboardType: EActorSiteBillboardType,
    TowardsCameraDistance: Real32,
    HoldRotation: Bit,
    UpdateDriveBearings: Bit
}) {
}
class CActorSiteMover extends CActorSite.Ex({
    Acceleration: Real32,
    Deceleration: Real32,
    Speed: Real32,
    SpeedMax: Real32
}) {
}
class CActorSiteOrbiter extends CActorSite.Ex({
    Type: EActorSiteOrbiterType,
    BaseYaw: CVariatorActorFangle,
    BaseYawPeriod: CVariatorActorReal32,
    BasePitch: CVariatorActorFangle,
    BasePitchPeriod: CVariatorActorReal32,
    BaseRadiusInner: CVariatorActorReal32,
    BaseRadiusOuter: CVariatorActorReal32,
    BaseRadiusPeriod: CVariatorActorReal32,
    EndYawPeriod: CVariatorActorReal32,
    EndPitchPeriod: CVariatorActorReal32,
    EndRollPeriod: CVariatorActorReal32,
    EndRadiusInner: CVariatorActorReal32,
    EndRadiusOuter: CVariatorActorReal32,
    EndRadiusPeriod: CVariatorActorReal32
}) {
}
class CActorSiteRocker extends CActorSite.Ex({
    Elevation: CVariatorActorReal32,
    ElevationPeriod: CVariatorActorReal32,
    Pitch: CVariatorActorFangle,
    PitchPeriod: CVariatorActorReal32,
    Roll: CVariatorActorFangle,
    RollPeriod: CVariatorActorReal32
}) {
}
class CActorSiteOp extends CActorBase.Ex({
    HoldPosition: Bit,
    HoldRotation: Bit
}) {
}
class CActorSiteOpBase extends CActorSiteOp.Ex({}) {
}
class CActorSiteOp2DRotation extends CActorSiteOp.Ex({}) {
}
class CActorSiteOpAction extends CActorSiteOp.Ex({
    Location: EActorSiteOpActionLocation
}) {
}
class CActorSiteOpAttach extends CActorSiteOp.Ex({
    AttachQuery: SAttachQuery,
    ReattachQuery: SAttachQuery,
    ForceSoftAttach: Bit,
    Source: EActorSiteOpAttachSource
}) {
}
class CActorSiteOpAttachVolume extends CActorSiteOp.Ex({
    HostIncoming: SActorRequest,
    HostIncomingSiteOps: SActorSiteOpsData,
    UpwardVisibilityEnhancement: Bit,
    UpwardVisibilityEnhancementVarianceUp: CActorAngle,
    UpwardVisibilityEnhancementVarianceDown: CActorAngle
}) {
}
class CActorSiteOpBanker extends CActorSiteOp.Ex({
    RollAngleMax: CActorAngle,
    RollInRate: CActorAngle,
    RollOutRate: CActorAngle,
    RollOutRemainderFractionForLevelOff: Real32
}) {
}
class CActorSiteOpBankerUnit extends CActorSiteOp.Ex({
    RollMax: CVariatorActorAngle,
    RollInActivationAngle: CActorAngle,
    RollInArc: CVariatorActorAngle,
    RollOutDuration: CVariatorActorReal32
}) {
}
class CActorSiteOpBasic extends CActorSiteOp.Ex({
    BasicType: EActorSiteOpBasicType,
    WorldPosition: C3Vector
}) {
}
class CActorSiteOpGameCameraFollow extends CActorSiteOp.Ex({}) {
}
class CActorSiteOpDeathMotion extends CActorSiteOp.Ex({
    HostInitial: SActorRequest,
    HostInitialSiteOps: SActorSiteOpsData,
    Deceleration: Real32
}) {
}
class CActorSiteOpDeltaSum extends CActorSiteOp.Ex({
    Deltas: [SActorHostedDelta],
    DeltaSumFlags: FDeltaSumFlags
}) {
}
class CActorSiteOpEffect extends CActorSiteOp.Ex({
    Location: EActorEffectLocation,
    ZOnly: Bit
}) {
}
class CActorSiteOpForward extends CActorSiteOp.Ex({
    Forward: C3Vector,
    HostForward: SActorRequest,
    HostForwardSiteOps: SActorSiteOpsData,
    Invert: Bit
}) {
}
class CActorSiteOpHeight extends CActorSiteOp.Ex({
    HeightSourceType: EActorHeightSourceType,
    HostHeight: SActorRequest
}) {
}
class CActorSiteOpHigherOfTerrainAndWater extends CActorSiteOp.Ex({
    HeightSourceType: EActorHeightSourceType,
    ForcedWadingMaxDepth: Real32,
    TerrainAndWaterFlags: FTerrainAndWaterFlags
}) {
}
class CActorSiteOpHostBearings extends CActorSiteOp.Ex({
    HostBearings: SActorRequest,
    HostBearingsSiteOps: SActorSiteOpsData
}) {
}
class CActorSiteOpHostedOffset extends CActorSiteOp.Ex({
    HostOffset: SActorRequest,
    HostOffsetSiteOps: SActorSiteOpsData
}) {
}
class CActorSiteOpIncoming extends CActorSiteOp.Ex({
    HostImpact: SActorRequest,
    HostIncoming: SActorRequest,
    Type: EActorIncomingType,
    PullBack: Real32,
    FreezePositionAtImpact: Bit
}) {
}
class CActorSiteOpLocalOffset extends CActorSiteOp.Ex({
    LocalOffset: C3Vector,
    OverridingLength: CVariatorActorReal32,
    OverridingLengthExtra: SAccumulatedFixed
}) {
}
class CActorSiteOpOrientAttachPointTo extends CActorSiteOp.Ex({
    AttachQuery: SAttachQuery,
    Type: EActorSiteOpOrientAttachPointToType
}) {
}
class CActorSiteOpPatch extends CActorSiteOp.Ex({
    PatchAngle: CActorAngle,
    PatchRadius: Real32,
    Distribution: EActorRadialDistribution,
    Mean: Real32,
    Variance: Real32
}) {
}
class CActorSiteOpPersistentOffset extends CActorSiteOp.Ex({
    HostInitial: SActorRequest,
    HostInitialSiteOps: SActorSiteOpsData
}) {
}
class CActorSiteOpOrbiter extends CActorSiteOp.Ex({
    Type: EActorSiteOrbiterType,
    BaseYaw: CVariatorActorFangle,
    BaseYawPeriod: CVariatorActorReal32,
    BasePitch: CVariatorActorFangle,
    BasePitchPeriod: CVariatorActorReal32,
    BaseRadiusInner: CVariatorActorReal32,
    BaseRadiusOuter: CVariatorActorReal32,
    BaseRadiusPeriod: CVariatorActorReal32,
    EndYawPeriod: CVariatorActorReal32,
    EndPitchPeriod: CVariatorActorReal32,
    EndRollPeriod: CVariatorActorReal32,
    EndRadiusInner: CVariatorActorReal32,
    EndRadiusOuter: CVariatorActorReal32,
    EndRadiusPeriod: CVariatorActorReal32
}) {
}
class CActorSiteOpPhysicsImpact extends CActorSiteOp.Ex({
    Type: EActorSiteOpPhysicsImpactType
}) {
}
class CActorSiteOpRandomPointInCircle extends CActorSiteOp.Ex({
    Radius: Real32,
    Distribution: EActorRadialDistribution,
    Mean: Real32,
    Variance: Real32,
    RestrictToCircumference: Bit,
    ObserveRotation: Bit
}) {
}
class CActorSiteOpRandomPointInCrossbar extends CActorSiteOp.Ex({
    HalfWidth: Real32,
    Distribution: EActorCrossbarDistribution,
    Variance: Real32
}) {
}
class CActorSiteOpRandomPointInSphere extends CActorSiteOp.Ex({
    Radius: Real32,
    Distribution: EActorRadialDistribution,
    Mean: Real32,
    Variance: Real32,
    RestrictToSurface: Bit
}) {
}
class CActorSiteOpRotationExplicit extends CActorSiteOp.Ex({
    Forward: C3Vector,
    Up: C3Vector,
    IsLocal: Bit
}) {
}
class CActorSiteOpRotationRandom extends CActorSiteOp.Ex({
    YawHalfAngle: CActorAngle,
    PitchHalfAngle: CActorAngle
}) {
}
class CActorSiteOpRotationVariancer extends CActorSiteOp.Ex({
    ForwardAngle: CActorAngle,
    UpAngle: CActorAngle,
    IsUpDominantWhenOrthogonalized: Bit
}) {
}
class CActorSiteOpRotator extends CActorSiteOp.Ex({
    LocalAxis: C3Vector,
    Rate: CActorAngle,
    Type: EActorSiteOpRotatorType,
    InitialAngle: CActorAngle
}) {
}
class CActorSiteOpRotationSmooth extends CActorSiteOp.Ex({
    Acceleration: CFangleRate,
    Deceleration: CFangleRate,
    MaxSpeed: CFangleRate
}) {
}
class CActorSiteOpSelectionOffset extends CActorSiteOp.Ex({}) {
}
class CActorSiteOpSerpentHead extends CActorSiteOp.Ex({
    Aggregate: SSerpentAggregate,
    Segment: SSerpentSegment
}) {
}
class CActorSiteOpSerpentSegment extends CActorSiteOp.Ex({
    Head: CRefKey,
    Segment: SSerpentSegment
}) {
}
class CActorSiteOpShadow extends CActorSiteOp.Ex({
    HeightSourceType: EActorHeightSourceType,
    HeightOffset: Real32,
    HeightOffsetOnCliff: Real32,
    CliffTests: [C2Vector],
    HeightTests: [C2Vector],
    HeightTestType: EActorHeightTestType,
    ShadowFlags: FShadowFlags
}) {
}
class CActorSiteOpTether extends CActorSiteOp.Ex({
    HostTether: SActorRequest,
    HostTetherSiteOps: SActorSiteOpsData,
    EnableX: EActorSiteOpTetherEnableType,
    EnableY: EActorSiteOpTetherEnableType,
    EnableZ: EActorSiteOpTetherEnableType,
    XMinimum: Real32,
    XMaximum: Real32,
    YMinimum: Real32,
    YMaximum: Real32,
    ZMinimum: Real32,
    ZMaximum: Real32
}) {
}
class CActorSiteOpTipability extends CActorSiteOp.Ex({
    TipabilityFlags: FTipabilityFlags
}) {
}
class CActorSiteOpTilter extends CActorSiteOp.Ex({
    TiltType: EActorTiltType,
    TiltAmount: Real32,
    AngleRate: Real32
}) {
}
class CActorSiteOpUp extends CActorSiteOp.Ex({
    Up: C3Vector,
    HostUp: SActorRequest,
    HostUpSiteOps: SActorSiteOpsData,
    Invert: Bit
}) {
}
class CActorSiteOpZ extends CActorSiteOp.Ex({
    HostZ: SActorRequest
}) {
}
class CActorSiteOpCursor extends CActorSiteOp.Ex({}) {
}
class CActorSiteOpYawLimiter extends CActorSiteOp.Ex({
    HostYawLimiter: SActorRequest,
    HostYawLimiterSiteOps: SActorSiteOpsData,
    YawHalfAngle: CActorAngle,
    ExtraYawAngle: CActorAngle
}) {
}
class CActorSiteOpPitchLimiter extends CActorSiteOp.Ex({
    HostPitchLimiter: SActorRequest,
    HostPitchLimiterSiteOps: SActorSiteOpsData,
    PitchHalfAngle: CActorAngle
}) {
}
class CActorSnapshot extends CActorModel.Ex({}) {
}
class CActorStateMonitor extends CActorBase.Ex({
    StateArray: [SActorStateInfo],
    StateThinkInterval: CGameTime
}) {
}
class CActorSquib extends CActorBearings.Ex({
    Map: { index: EActorSquibMap, value: SActorAVPair },
    HarnessModel: CActorCreateKey,
    HarnessSound: CActorCreateKey
}) {
}
class CActorBatch extends CActorBearings.Ex({
    HarnessActor: CActorCreateKey,
    Count: SAccumulatedUInt32
}) {
}
class CActorTerrain extends CActorBase.Ex({
    PhysicsImpactDefault: SActorPhysicsImpactData,
    PhysicsImpacts: [SActorPhysicsImpactData]
}) {
}
class CActorTerrainDeformer extends CActorBearings.Ex({
    Footprint: CFootprintLink,
    InfluenceRange: Real32,
    BlendTime: Real32,
    HeightDelta: Real32,
    TerrainDeformerFlags: FTerrainDeformerFlags,
    FoliageFXDeathSpawnTarget: CActorCreateKey
}) {
}
class CActorText extends CActorBearings.Ex({
    TextScale: Real32,
    MaxSize: C2Vector,
    FixedSize: UInt32,
    AlignH: EActorTextAlignment,
    AlignV: EActorTextAlignment,
    HeightOffset: Real32,
    Color: CColor,
    Options: FActorTextOptions,
    Text: CStringLink
}) {
}
class CActorTurret extends CActorBase.Ex({
    PitchQuery: SAttachQuery,
    YawQuery: SAttachQuery,
    TurretBody: SActorRequest
}) {
}
class CActorUnit extends CActorModel.Ex({
    Baselines: { index: EBaselines, value: SActorBaseline },
    BuildModel: CModelLink,
    DeathArray: { index: EDeathArray, value: SActorDeathData },
    DeathCustoms: [SActorDeathDataCustom],
    DeathCustomData: [SActorDeathDataCustomGroup],
    DeathActorModel: CActorCreateKey,
    DeathActorModelLow: CActorCreateKey,
    DeathActorSound: CActorCreateKey,
    DeathActorVoice: CActorCreateKey,
    EditorModel: CModelLink,
    EditorAnim: CAnimProps,
    ImpactSoundActor: CActorCreateKey,
    ImpactSound: CSoundLink,
    ImpactSoundExtras: [SActorUnitImpactSoundExtras],
    OverkillByDamagePastRemainingHealth: SDamagePastRemainingHealth,
    OverkillByDamageOverInterval: SDamageOverInterval,
    PhysicsMatchKeysOrdered: CActorTableKeys1x3,
    PlacementModel: CModelLink,
    PlacementSound: CSoundLink,
    PlacementActorModel: CActorCreateKey,
    PlaceholderActorModel: CActorCreateKey,
    PortraitActor: CActorCreateKey,
    PortraitModel: CModelLink,
    PortraitCamera: CCameraLink,
    RandomScaleRange: CRange,
    RingRadius: Real32,
    StandAnimTurnTime: CGameTime,
    StandAnimTurnTimeScaleMin: Real32,
    TerrainSquibs: [STerrainSquib],
    VarianceWindowStandIntro: Real32,
    VarianceWindowStand: Real32,
    VarianceWindowWalkIntro: Real32,
    VarianceWindowWalk: Real32,
    VarianceWindowWalkOutro: Real32,
    WalkAnimMoveSpeed: CGameRate,
    WalkAnimTimeScalingAsFlyer: Bit,
    AbilSoundArray: [SUnitAbilSound],
    AddonIndicator: CStringLink,
    BarDistance: UInt32,
    BarHeight: Int32,
    BarOffset: Int32,
    BarWidth: Int32,
    CantSelectUncontrollableTooltip: CStringLink,
    CooldownDisplay: [CAbilCommand],
    CustomUnitStatusFrame: CDescPath,
    CustomUnitStatusOffset: C2iVector,
    CustomUnitStatusAttachment: EAttachmentID,
    CustomUnitStatusActor: CRefKey,
    ErrorArray: [SErrorOverride],
    GlossaryAnim: CString,
    GroupIcon: SLayerIcon,
    GroupIconVariations: [SLayerIconVariation],
    GroupSoundArray: { index: EGroupSoundArray, value: CSoundLink },
    GroupSoundThreshold: UInt32,
    HeroIcon: CImageLink,
    HeroIconVariations: [SIconVariation],
    HighlightTooltip: CStringLink,
    HighlightSubTooltip: CStringLink,
    InfoText: CStringLink,
    LifeArmorIcon: CImageLink,
    MinimapIcon: CImageLink,
    MinimapIconIsTeamColored: Bit,
    MinimapIconScale: Real32,
    MinimapIconBackground: CImageLink,
    MinimapIconBackgroundIsTeamColored: Bit,
    MinimapIconBackgroundScale: Real32,
    MinimapIconBackgroundTintColor: CColor,
    MinimapIconTintColor: CColor,
    MinimapRenderPriority: CActorKey,
    MinimapTooltip: CStringLink,
    MinimapFlashWhenAttacked: Bit,
    MinimapUseSelfColor: Bit,
    MinimapUseSelectionColor: Bit,
    MinimapUnitStatusFrame: CDescPath,
    MovementHerdNode: CHerdNodeLink,
    NameOffset: Int32,
    SelectAbilCmd: CAbilCommand,
    ShieldArmorIcon: CImageLink,
    SnapshotActor: CActorCreateKey,
    SoundArray: { index: ESoundArray, value: CSoundLink },
    StatusBarFlags: FUnitStatus,
    StatusBarGroups: FUnitStatusGroup,
    StatusBarOn: FUnitStatus,
    StatusColors: { index: EUnitStatus, value: SStatusColor },
    StatusChargeData: SStatusChargeData,
    StatusHarvesterData: SStatusHarvesterData,
    StatusTextInfo: STextTagParameters,
    UnitBorderNormalColor: CColorRGB,
    UnitBorderSubgroupColor: CColorRGB,
    UnitFlags: FUnitFlags,
    UnitIcon: CImageLink,
    UnitIconVariations: [SIconVariation],
    UnitIconMultiple: CImageLink,
    UnitKillRank: [SUnitKillRank],
    UnitModelFrameActor: CActorCreateKey,
    VitalColors: { index: EUnitVital, value: SVitalColor },
    VitalNames: { index: EUnitVital, value: CStringLink },
    Wireframe: SLayerIcon,
    WireframeVariations: [SLayerIconVariation],
    WireframeShield: SLayerIconShield,
    WireframeShieldColor: CColor,
    WireframeShieldVariations: [SLayerIconShieldVariation],
    VisibleOpacity: Real32,
    VisibleOpacityBlendDuration: Real32,
    UnitButton: CButtonLink,
    UnitButtonMultiple: CButtonLink
}) {
}
class CActorUnitRing extends CActorModel.Ex({
    RingRadius: Real32
}) {
}
class CActorMissile extends CActorUnit.Ex({
    HostReturn: SActorRequest,
    HostReturnSiteOps: SActorSiteOpsData,
    IsTentacle: Bit,
    PreHost: CActorKey
}) {
}
class CActorMinimap extends CActorModel.Ex({}) {
}
class CAlert extends CClass.Ex({
    PrimaryActions: FAlertPrimaryActions,
    SecondaryActions: FAlertSecondaryActions,
    Display: FAlertDisplay,
    Flags: FAlertFlags,
    Fade: Real32,
    Icon: CImageLink,
    Life: Real32,
    OverlapDuration: Real32,
    OverlapGlobalCount: UInt32,
    OverlapLocalCount: UInt32,
    OverlapLocalRadius: Real,
    PingColor: CColor,
    PingModel: CModelLink,
    PingTime: Real32,
    QueueTime: Real32,
    Sound: CSoundLink,
    Text: CStringLink,
    Tooltip: CStringLink,
    Voice: EUnitSound,
    Peripheral: EAlertPeripheral,
    SupersededVolume: Real32
}) {
    static namespace;
}
class CArmyCategory extends CClass.Ex({
    Name: CStringLink,
    Title: CStringLink,
    Help: CStringLink,
    CategoryHelp: CStringLink,
    UnitHelp: CStringLink,
    Icon: CImageLink,
    BankPath: SBankPath,
    Description: CStringLink,
    State: EArmyCategoryState,
    Flags: FArmyCategory,
    Unit: CUnitLink,
    UpgradeArray: [CUpgradeLink],
    AbilCommandArray: [CAbilCommand],
    ArmyUnitArray: [CArmyUnitLink],
    ArmyUpgradeArray: [CArmyUpgradeLink],
    UserReference: CUserReference,
    ExtraUpgradeRequirement: Int32,
    SplitRequirement: Int32
}) {
    static namespace;
}
class CArmyUnit extends CClass.Ex({
    Name: CStringLink,
    Title: CStringLink,
    Help: CStringLink,
    Icon: CImageLink,
    BankPath: SBankPath,
    Description: CStringLink,
    Confirmation: CStringLink,
    Movie: CMovieFile,
    Cost: Int32,
    State: EArmyUnitState,
    Unit: CUnitLink,
    UpgradeArray: [CUpgradeLink],
    AbilCommandArray: [CAbilCommand],
    ArmyUpgradeArray: [CArmyUpgradeLink],
    UserReference: CUserReference,
    EnableButton: CString,
    Skin: CSkinLink
}) {
    static namespace;
}
class CArmyUpgrade extends CClass.Ex({
    Name: CStringLink,
    Icon: CImageLink,
    Requirements: CStringLink,
    Description: CStringLink,
    Tooltip: CStringLink,
    Cost: Int32,
    Movie: CMovieFile,
    State: EArmyUpgradeState,
    UpgradeArray: [CUpgradeLink],
    AbilCommandArray: [CAbilCommand],
    UserReference: CUserReference
}) {
    static namespace;
}
class CArtifact extends CClass.Ex({
    EditorCategories: TEditorCategories,
    Name: CStringLink,
    InfoText: CStringLink,
    AttributeId: CFourCC,
    Model: CModelLink,
    RankArray: [SArtifactRank],
    Universe: EHeroUniverse,
    TileCutsceneFile: CCutsceneFile,
    PreviewCutsceneFile: CCutsceneFile,
    HeroSelectCutsceneFile: CCutsceneFile,
    ReleaseDate: SProductReleaseDate,
    AdditionalSearchText: CStringLink,
    Talent: CTalentLink,
    Type: EArtifactType,
    HyperlinkId: THyperlinkId,
    AllowedCommanderKeyArray: [CIdentifier],
    Item: [CItemLink],
    Upgrades: [CUpgradeLink],
    PlayerResponses: [CPlayerResponseLink],
    Face: CButtonLink,
    ApplyTo: FPlayerRelationship
}) {
    static namespace;
}
class CArtifactSlot extends CClass.Ex({
    Name: CStringLink,
    RequiredReward: CRewardLink,
    ProductId: TBattleProductId,
    AllowedTypes: FArtifactType
}) {
    static namespace;
}
class CAttachMethod extends CClass.Ex({}) {
    static namespace;
}
class CAttachMethodArcTest extends CAttachMethod.Ex({
    Tests: FTests,
    Type: EAMArcTestType
}) {
}
class CAttachMethodBestMatch extends CAttachMethod.Ex({
    Keys: CAttachKeys,
    Flags: FAttachMethodBestMatch
}) {
}
class CAttachMethodFilter extends CAttachMethod.Ex({
    Keys: [SAttachKey],
    Logic: EAMFilterLogic,
    AttachType: EAMFilterAttachType,
    FilterType: EAMFilterType
}) {
}
class CAttachMethodAttachType extends CAttachMethod.Ex({
    AttachType: EAMAttachType
}) {
}
class CAttachMethodIncoming extends CAttachMethod.Ex({}) {
}
class CAttachMethodLeastDeflection extends CAttachMethod.Ex({}) {
}
class CAttachMethodNodeOccupancy extends CAttachMethod.Ex({
    Targets: [CModelFile],
    Logic: EAMOccupancyLogic
}) {
}
class CAttachMethodNodeOccupancy2 extends CAttachMethod.Ex({
    Targets: [CModelLink],
    Logic: EAMOccupancyLogic
}) {
}
class CAttachMethodNumericField extends CAttachMethod.Ex({
    Field: EAMNumericField,
    Value: Real32,
    Operator: EAMNumericFieldOp
}) {
}
class CAttachMethodPattern extends CAttachMethod.Ex({
    Type: EAMPatternType,
    Keyword: EAttachKeyword,
    Base: CDataSoupKey,
    Offset: UInt32,
    Multiplier: UInt32,
    Driver: CDataSoupKey
}) {
}
class CAttachMethodPortAllocator extends CAttachMethod.Ex({
    PortLimit: UInt32
}) {
}
class CAttachMethodProximity extends CAttachMethod.Ex({
    RequestCount: UInt32,
    DistanceMax: Real32,
    SortResults: Bit,
    Location: SEffectWhichLocation
}) {
}
class CAttachMethodRandom extends CAttachMethod.Ex({
    RequestCount: UInt32,
    Distribution: EAMRandomDistribution,
    ExponentialMean: Real32
}) {
}
class CAttachMethodReduction extends CAttachMethod.Ex({
    ReductionType: EAMReductionType,
    RequestCount: UInt32,
    RequestCountRange: UInt32,
    RequestPercentage: Real32,
    PassChanceEach: Real32,
    PassChanceFull: Real32
}) {
}
class CAttachMethodVolumesRequery extends CAttachMethod.Ex({}) {
}
class CAttachMethodVolumesTargets extends CAttachMethod.Ex({}) {
}
class CAttachMethodVolumesWeightedPick extends CAttachMethod.Ex({
    VolumeFactor: Real32,
    ProximityFactorNear: Real32,
    ProximityFactorFar: Real32
}) {
}
class CBankCondition extends CClass.Ex({}) {
    static namespace;
}
class CBankConditionCompare extends CBankCondition.Ex({
    Bank: CString,
    Section: CString,
    Key: CString,
    ValueName: CString,
    Compare: EValueCompare
}) {
}
class CBankConditionCompareValueCount extends CBankConditionCompare.Ex({
    AddCompare: EValueCompare,
    AddValue: Int32,
    Value: UInt32
}) {
}
class CBankConditionCompareValueInteger extends CBankConditionCompare.Ex({
    Value: Int32
}) {
}
class CBankConditionCompareValueString extends CBankConditionCompare.Ex({
    Value: CString
}) {
}
class CBankConditionCompareValueSum extends CBankConditionCompare.Ex({
    AddCompare: EValueCompare,
    AddValue: Int32,
    Value: Int32
}) {
}
class CBankConditionCombine extends CBankCondition.Ex({
    Type: EBankConditionCombine,
    CombineArray: [CBankConditionLink],
    Negate: Bit
}) {
}
class CBankConditionCurrentMap extends CBankCondition.Ex({
    Map: CString
}) {
}
class CBeam extends CClass.Ex({}) {
    static namespace;
}
class CBeamSync extends CBeam.Ex({}) {
}
class CBeamSyncSweeper extends CBeam.Ex({}) {
}
class CBeamAsync extends CBeam.Ex({}) {
}
class CBeamAsyncLinear extends CBeam.Ex({
    Duration: Real
}) {
}
class CBeamAsyncShadow extends CBeam.Ex({}) {
}
class CBehavior extends CClass.Ex({
    Face: CButtonLink,
    Name: CStringLink,
    Tooltip: CStringLink,
    InfoTooltipPriority: UInt32,
    Alignment: EBehaviorAlignment,
    Cost: SCost,
    BehaviorFlags: FBehaviorFlags,
    InfoFlags: FInfoFlags,
    InfoIcon: CImageLink,
    BehaviorCategories: FBehaviorCategory,
    EditorCategories: TEditorCategories,
    Requirements: CRequirementLink,
    TechAliasArray: [TTechAlias],
    SortIndex: Int32,
    DebugTrace: Bit
}) {
    static namespace;
}
class CBehaviorAttackModifier extends CBehavior.Ex({
    Chance: SAccumulatedFixed,
    TargetFilters: CTargetFilters,
    ValidatorArray: [CValidatorLink],
    UniqueSetId: CIdentifier,
    AttackModifierFlags: FAttackModifierFlags,
    WeaponIndexEnableArray: FWeaponIndexEnableArray,
    WeaponIndexDisableArray: FWeaponIndexDisableArray,
    MaxStackCount: UInt32,
    DamageDealtScaled: { index: EDamageKind, value: SAccumulatedFixed },
    DamageDealtFraction: { index: EDamageKind, value: SAccumulatedFixed },
    DamageDealtUnscaled: { index: EDamageKind, value: SAccumulatedFixed },
    DamageTotalMultiplier: { index: EDamageKind, value: SAccumulatedFixed },
    PreImpactEffect: CEffectLink,
    ImpactDamageInheritEffect: CEffectLink,
    MultishotSearchPattern: CEffectLink
}) {
}
class CBehaviorAttribute extends CBehavior.Ex({
    PrimaryName: CStringLink,
    PrimaryTooltip: CStringLink,
    MinPoints: Int32,
    MaxPoints: Int32,
    Modification: SModification,
    PointGainEffect: CEffectLink,
    PointLossEffect: CEffectLink,
    PointDisplayFlags: FEquipmentDisplay
}) {
}
class CBehaviorUnitTracker extends CBehavior.Ex({
    TrackingValidatorArray: [CValidatorLink],
    MaxTrackedUnits: UInt32,
    UnitAddedAtMaxRule: EBehaviorUnitTrackerAtMaxRule,
    ReplacedEffect: CEffectLink,
    UnitTrackerFlags: FUnitTrackerFlags,
    WhichLocation: SEffectWhichLocation,
    SnapRange: Real,
    SnapCount: SAccumulatedUInt32,
    SnapRule: EBehaviorUnitTrackerSnapRule,
    SnapAngleAdjustment: CFangle,
    SharedListPlayer: SEffectWhichPlayer
}) {
}
class CBehaviorBuff extends CBehavior.Ex({
    DisplayDuration: FDisplayDuration,
    DisplayShield: FDisplayShield,
    DisableValidatorArray: [CValidatorLink],
    RemoveValidatorArray: [CValidatorLink],
    BuffFlags: FBuffFlags,
    MaxStackCount: UInt32,
    MaxStackCountPerCaster: UInt32,
    TimeScaleSource: SEffectWhichTimeScale,
    Duration: SAccumulatedGameTime,
    DurationOverride: [SBehaviorDuration],
    DurationShield: CGameTime,
    DurationVitalArray: { index: EUnitVital, value: CGameTime },
    DurationVitalMaxArray: { index: EUnitVital, value: CGameTime },
    DurationRandomMin: CGameTime,
    DurationRandomMax: CGameTime,
    DurationBonusMin: CGameTime,
    DurationBonusMax: CGameTime,
    Period: CGameTime,
    PeriodCount: UInt32,
    InitialEffect: CEffectLink,
    RefreshEffect: CEffectLink,
    PeriodicEffect: CEffectLink,
    PeriodicEffectRateMultiplier: SAccumulatedFixed,
    PeriodicDisplayEffect: [CEffectLink],
    FinalEffect: CEffectLink,
    ExpireEffect: CEffectLink,
    Player: SEffectWhichPlayer,
    AcquirePlayer: SEffectWhichPlayer,
    Modification: SModification,
    DeathType: EDeathType,
    AINotifyEffect: CEffectLink,
    DamageResponse: SDamageResponse,
    KillCredit: SEffectWhichUnit,
    Replace: EBehaviorBuffReplace,
    ReplaceLocation: SEffectWhichLocation,
    HerdNode: CHerdNodeLink,
    VitalRegenVitalsRemain: { index: EUnitVital, value: SVitalRegenVitalRemain },
    VitalRegenVitalsRemainPercent: { index: EUnitVital, value: SVitalRegenVitalRemain },
    RevealUnit: SEffectWhichUnit,
    StackAlias: CIdentifier,
    StackAliasPriority: UInt32
}) {
}
class CBehaviorClickResponse extends CBehavior.Ex({
    Chance: Real,
    Count: UInt32,
    CountDelay: CGameTime,
    CountEffect: CEffectLink,
    Relationship: FPlayerRelationship,
    ResetDelay: CGameTime,
    ResetEffect: CEffectLink
}) {
}
class CBehaviorConjoined extends CBehavior.Ex({
    ConjoinedFlags: FConjoinedFlags,
    Radius: Real
}) {
}
class CBehaviorCreepSource extends CBehavior.Ex({
    Delay: CGameTime,
    Period: CGameTime,
    Build: CFootprintLink,
    Start: CFootprintLink,
    Birth: CFootprintLink,
    Grown: CFootprintLink,
    DisableValidatorArray: [CValidatorLink],
    RemoveValidatorArray: [CValidatorLink]
}) {
}
class CBehaviorJump extends CBehavior.Ex({
    TriggerHeightDeltaMin: Real,
    TriggerHeightDeltaMax: Real,
    InitiateRangeUp: Real,
    InitiateRangeDown: Real,
    JumpRangeMax: Real,
    JumpEffectUp: CEffectLink,
    JumpEffectDown: CEffectLink,
    Mover: CMoverLink,
    MoverUp: CMoverLink,
    MoverDown: CMoverLink,
    DurationPreLaunch: CGameTime,
    DurationPostLand: CGameTime,
    DurationMoveOut: CGameTime,
    Placeholder: CUnitLink,
    LandAdjustmentUp: Real,
    LandAdjustmentDown: Real,
    LandArrivalRange: Real,
    LandCheckRadius: Real,
    LandEffectUp: CEffectLink,
    LandEffectDown: CEffectLink
}) {
}
class CBehaviorPowerSource extends CBehavior.Ex({
    PowerLevel: TPowerLevel,
    Radius: Real,
    PowerLink: TPowerLink,
    CliffLevelFlags: FCliffLevelCompare,
    Flags: FBehaviorPowerSource
}) {
}
class CBehaviorPowerUser extends CBehavior.Ex({
    PowerLink: TPowerLink,
    PlacementMinPowerLevel: TPowerLevel,
    Flags: FBehaviorPowerUser,
    PoweredWhileUnderConstruction: Bit,
    PowerStageArray: [SPowerStage]
}) {
}
class CBehaviorResource extends CBehavior.Ex({
    Capacity: UInt32,
    Contents: UInt32,
    HarvestTime: CGameTime,
    HarvestAmount: UInt32,
    EmptyDeathType: EDeathType,
    EmptyHarvestAmount: UInt32,
    EmptyUnit: CUnitLink,
    Flags: FBehaviorResource,
    RequiredAlliance: EAllianceId,
    ReturnDelay: CGameTime,
    ExhaustedAlert: CAlertLink,
    DepletionAlert: CAlertLink,
    DepletionThreshold: UInt32,
    DepletionVariationCount: UInt32,
    CarryResourceBehavior: CBehaviorLink,
    IdealHarvesterCount: UInt32,
    EnabledSearchFilters: CTargetFilters,
    EnabledSearchRadius: Real
}) {
}
class CBehaviorReveal extends CBehavior.Ex({
    Duration: CGameTime,
    SearchFilters: CTargetFilters
}) {
}
class CBehaviorSpawn extends CBehavior.Ex({
    DisplayDuration: FDisplayDuration,
    InfoArray: [SSpawnInfo],
    Center: CGamePoint,
    Offset: [CGamePoint],
    Slop: Real,
    Effect: CEffectLink,
    Range: Real,
    Flags: FBehaviorSpawn,
    Limit: UInt32,
    LimitDeath: EDeathType,
    ConjoinedLink: CBehaviorLink
}) {
}
class CBehaviorVeterancy extends CBehavior.Ex({
    Flags: FBehaviorVeterancy,
    ShareFilters: { index: EShareFilters, value: CTargetFilters },
    TargetFilters: { index: ETargetFilters, value: CTargetFilters },
    XPFraction: { index: EXPFraction, value: Real },
    SharedXPRadius: { index: ESharedXPRadius, value: Real },
    SharedXPFraction: { index: ESharedXPFraction, value: Real },
    SharedXPMaxCount: { index: ESharedXPMaxCount, value: UInt32 },
    XPReceiveFraction: { index: EXPReceiveFraction, value: SBehaviorFraction },
    VeterancyLevelArray: [SVeterancyLevel],
    Levels: UInt32,
    MinVeterancyXPLevelFactor: Real,
    MinVeterancyXPPreviousValueFactor: Real,
    MinVeterancyXPBonusPerLevel: UInt32
}) {
}
class CBehaviorWander extends CBehavior.Ex({
    Leash: Bit,
    Override: Bit,
    TimeLimitFactor: Real,
    MinimumRange: Real,
    Range: Real,
    Delay: CGameTime
}) {
}
class CBoost extends CClass.Ex({
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    TileTexture: CImageLink,
    PreviewTexture: CImageLink,
    HyperlinkId: THyperlinkId,
    PreviewCutsceneFile: CCutsceneFile,
    TileCutsceneFile: CCutsceneFile,
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CBundle extends CClass.Ex({
    EditorCategories: TEditorCategories,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    Flags: FBundle,
    Universe: EHeroUniverse,
    BoostBonus: CBoostLink,
    TileCutsceneFile: CCutsceneFile,
    TileTexture: CImageLink,
    MediumTileTexture: CImageLink,
    LargeTileTexture: CImageLink,
    PreviewCutsceneFile: CCutsceneFile,
    ReleaseDate: SProductReleaseDate,
    HyperlinkId: THyperlinkId,
    Description: CStringLink,
    GameContentArray: [CDataEntryPath],
    StoreTypeName: CStringLink,
    CinematicsImagePath: CImageLink,
    LearnMoreBackgroundImage: CImageLink,
    LearnMoreImage1: CImageLink,
    LearnMoreImage2: CImageLink,
    LearnMoreImage3: CImageLink,
    LearnMoreTitleText1: CStringLink,
    LearnMoreTitleText2: CStringLink,
    LearnMoreTitleText3: CStringLink,
    LearnMoreBodyText1: CStringLink,
    LearnMoreBodyText2: CStringLink,
    LearnMoreBodyText3: CStringLink,
    SuppressCountryArray: [CStringLink],
    ExternalHyperlink: CString
}) {
    static namespace;
}
class CButton extends CClass.Ex({
    Name: CStringLink,
    Tooltip: CStringLink,
    TooltipAppender: [STooltipBlock],
    TooltipImage: CImageLink,
    TooltipFlags: FTooltipFlags,
    TooltipResourceName: [CStringLink],
    TooltipVitalName: { index: EUnitVital, value: CStringLink },
    TooltipSupplyName: CStringLink,
    TooltipCooldownOverrideText: CStringLink,
    TooltipVitalOverrideText: { index: EUnitVital, value: CStringLink },
    TooltipTimeOverrideAbilCmd: STooltipTimeAbilCmd,
    Icon: CImageLink,
    AlertName: CStringLink,
    AlertTooltip: CStringLink,
    AlertIcon: CImageLink,
    Hotkey: CHotkeyLink,
    EditorCategories: TEditorCategories,
    TintRacially: Bit,
    HotkeyAlias: CButtonLink,
    HotkeySet: CIdentifier,
    HotkeyToggleUnit: CUnitLink,
    Universal: Bit,
    SimpleDisplayText: CStringLink,
    HidesForSimpleText: Bit,
    UseHotkeyLabel: Bit,
    Placeholder: Bit,
    ChargeText: CStringLink,
    DefaultButtonLayout: SButtonCardLayout
}) {
    static namespace;
}
class CCamera extends CClass.Ex({
    ParamInitial: { index: EParamInitial, value: Real32 },
    ZoomTable: [SCameraZoom],
    ZoomTableObserver: [SCameraZoom],
    ZoomDefault: UInt32,
    ParamSmooth: { index: EParamSmooth, value: SCameraSmooth },
    TargetSmooth: SCameraSmooth,
    FieldOfViewMin: Real32,
    FieldOfViewMax: Real32,
    FieldOfViewIncrement: Real32,
    DistanceMin: Real32,
    DistanceMax: Real32,
    DistanceIncrement: Real32,
    PitchMin: Real32,
    PitchMax: Real32,
    PitchIncrement: Real32,
    YawLeft: Real32,
    YawRight: Real32,
    YawMin: Real32,
    YawMax: Real32,
    YawIncrement: Real32,
    MaxScrollRate: { index: ECameraScale, value: Real32 },
    MaxScrollDistance: { index: ECameraScale, value: Real32 },
    VerticalScrollRateMultiplier: { index: ECameraScale, value: Real32 },
    ScrollAccelerationPeriod: { index: ECameraScale, value: Real32 },
    ScrollDecelerationPeriod: { index: ECameraScale, value: Real32 },
    ForwardScale: { index: ECameraScale, value: Real32 },
    StrafeScale: { index: ECameraScale, value: Real32 },
    RotateScale: Real32,
    FollowOffsetUpdateBandX: CRange,
    FollowOffsetUpdateBandY: CRange,
    FollowResetDecayDuration: Real32,
    FollowResetDecayFactor: Real32,
    FollowResetJumpDelay: Real32,
    FollowResetJumpDistance: Real32,
    FollowResetTimeoutNormal: Real32,
    FollowResetTimeoutLeashed: Real32,
    FollowResetTimeoutUnleashed: Real32,
    FollowScrollLeash: CRect,
    FollowScrollLimit: Real32,
    BorderSizeX: UInt8,
    BorderSizeY: UInt8,
    SmartPanJumpDistance: Real32,
    SmartPanSkipDistance: Real32,
    HeightDisplacementFactor: Real32,
    HeightDisplacementPitchMin: Real32,
    HeightDisplacementPitchMax: Real32,
    HeightDisplacementMax: Real32,
    HeightMap: ECameraHeightMap
}) {
    static namespace;
}
class CCampaign extends CClass.Ex({
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    CampaignData: SCampaignData,
    PurchaseProductIdArray: [TBattleProductId],
    StoreTypeName: CStringLink,
    ScreenshotImage1: CImageLink,
    ScreenshotImage2: CImageLink,
    ScreenshotImage3: CImageLink,
    ScreenshotImage4: CImageLink,
    ScreenshotImage5: CImageLink,
    LearnMoreBackgroundImage: CImageLink,
    LearnMoreImage1: CImageLink,
    LearnMoreImage2: CImageLink,
    LearnMoreImage3: CImageLink,
    LearnMoreTitleText1: CStringLink,
    LearnMoreTitleText2: CStringLink,
    LearnMoreTitleText3: CStringLink,
    LearnMoreBodyText1: CStringLink,
    LearnMoreBodyText2: CStringLink,
    LearnMoreBodyText3: CStringLink
}) {
    static namespace;
}
class CCharacter extends CClass.Ex({
    Name: CStringLink,
    Age: UInt32,
    Gender: ECharacterGender,
    Race: ECharacterRace,
    RaceCustom: CStringLink,
    Attitude: CStringLink,
    Timbre: CStringLink,
    Dialect: CStringLink,
    VoiceRef: CStringLink,
    Description: CStringLink,
    Image: CImageLink,
    Relevance: ECharacterRelevance,
    Voice: CString,
    Pitch: Int32,
    Color: CColor,
    Unit: CUnitLink,
    Variations: [SCharacterVariation]
}) {
    static namespace;
}
class CCliff extends CClass.Ex({
    CliffMesh: CCliffMeshLink,
    CliffMaterial: CModelFile,
    EditorIcon: CImageLink,
    Scale: UInt8
}) {
    static namespace;
}
class CCliffMesh extends CClass.Ex({
    ModelPath: CModelFile,
    CliffHeights: [Real32],
    WeldNormals: Bit
}) {
    static namespace;
}
class CColorStyle extends CClass.Ex({
    Name: CStringLink,
    ColorEntry: { index: EColorEntry, value: SUIColorEntry }
}) {
    static namespace;
}
class CCommander extends CClass.Ex({
    Name: CStringLink,
    ShortName: CStringLink,
    AttributeId: CFourCC,
    LevelAchievementId: UInt,
    Race: CRaceLink,
    Campaign: CCampaignLink,
    Description: CStringLink,
    PurchaseMessage: CStringLink,
    Details: CStringLink,
    Portrait: CImageLink,
    HomePanelImage: CImageLink,
    CutsceneFilterSelf: CIdentifier,
    CutsceneFilterAlly: CIdentifier,
    UnitArray: [SCommanderUnit],
    TalentTreeArray: [SCommanderTalentTree],
    MasteryTalentArray: [SCommanderMasteryTalent],
    MasteryMaxRank: UInt32,
    UserReference: CUserReference,
    LoadingImage: CImageLink,
    LoadingImageAlly: CImageLink,
    TraitIcon: CImageLink,
    CommanderAbilTitle: CStringLink,
    CommanderAbilArray: [SCommanderAbil],
    Movie: CMovieFile,
    ProductId: TBattleProductId,
    RequiredRewardArray: [CRewardLink],
    PurchaseImage: CImageLink,
    StoreName: CStringLink,
    ConsoleSkin: CConsoleSkinLink,
    FeaturedImagePath: CImageLink,
    FeaturedDescription: CStringLink,
    ProfileImagePath: CImageLink,
    StoreTypeName: CStringLink,
    LearnMoreBackgroundImage: CImageLink,
    LearnMoreImage1: CImageLink,
    LearnMoreImage2: CImageLink,
    LearnMoreImage3: CImageLink,
    LearnMoreTitleText1: CStringLink,
    LearnMoreTitleText2: CStringLink,
    LearnMoreTitleText3: CStringLink,
    LearnMoreBodyText1: CStringLink,
    LearnMoreBodyText2: CStringLink,
    LearnMoreBodyText3: CStringLink,
    PrestigeArray: [CButtonLink],
    Color: CColor,
    LoadingScreenCoordinates: CRect,
    DataCollectionAllowed: [CDataCollectionLink],
    CommanderArtifactKeyArray: [CIdentifier],
    CommanderPrestigeAchievementId: UInt
}) {
    static namespace;
}
class CConfig extends CClass.Ex({
    Name: CStringLink,
    GameContentArray: [SGameContentCreationData],
    BoostLicense: CIdentifier,
    SilencePenaltyLicense: UInt32,
    FreeNonKRIGRLicense: UInt32,
    CommanderMastery: CCommanderLink,
    CommanderDifficultyLevels: [SCommanderDifficultyLevel],
    CommanderAchievementCategoryId: UInt32,
    CoopCampaignAchievementCategoryId: UInt32
}) {
    static namespace;
}
class CConsoleSkin extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    RequiredReward: CRewardLink,
    ReleaseDate: SProductReleaseDate,
    MinimapPanelModel: SConsoleSkinModel,
    InfoPanelModel: SConsoleSkinModel,
    CommandPanelModel: SConsoleSkinModel,
    MinimapPanelImage: CImageLink,
    InfoPanelImage: CImageLink,
    CommandPanelImage: CImageLink,
    Light: CString,
    StoreTypeName: CStringLink,
    ThumbnailImage: CImageLink,
    FeaturedImage: CImageLink,
    Description: CStringLink,
    SkinId: CString
}) {
    static namespace;
}
class CConversation extends CClass.Ex({
    EditorCategories: TEditorCategories,
    AnimBlendDefault: Int32,
    AnimBlendOut: Int32,
    ProductionLevelInfo: [SConversationProductionLevel],
    ProductionLevel: EConversationProductionLevel,
    ObjectStates: { index: EObjectStates, value: CConversationStateLink },
    DefaultSpeaker1: CCharacterLink,
    DefaultSpeaker2: CCharacterLink,
    SoundParent: CSoundLink,
    FixedConditions: [SConversationConditionSet],
    FixedActions: [SConversationActionSet],
    FacialAnims: [SConversationFacialAnim],
    Lines: [SConversationLine],
    RunActions: [SConversationRunActions],
    Waits: [SConversationWait],
    Jumps: [SConversationJump],
    Choices: [SConversationChoice],
    Groups: [SConversationGroup],
    Comments: [SConversationComment],
    RootItems: [TConversationItemId]
}) {
    static namespace;
}
class CConversationState extends CClass.Ex({
    Flags: FConversationState,
    Indices: [SConversationStateIndex],
    ValueRange: CiRange,
    CustomColors: [CColor],
    InfoIds: { index: EInfoIds, value: SConversationStateInfoIds }
}) {
    static namespace;
}
class CCursor extends CClass.Ex({
    Texture: CImageLink,
    HotspotX: UInt32,
    HotspotY: UInt32,
    Texture16: CImageLink,
    Texture64: CImageLink
}) {
    static namespace;
}
class CDataCollection extends CClass.Ex({
    Name: CStringLink,
    EditorCategories: TEditorCategories,
    EditorIconSource: EGameCatalog,
    InfoText: CStringLink,
    DataRecord: [SDataCollectionRecord],
    Button: CButtonLink,
    ImplementionLevel: EImplementionLevel,
    Pattern: CDataCollectionPatternLink
}) {
    static namespace;
}
class CDataCollectionUnit extends CDataCollection.Ex({
    AbilInfoNormal: [CAbilLink],
    AbilInfoLearned: [CAbilLink],
    AbilInfoUpgradeTo: [CUnitLink],
    AbilInfoBuilt: [CUnitLink],
    AbilInfoTrainUnit: [CUnitLink],
    AbilInfoResearch: [CAbilLink],
    AbilInfoSellUnit: [CUnitLink],
    AbilInfoSellItem: [CUnitLink],
    AbilInfoMakeItem: [CUnitLink],
    UpgradeInfoUnitLifeArmorPerLevel: Real,
    UpgradeInfoWeapon: [SUpgradeInfoWeapon],
    TechInfoUnit: CUnitLink,
    TechInfoUnitReplaced: CUnitLink,
    TechInfoUpgradeUsed: [CUpgradeLink]
}) {
}
class CDataCollectionUpgrade extends CDataCollection.Ex({
    TechInfoUpgrade: CUpgradeLink,
    TechInfoUpgradeReplaced: CUpgradeLink
}) {
}
class CDataCollectionAbil extends CDataCollection.Ex({
    TechInfoAbil: CAbilLink,
    TechInfoAbilReplaced: CAbilLink
}) {
}
class CDataCollectionPattern extends CClass.Ex({
    Fields: [SDataFieldsPattern],
    Tokens: [SDataTokensPattern]
}) {
    static namespace;
}
class CDecalPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    Description: CStringLink,
    Image: STextureSheetEntry,
    ProductId: TBattleProductId,
    ReleaseDate: SProductReleaseDate,
    DecalArray: [CRewardLink],
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CDSP extends CClass.Ex({}) {
    static namespace;
}
class CDSPChorus extends CDSP.Ex({
    Delay: Real32,
    Depth: Real32,
    DryMix: Real32,
    Feedback: Real32,
    Rate: Real32,
    WetMix1: Real32,
    WetMix2: Real32,
    WetMix3: Real32
}) {
}
class CDSPCompressor extends CDSP.Ex({
    Attack: Real32,
    GainMakeUp: Real32,
    Release: Real32,
    Threshold: Real32
}) {
}
class CDSPCustomCompressor extends CDSP.Ex({
    AttackMs: UInt32,
    Ratio: Real32,
    ReleaseMs: UInt32,
    ThresholdDB: Real32,
    MakeUpGainDB: Real32,
    DelayMs: UInt32
}) {
}
class CDSPDistortion extends CDSP.Ex({
    Level: Real32
}) {
}
class CDSPEcho extends CDSP.Ex({
    DecayRatio: Real32,
    Delay: Real32,
    DryMix: Real32,
    MaxChannels: Real32,
    WetMix: Real32
}) {
}
class CDSPFlange extends CDSP.Ex({
    Depth: Real32,
    DryMix: Real32,
    Rate: Real32,
    WetMix: Real32
}) {
}
class CDSPHighPass extends CDSP.Ex({
    Cutoff: Real32,
    Resonance: Real32
}) {
}
class CDSPLimiter extends CDSP.Ex({
    ReleaseMs: UInt32,
    UseARC: Bit,
    ThresholdDB: Real32,
    MakeUpGainDB: Real32,
    SoftKneeWidthDB: Real32,
    ARCAttackMs: UInt32,
    ARCReleaseMs: UInt32,
    ARCMinReleaseMs: UInt32,
    ARCMaxReleaseMs: UInt32,
    ARCReleaseSweepMs: UInt32
}) {
}
class CDSPLowPass extends CDSP.Ex({
    Cutoff: Real32,
    Resonance: Real32
}) {
}
class CDSPLowPassSimple extends CDSP.Ex({
    Cutoff: Real32
}) {
}
class CDSPNormalize extends CDSP.Ex({
    FadeTime: Real32,
    MaxAmp: Real32,
    Threshhold: Real32
}) {
}
class CDSPOscillator extends CDSP.Ex({
    Type: EOscillator,
    Rate: Real32
}) {
}
class CDSPParamEQ extends CDSP.Ex({
    Bandwidth: Real32,
    Center: Real32,
    Gain: Real32
}) {
}
class CDSPPitchShift extends CDSP.Ex({
    FFTSize: UInt32,
    MaxChannels: Real32,
    Pitch: Real32
}) {
}
class CDSPReverb extends CDSP.Ex({
    DecayHFRatio: Real32,
    DecayTime: Real32,
    Density: Real32,
    Diffusion: Real32,
    DryLevel: Real32,
    HFReference: Real32,
    LFReference: Real32,
    ReflectionsDelay: Real32,
    ReflectionsLevel: Real32,
    ReverbDelay: Real32,
    ReverbLevel: Real32,
    Room: Real32,
    RoomHF: Real32,
    RoomLF: Real32,
    RoomRolloffFactor: Real32
}) {
}
class CEffect extends CClass.Ex({
    Name: CStringLink,
    ValidatorArray: [CValidatorLink],
    PreloadValidatorArray: [CValidatorLink],
    EditorCategories: TEditorCategories,
    Marker: SMarker,
    AINotifyFlags: FNotifyArea,
    TechAliasArray: [TTechAlias],
    Chance: Real,
    Alert: CAlertLink,
    DamageModifierSource: SEffectWhichUnit,
    CasterHistory: EEffectHistory,
    CanBeBlocked: Bit,
    DebugTrace: Bit,
    OwningPlayer: SEffectWhichPlayer
}) {
    static namespace;
}
class CEffectResponse extends CEffect.Ex({
    ResponseFlags: FResponse
}) {
}
class CEffectAddTrackedUnit extends CEffect.Ex({
    ResponseFlags: FResponse,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    TrackedUnit: SEffectWhichUnit
}) {
}
class CEffectClearTrackedUnits extends CEffect.Ex({
    ResponseFlags: FResponse,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    ClearValidatorArray: [CValidatorLink]
}) {
}
class CEffectAddTrackedUnits extends CEffect.Ex({
    ResponseFlags: FResponse,
    SourceBehaviorLink: CBehaviorLink,
    SourceTrackerUnit: SEffectWhichUnit,
    TargetBehaviorLink: CBehaviorLink,
    TargetTrackerUnit: SEffectWhichUnit
}) {
}
class CEffectRemoveTrackedUnit extends CEffect.Ex({
    ResponseFlags: FResponse,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    TrackedUnit: SEffectWhichUnit
}) {
}
class CEffectApplyBehavior extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    Behavior: CBehaviorLink,
    KillHallucination: Bit,
    Count: SAccumulatedUInt32,
    Flags: FEffectApplyBehavior,
    Duration: CGameTime
}) {
}
class CEffectApplyForce extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    WhichUnit: SEffectWhichUnit,
    Amount: Real,
    MassFraction: Real,
    TimeScaleSource: SEffectWhichTimeScale
}) {
}
class CEffectApplyKinetic extends CEffect.Ex({
    ResponseFlags: FResponse,
    ImpactUnit: SEffectWhichUnit,
    Kinetic: CKineticLink
}) {
}
class CEffectCancelOrder extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    AbilCmd: CAbilCommand,
    Count: UInt32,
    Flags: FEffectCancelOrder
}) {
}
class CEffectCreateHealer extends CEffect.Ex({
    ResponseFlags: FResponse,
    LaunchUnit: SEffectWhichUnit,
    ImpactUnit: SEffectWhichUnit,
    TimeScaleSource: SEffectWhichTimeScale,
    Flags: FEffectCreateHealer,
    PeriodCount: UInt32,
    PeriodicValidator: CValidatorLink,
    PeriodicEffect: CEffectLink,
    PeriodicPeriod: CGameTime,
    PeriodicEffectRateMultiplier: Real,
    DrainVital: EUnitVital,
    DrainVitalCostFactor: SAccumulatedFixed,
    DrainResourceCostFactor: { index: EResourceType, value: Real },
    RechargeVital: EUnitVital,
    RechargeVitalFraction: CGameRate,
    RechargeVitalRate: SAccumulatedGameRate,
    RechargeVitalMax: CGameRate,
    TimeFactor: Real,
    InitialEffect: CEffectLink,
    ExpireEffect: CEffectLink,
    FinalEffect: CEffectLink,
    AmountScoreArray: [SScoreValueUpdate]
}) {
}
class CEffectCreep extends CEffect.Ex({
    WhichLocation: SEffectWhichLocation,
    Radius: SAccumulatedFixed,
    CreepFlags: FCreepFlags
}) {
}
class CEffectCreatePersistent extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    TimeScaleSource: SEffectWhichTimeScale,
    OffsetVectorStartLocation: SEffectWhichLocation,
    OffsetVectorEndLocation: SEffectWhichLocation,
    OffsetFacingFallback: SEffectWhichLocation,
    Flags: FEffectCreatePersistent,
    InitialDelay: CGameTime,
    InitialEffect: CEffectLink,
    InitialOffset: CEffectOffset,
    ExpireDelay: SAccumulatedGameTime,
    ExpireEffect: CEffectLink,
    ExpireOffset: CEffectOffset,
    FinalEffect: CEffectLink,
    FinalOffset: CEffectOffset,
    PeriodCount: SAccumulatedUInt32,
    PeriodicValidator: CValidatorLink,
    PeriodicEffectArray: [CEffectLink],
    PeriodicOffsetArray: [CEffectOffset],
    PeriodicPeriodArray: [CGameTime],
    PeriodicEffectRateMultiplier: Real,
    RevealRadius: SAccumulatedFixed,
    RevealFlags: FEffectReveal,
    RevealArc: CFangleArc,
    RevealFacing: CFangle,
    RevealRectangleWidth: Real,
    RevealRectangleHeight: Real,
    TeleportTrack: FTeleportTrack,
    TeleportValidator: CValidatorLink,
    DetectFilters: CTargetFilters,
    RadarFilters: CTargetFilters,
    HeightMap: EHeightMap,
    AINotifyEffect: CEffectLink,
    EffectRandMode: EListWalkMode,
    OffsetRandMode: EListWalkMode,
    PeriodRandMode: EListWalkMode
}) {
}
class CEffectRandomPointInCircle extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    Effect: CEffectLink,
    Count: UInt32,
    Radius: SAccumulatedFixed,
    RestrictToCircumference: Bit
}) {
}
class CEffectCreateUnit extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    Origin: SEffectWhichLocation,
    CreateFlags: FCreateFlags,
    RallyUnit: SEffectWhichUnit,
    SpawnOwner: SEffectWhichPlayer,
    SpawnEffect: CEffectLink,
    SpawnUnit: [CUnitLink],
    SpawnCount: SAccumulatedUInt32,
    SpawnRange: Real,
    SpawnOffset: [CGamePoint],
    SelectUnit: SEffectWhichUnit,
    TypeFallbackUnit: SEffectWhichUnit
}) {
}
class CEffectDamage extends CEffect.Ex({
    ResponseFlags: FResponse,
    LaunchLocation: SEffectWhichLocation,
    ImpactLocation: SEffectWhichLocation,
    ImpactUnitValidator: CValidatorLink,
    AttributeBonus: { index: EUnitAttribute, value: Real },
    AttributeFactor: { index: EUnitAttribute, value: Real },
    AttributeForced: FUnitAttribute,
    ShieldBonus: Real,
    ShieldFactor: Real,
    ArmorReduction: Real,
    Visibility: EDamageVisibility,
    Flags: FDamage,
    Kind: EDamageKind,
    KindSplash: EDamageKind,
    Type: EDamageType,
    Total: EDamageTotal,
    Amount: SAccumulatedFixed,
    Fraction: SAccumulatedFixed,
    Random: Real,
    VitalBonus: { index: EUnitVital, value: Real },
    VitalFractionCurrent: { index: EUnitVital, value: Real },
    VitalFractionMax: { index: EUnitVital, value: Real },
    VitalBonusRandom: { index: EUnitVital, value: Real },
    VitalFractionCurrentRandom: { index: EUnitVital, value: Real },
    VitalFractionMaxRandom: { index: EUnitVital, value: Real },
    LeechFraction: { index: EUnitVital, value: Real },
    LeechScoreArray: [SScoreValueUpdate],
    Death: EDeathType,
    KillHallucination: Bit,
    AreaArray: [SEffectDamageArea],
    AreaRelativeOffset: CGamePoint,
    RevealerParams: SEffectSearchRevealerParams,
    ExcludeArray: [SEffectWhichUnit],
    IncludeArray: [SEffectWhichUnit],
    SearchFilters: CTargetFilters,
    TargetSorts: STargetSorts,
    MinCountError: CCmdResult,
    MinCount: UInt32,
    MaxCount: SAccumulatedUInt32,
    RecycleCount: UInt32,
    SearchFlags: FSearchFlags,
    DisplayFlags: FEquipmentDisplay,
    SplashHistory: EEffectHistory,
    AmountScoreArray: [SScoreValueUpdate],
    Minimum: Real,
    Maximum: Real,
    DamageInheritEffect: CEffectLink
}) {
}
class CEffectDestroyHealer extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    Effect: CEffectLink,
    Count: UInt32,
    Radius: Real
}) {
}
class CEffectDestroyPersistent extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    Effect: CEffectLink,
    Count: UInt32,
    Radius: Real
}) {
}
class CEffectEnumArea extends CEffect.Ex({
    ResponseFlags: FResponse,
    LaunchLocation: SEffectWhichLocation,
    ImpactLocation: SEffectWhichLocation,
    ExcludeArray: [SEffectWhichUnit],
    IncludeArray: [SEffectWhichUnit],
    SearchFilters: CTargetFilters,
    TargetSorts: STargetSorts,
    AreaArray: [SEffectEnumArea],
    AreaRelativeOffset: CGamePoint,
    RevealerParams: SEffectSearchRevealerParams,
    MinCountError: CCmdResult,
    MinCount: UInt32,
    MaxCount: SAccumulatedUInt32,
    ExtraRadiusBonus: SAccumulatedFixed,
    RecycleCount: UInt32,
    SearchFlags: FSearchFlags,
    UnCreep: Bit
}) {
}
class CEffectEnumTrackedUnits extends CEffect.Ex({
    ResponseFlags: FResponse,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    Effect: CEffectLink,
    TrackedUnitFilters: CTargetFilters,
    DistributDamage: Bit
}) {
}
class CEffectEnumMagazine extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    SearchFilters: CTargetFilters,
    MaxCount: UInt32,
    EffectInternal: CEffectLink,
    EffectExternal: CEffectLink
}) {
}
class CEffectEnumTransport extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    SearchFilters: CTargetFilters,
    MaxCount: UInt32,
    Effect: CEffectLink,
    CheckOuter: Bit
}) {
}
class CEffectEnumInventory extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    SearchFilters: CTargetFilters,
    MaxCount: UInt32,
    Effect: CEffectLink,
    CheckOuter: Bit
}) {
}
class CEffectLastTarget extends CEffect.Ex({
    ResponseFlags: FResponse,
    LastTargetType: EAbilLastTarget,
    WhichUnit: SEffectWhichUnit,
    Effect: CEffectLink
}) {
}
class CEffectLoadContainer extends CEffect.Ex({
    ResponseFlags: FResponse,
    ContainerType: EEffectContainer,
    WhichUnit: SEffectWhichUnit,
    ContainerUnit: SEffectWhichUnit,
    ContainerAbil: CAbilLink
}) {
}
class CEffectIssueOrder extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    Abil: CAbilLink,
    AbilTechAlias: TTechAlias,
    AbilCmdIndex: TAbilCmdIndex,
    CmdFlags: FCmd,
    Player: SEffectWhichPlayer,
    Target: SEffectWhichLocation
}) {
}
class CEffectLaunchMissile extends CEffect.Ex({
    ResponseFlags: FResponse,
    LaunchLocation: SEffectWhichLocation,
    ImpactLocation: SEffectWhichLocation,
    LaunchOffset: CEffectOffset,
    ImpactOffset: CEffectOffset,
    LaunchEffect: CEffectLink,
    ImpactEffect: CEffectLink,
    FinishEffect: CEffectLink,
    InterruptEffect: CEffectLink,
    SearchEffect: CEffectLink,
    SearchHitArriveEffect: CEffectLink,
    SearchMaxCount: UInt32,
    PeriodCount: UInt32,
    PeriodicEffect: CEffectLink,
    PeriodicPeriod: CGameTime,
    PeriodicValidator: CValidatorLink,
    Flags: FEffectLaunchMissile,
    SearchFlags: FEffectMissileSearch,
    TransferBehavior: CBehaviorLink,
    TransferCount: UInt32,
    AmmoOwner: SEffectWhichPlayer,
    AmmoUnit: CUnitLink,
    AmmoLife: CGameTime,
    PlaceholderUnit: CUnitLink,
    PlacementMinDistance: Real,
    PlacementAround: SEffectWhichLocation,
    PlacementRange: Real,
    ImpactRange: Real,
    RetargetFilters: CTargetFilters,
    RetargetRange: Real,
    ReturnDelay: CGameTime,
    ReturnMovers: [SEffectMover],
    Movers: [SEffectMover],
    MoverRollingPattern: EMoverPatternType,
    MoverRollingJump: UInt32,
    MoverExecutePattern: EMoverPatternType,
    MoverExecuteJump: UInt32,
    MoverExecuteRange: UInt32,
    DeathType: EDeathType,
    Visibility: EDamageVisibility,
    BounceArray: [SEffectMissileBounce]
}) {
}
class CEffectModifyPlayer extends CEffect.Ex({
    WhichPlayer: SEffectWhichPlayer,
    Resources: { index: EResourceType, value: Int32 },
    ResourcesCollected: { index: EResourceType, value: Int32 },
    EffectArray: [SUpgradeEffect],
    Upgrades: [SEffectUpgrade],
    Cost: SEffectModifyPlayerCost
}) {
}
class CEffectModifyUnit extends CEffect.Ex({
    ResponseFlags: FResponse,
    TransferUnit: SEffectWhichUnit,
    LaunchUnit: SEffectWhichUnit,
    ImpactUnit: SEffectWhichUnit,
    KillCreditUnit: SEffectWhichUnit,
    KillHallucination: Bit,
    Cost: [SEffectModifyUnitCost],
    Weapon: [SEffectModifyWeapon],
    VitalArray: { index: EUnitVital, value: SEffectModifyVital },
    Height: Real,
    HeightTime: CGameTime,
    ModifyFlags: FModifyFlags,
    XP: Real,
    VeterancyBehavior: CBehaviorLink,
    LearnAbilReset: CAbilLink,
    ResourceRestoreBonus: UInt32,
    ResourceRestoreFraction: Real,
    Resources: Int32,
    ResourcesHarvestedBonus: UInt32,
    ResourcesHarvestedFraction: Real,
    SalvageFactor: SCostFactor,
    SpawnCount: Int32,
    CopyOrderCount: UInt32,
    CopyRallyCount: UInt32,
    ModifyOwnerPlayer: SEffectWhichPlayer,
    RallyUnit: SEffectWhichUnit,
    ModifyTurret: SEffectModifyTurret,
    SelectTransferUnit: SEffectWhichUnit,
    SelectTransferFlags: FSelectionTransfer,
    FacingLocation: SEffectWhichLocation,
    FacingType: EEffectModifyFacing,
    FacingAdjustment: CFangle
}) {
}
class CEffectMorph extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    ActorKey: CDataSoupKey,
    MorphFlags: FMorphFlags,
    MorphUnit: CUnitLink,
    TypeFallbackUnit: SEffectWhichUnit,
    AbilKeyFallback: CAbilLink
}) {
}
class CEffectRedirectMissile extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    ImpactLocation: SEffectWhichLocation,
    ImpactFilters: CTargetFilters,
    Flags: FEffectRedirectMissile,
    Movers: [SEffectMover],
    MoverRollingPattern: EMoverPatternType,
    MoverRollingJump: UInt32,
    MoverExecutePattern: EMoverPatternType,
    MoverExecuteJump: UInt32,
    MoverExecuteRange: UInt32
}) {
}
class CEffectReleaseMagazine extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit
}) {
}
class CEffectRemoveBehavior extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    BehaviorCategories: FBehaviorCategory,
    BehaviorClass: EClassIdCBehavior,
    BehaviorLink: CBehaviorLink,
    BehaviorAlignment: EEffectRemoveBehaviorAlignment,
    Heroic: EBehaviorHeroicState,
    StackAlias: CIdentifier,
    KillHallucination: Bit,
    MatchesAll: Bit,
    Count: UInt32,
    ExcludeOriginPlayer: SEffectWhichPlayer,
    ExcludeCasterUnit: SEffectWhichUnit,
    RequireOriginPlayer: SEffectWhichPlayer,
    RequireCasterUnit: SEffectWhichUnit
}) {
}
class CEffectRemoveKinetic extends CEffect.Ex({
    ResponseFlags: FResponse,
    ImpactUnit: SEffectWhichUnit,
    KineticLink: CKineticLink
}) {
}
class CEffectReturnMagazine extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    MagazineEffect: CEffectLink
}) {
}
class CEffectSet extends CEffect.Ex({
    EffectArray: [CEffectLink],
    Random: Bit,
    RecycleCount: Bit,
    SetSource: Bit,
    MinCount: SAccumulatedUInt32,
    MaxCount: SAccumulatedUInt32,
    TargetLocationType: EEffectLocationType
}) {
}
class CEffectSwitch extends CEffect.Ex({
    CaseArray: [SEffectSwitchCase],
    CaseDefault: CEffectLink,
    TargetLocationType: EEffectLocationType
}) {
}
class CEffectTeleport extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    ClearQueuedOrders: Bit,
    MinDistance: Real,
    PlacementArc: CFangleArc,
    PlacementAround: SEffectWhichLocation,
    PlacementRange: Real,
    Range: Real,
    SourceLocation: SEffectWhichLocation,
    TargetLocation: SEffectWhichLocation,
    TeleportFlags: FTeleportFlags,
    TeleportEffect: CEffectLink
}) {
}
class CEffectTransferBehavior extends CEffect.Ex({
    ResponseFlags: FResponse,
    LaunchUnit: SEffectWhichUnit,
    ImpactUnit: SEffectWhichUnit,
    Behavior: CBehaviorLink,
    BehaviorCategories: FBehaviorCategory,
    BehaviorAlignment: EEffectRemoveBehaviorAlignment,
    Heroic: EBehaviorHeroicState,
    ExcludeOriginPlayer: SEffectWhichPlayer,
    ExcludeCasterUnit: SEffectWhichUnit,
    RequireOriginPlayer: SEffectWhichPlayer,
    RequireCasterUnit: SEffectWhichUnit,
    Count: UInt32,
    Copy: Bit,
    Preserve: Bit
}) {
}
class CEffectUseCalldown extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichLocation: SEffectWhichLocation,
    CalldownCount: UInt32,
    CalldownEffect: CEffectLink
}) {
}
class CEffectUseMagazine extends CEffect.Ex({
    ResponseFlags: FResponse,
    WhichUnit: SEffectWhichUnit,
    AmmoUnit: CUnitLink,
    AmmoEffect: CEffectLink,
    MagazineAbil: CAbilLink,
    TargetLocation: SEffectWhichLocation
}) {
}
class CEffectUserData extends CEffect.Ex({
    Key: CIdentifier,
    Amount: SAccumulatedFixed,
    SourceKey: CIdentifier,
    SourceFailBackValue: Real,
    Operation: EUpgradeOperation,
    ValidateMin: SAccumulatedFixed,
    ValidateMax: SAccumulatedFixed,
    EffectSuccess: CEffectLink,
    EffectFailure: CEffectLink,
    TargetLocationType: EEffectLocationType,
    BehaviorScope: SEffectWhichBehavior
}) {
}
class CEmoticon extends CClass.Ex({
    Name: CStringLink,
    NameAlternate: CStringLink,
    NameInvalid: CStringLink,
    Description: CStringLink,
    DescriptionLocked: CStringLink,
    Image: STextureSheetEntry,
    Hidden: Bit,
    RequiredReward: CRewardLink
}) {
    static namespace;
}
class CEmoticonPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    Description: CStringLink,
    Image: STextureSheetEntry,
    ProductId: TBattleProductId,
    RequiredCampaign: SEmoticonPackCampaign,
    RequiredCommander: CCommanderLink,
    RequiredRewardArray: [CRewardLink],
    ReleaseDate: SProductReleaseDate,
    EmoticonArray: [CEmoticonLink],
    ParentBundle: CBundleLink,
    Hidden: Bit,
    HideAchievement: Bit,
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CFootprint extends CClass.Ex({
    Flags: FFootprint,
    Layers: { index: EFootprintLayer, value: SFootprintLayer },
    Shape: SFootprintShape,
    EditorCategories: TEditorCategories
}) {
    static namespace;
}
class CFoW extends CClass.Ex({
    Color: CColor,
    UnhideRadius: Real,
    Expand: Bit,
    Hidden: Bit,
    Persistent: Bit,
    BlendSpeed: Int32
}) {
    static namespace;
}
class CGame extends CClass.Ex({
    AttackRevealBehavior: CBehaviorLink,
    AcquireMovementLimit: Real,
    AcquireLeashRadius: Real,
    AcquireLeashResetRadius: Real,
    CallForHelpPeriod: CGameTime,
    CallForHelpRadius: Real,
    CreepBlendTime: CGameTime,
    CreepDecayLimit: UInt32,
    CreepDecaySound: CSoundLink,
    CreepDecayTime: CGameTime,
    CreepDecayWeightMultiplier: UInt32,
    CreepDecayWeightUnscaledBonus: UInt32,
    CreepGrowSound: CSoundLink,
    DensityDecayTime: CGameTime,
    DensityPersistent: Bit,
    DamageMinimum: Real,
    AttackRevealTime: CGameTime,
    PenaltyRevealTime: CGameTime,
    StalemateTestTime: CGameTime,
    StalemateWarningTime: CGameTime,
    DifficultyLevels: [SDifficultyLevel],
    DifficultyDefault: TDifficultyLevel,
    AIBuilds: [SAIBuild],
    AIBuildDefault: TAIBuild,
    HandicapValues: [SHandicap],
    AirFormationDiameter: Real,
    MixedFormationDiameter: Real,
    FormationSeparationFactor: Real,
    MapSizes: [SMapSize],
    UnpathableMargin: CiQuad,
    CameraMargin: CiQuad,
    CameraMarginAspectAdjust: [SAspectMargin],
    TeamColors: [STeamColor],
    SplashDamageEffect: CEffectLink,
    DefaultAttackType: EAttackType,
    WeaponHighGroundChanceToMiss: Real,
    UnitSightRangeDead: Real,
    UnitSightRangeUnderConstruction: Real,
    AI: [SAIDescription],
    TriggerLibs: [STriggerLib],
    FilterResults: [STargetFilterResult],
    BeaconInfoArray: { index: EBeaconInfoArray, value: SBeaconInfo },
    SprayAbil: CAbilLink,
    SprayButtonReplacementTarget: [CButtonLink],
    TauntAbil: CAbilLink,
    UncontestedCombatPeriod: CGameTime,
    AIResourceRequest: { index: EResourceType, value: UInt32 },
    DamageCategories: { index: EDamageType, value: SDamageTypeInfo },
    AttackArmorTable: { index: EAttackType, value: SAttackTypeInfo },
    VeterancySearchRadius: Real,
    VeterancySearchFilters: CTargetFilters,
    VeterancySearchMaxCount: UInt32,
    VeterancyKillerFilters: CTargetFilters,
    UnitLevelKillXPTable: [UInt32],
    UnitLevelKillXPLevelFactor: Real,
    UnitLevelKillXPPreviousValueFactor: Real,
    UnitLevelKillXPBonusPerLevel: UInt32,
    VeterancyLevelKillXPTable: [UInt32],
    VeterancyLevelKillXPLevelFactor: Real,
    VeterancyLevelKillXPPreviousValueFactor: Real,
    VeterancyLevelKillXPBonusPerLevel: UInt32,
    ResourceConvertArray: { index: EResourceType, value: SResourceConvert },
    DamageHistoryIntervalMax: Real,
    MeleePointsThreshold: SMeleePointThreshold,
    MeleePointsGameDurationMin: CGameTime,
    FoodCappedMax: Real,
    TeleportResetRange: { index: ETeleportResetRange, value: Real },
    CalculateFullVision: Bit,
    JoinInProgress: Bit,
    PathingConfig: FPathingConfig,
    PlayerLeaveFlags: FPlayerLeave,
    HeroOverlapPercent: Real,
    SmartCommandContinuous: Bit,
    EnforcedGameResultScoreResult: CScoreResultLink,
    DefaultPauseCountPerPlayer: UInt16,
    UnlimitedPause: Bit,
    EnableRewardSkins: Bit,
    EnableRewardVoicePacks: Bit,
    EnableRewardConsoleSkins: Bit,
    PlayersRequiredForLargeFormat: UInt32,
    DeepWaterThreshold: Real,
    GenerateWaterPathing: Bit,
    NeutralPlayerScanValidator: CValidatorLink
}) {
    static namespace;
}
class CGameUI extends CClass.Ex({
    ChallengeCategory: [SChallengeCategory],
    ChallengeMasterAchievement: [CAchievementLink],
    Campaign: [CCampaignLink],
    StartupCampaign: UInt32,
    StartupMovieArray: [SMovieConfig],
    Musiarray: [CSoundtrackLink],
    StartupMusic: UInt32,
    IntroMusic: CSoundtrackLink,
    PostGameMusic: CSoundtrackLink,
    CreditsMusic: CSoundtrackLink,
    MatchmakingMusic: CSoundtrackLink,
    MusicArray: CSoundtrackLink,
    LoopAmbience: CSoundtrackLink,
    SoundQuality: [SSoundQuality],
    MinimapData: SMinimapData,
    SelectionData: SSelectionData,
    SoundData: { index: ESoundCategory, value: SSoundData },
    GlobalSoundData: SGlobalSoundData,
    StartupDSPArray: [CDSPLink],
    DSPArray: [CDSPLink],
    RegionNameSize: UInt32,
    LookAtTypes: [SLookAtType],
    CameraShakeAmplitudes: [SCameraShakeAmplitude],
    CameraShakeFrequencies: [SCameraShakeFrequency],
    ListenerAngleRolloff: [SListenerRolloff],
    ListenerDistanceRolloff: [SListenerRolloff],
    PlanetPanelDefaultBackground: CModelLink,
    PlayerIdObserverColorMap: { index: EPlayerId, value: EUIColorRelation },
    MixRouting: { index: EGameUIMixRouting, value: SMixRoute },
    PointModels: { index: EGameUIPointModels, value: SPointModel },
    BehaviorIconColors: { index: EGameUIBehaviorIconColors, value: CColor },
    BehaviorBorderColors: { index: EGameUIBehaviorBorderColors, value: CColor },
    SelectionColors: { index: EGameUISelectionColors, value: CColor },
    SelectionColorBlindColors: { index: EGameUISelectionColorBlindColors, value: CColor },
    OverrideColors: { index: EGameUIOverrideColors, value: STeamColor },
    ColorBlindColors: { index: EGameUIColorBlindColors, value: STeamColor },
    DefaultPathColor: { index: EGameUIDefaultPathColor, value: CColor },
    DefaultPathLineWidth: { index: EGameUIDefaultPathLineWidth, value: Real32 },
    DefaultPathTileLength: { index: EGameUIDefaultPathTileLength, value: Real32 },
    DefaultPathTexture: { index: EGameUIDefaultPathTexture, value: CImageLink },
    DefaultPathStepModel: { index: EGameUIDefaultPathStepModel, value: CModelFile },
    DefaultPathStepModelScale: { index: EGameUIDefaultPathStepModelScale, value: Real32 },
    VitalColors: { index: EUnitVital, value: SVitalColor },
    RadarAlpha: UInt8,
    WireframeColorArray: [CColor],
    MovementSpeedArray: [SUnitSpeedText],
    WeaponSpeedArray: [SWeaponSpeedText],
    InfoColorBuffed: CColor,
    InfoColorDebuffed: CColor,
    InfoColorUpgraded: CColor,
    RequirementsSatisfiedColor: CColor,
    RequirementsUnsatisfiedColor: CColor,
    RandomRaceIcon: CImageLink,
    DisplayScaledTime: Bit,
    DisplayTimeInSeconds: Bit,
    UnitDamageFlashDuration: UInt32,
    UnitDamageNotificationCooldown: UInt32,
    UnitDamageNotificationDelay: UInt32,
    CancelTargetModeButtonFace: CButtonLink,
    CancelPlacementModeButtonFace: CButtonLink,
    PlacementDisplayBonusRadius: UInt32,
    PlacementDisplayMinimumRadius: UInt32,
    PlacementErrorColor: CColor,
    PlacementWarningColor: CColor,
    PlacementPerfectColor: CColor,
    PlacementColorBlindErrorColor: CColor,
    PlacementColorBlindWarningColor: CColor,
    PlacementColorBlindDefaultColor: CColor,
    PlacementGridDimensions: C2iVector,
    PossibleEnemyPlacementPingDuration: CGameTime,
    PossibleEnemyPlacementPingModel: CModelLink,
    PossibleEnemyPlacementPingColor: CColor,
    ScreenModeTransitionDuration: UInt32,
    CostDisplayColor: { index: ECostDisplay, value: CColor },
    CostDisplayFade: CGameTime,
    CostDisplayHeight: UInt32,
    CostDisplayHeightOffset: Real,
    CostDisplaySpeed: CGameSpeed,
    CostDisplayTime: CGameTime,
    WayPointMultiUnitFadePoint: Real32,
    WayPointMultiUnitFadeAlpha: Real32,
    WayPointLineWidth: Real32,
    WayPointTileLength: Real32,
    StrobeCycleLength: UInt32,
    StrobeFalloff: Real32,
    StrobeHeight: Real32,
    StrobeHaloEmission: Real32,
    StrobeHighlightColor: CColor,
    GlowPeakMultiplier: C3Vector,
    TransmissionSoundRect: CRect,
    TransmissionSoundDepth: Real32,
    DefaultInfoTooltipTypes: CString,
    ObjectGroupData: [SObjectGroupData],
    LoadingScreenHelpIntro: [SLoadingScreenHelp],
    LoadingScreenHelp: [SLoadingScreenHelp],
    LoadingBars: [SLoadingBar],
    UnitKillRank: [SUnitKillRank],
    AlertPanMaxDuration: Real32,
    AlertPanMinDuration: Real32,
    AlertPanMaxVelocity: Real32,
    BeaconMinimapIcon: CImageLink,
    BeaconMinimapRenderPriority: CActorKey,
    AchievementTags: [CFourCC],
    GameCategories: [SGameCategory],
    AutoVariantArcade: SDefaultGameVariant,
    AutoVariantMelee: SDefaultGameVariant,
    DefaultVariants: [SDefaultGameVariant],
    DefaultUIRace: CRaceLink,
    ObserverSoundtrack: CSoundtrackLink,
    UseMaxCooldown: Bit,
    CooldownDurationPrecision: UInt8,
    MinCooldownDisplayDuration: CGameTime,
    MinTimeDisplayDuration: CGameTime,
    TutorialArray: [STutorialConfig],
    HotkeyInfoArray: { index: EHotkey, value: SHotkeyInfo },
    FontStyleFileArray: [CFontStyleFile],
    CustomLayoutFileArray: [CLayoutFile],
    ResourceArray: { index: EResourceType, value: SResourceUI },
    TrialAllowedSinglePlayerMaps: [CMapFile],
    CommandHotkeyRepeatIgnored: Bit,
    AllowReturnToGameplayWhenDefeated: Bit,
    ActivateLobbyChatOnJoin: Bit,
    CameraEventThresholdDistance: Real,
    CameraEventThresholdPitch: CFangle,
    CameraEventThresholdYaw: CFangle,
    CameraEventThresholdTarget: Real,
    HelpControlCategories: [SHelpControlCategoryInfo],
    HelpControls: [SHelpControlInfo],
    HelpGameMechanics: [SHelpGameMechanicInfo],
    HelpTechTitle: CStringLink,
    HelpHiddenInGlue: Bit,
    HelpTechTreeSuffix: CString,
    AltSoundtrack: [SAltSoundtrack],
    DefaultObservedPlayerId: TPlayerId,
    SuppressSkinsForParticipants: Bit,
    SuppressSkinsInReplay: Bit,
    MapMechanicScoreValue: CScoreValueLink,
    TargetModeValidation: ETargetModeValidation,
    QuickCastMode: EQuickCastMode,
    CutsceneThemeChoiceArray: [CStringLink],
    CutsceneAssetPath: [SCutsceneAssetPath],
    CutsceneLatest: EGlueTheme,
    AllowedVideoHashes: CString
}) {
    static namespace;
}
class CHerd extends CClass.Ex({
    ClosestTo: EHerdClosestTo,
    PositionBias: Real32,
    NodeSearchRadius: Real32,
    Levels: [SHerdLevel],
    Nodes: [SHerdNode],
    SpeedLimit: CRange
}) {
    static namespace;
}
class CHerdNode extends CClass.Ex({}) {
    static namespace;
}
class CHero extends CClass.Ex({
    Name: CStringLink,
    StoreName: CStringLink,
    AttributeId: CFourCC,
    Flags: FHero,
    Model: CModelLink,
    DisplayModel: [CModelLink],
    Level: UInt32,
    State: EHeroState,
    AbilCategoryArray: [SHeroAbilCategory],
    StatArray: [CHeroStatLink],
    UserReference: CUserReference,
    Unit: CUnitLink,
    AlternateUnitArray: [CUnitLink],
    Role: EHeroRole,
    Melee: Bit,
    Description: CStringLink,
    InfoText: CStringLink,
    Title: CStringLink,
    Portrait: CImageLink,
    SelectScreenButtonImage: CImageLink,
    PartyPanelButtonImage: CImageLink,
    LeaderboardImage: CImageLink,
    ScoreScreenImage: CImageLink,
    DraftScreenLargeImage: CImageLink,
    DraftScreenLargeImageBackground: CImageLink,
    DraftScreenPortrait: CImageLink,
    DraftScreenPortraitBackground: CImageLink,
    ImageFacing: EHeroImageFacing,
    IntroCutsceneSize: EHeroCutsceneSize,
    PassiveButton: CButtonLink,
    PassiveAbil: CAbilLink,
    HeroAbilArray: [SHeroAbil],
    HeroicAbilArray: [SHeroHeroicAbility],
    SkinArray: [CSkinLink],
    DefaultMount: CMountLink,
    VOArray: [CSoundLink],
    SpecificKillVOArray: [SHeroSpecificVO],
    RequiredRewardArray: [CRewardLink],
    CanPurchaseUltimateSkinRewardArray: [CRewardLink],
    TalentProfileArray: [CTalentProfileLink],
    TalentTreeArray: [SHeroTalentTree],
    TalentTierArray: [SHeroTalentTier],
    SkinVariationRequiredReward: [CRewardLink],
    MountVariationRequiredReward: [CRewardLink],
    HeroSelectCutsceneFile: CCutsceneFile,
    ScoreScreenCutsceneFile: CCutsceneFile,
    MiniPortraitCutsceneFile: CCutsceneFile,
    InGameUnitStatusCutsceneFile: CCutsceneFile,
    VariationIcon: CImageLink,
    Difficulty: EHeroDifficulty,
    SpecificIntroVOArray: [SHeroSpecificIntroVO],
    HeroTierAchievementId: UInt,
    CollectionIcon: CImageLink,
    Gender: EHeroGender,
    Universe: EHeroUniverse,
    UniverseIcon: CImageLink,
    ProductId: TBattleProductId,
    PreviewCutsceneFile: CCutsceneFile,
    TileCutsceneFile: CCutsceneFile,
    LevelScalingArray: [SHeroLevelScaling],
    AdditionalSearchText: CStringLink,
    VariationArray: [CSkinLink],
    ReleaseDate: SProductReleaseDate,
    HyperlinkId: THyperlinkId,
    AllowedMountCategoryArray: [TMountCategory],
    Ratings: SHeroRatings,
    HomeScreenCutsceneFile: CCutsceneFile,
    TalentAIBuildsArray: [SHeroAITalentBuild],
    LayoutFile: CLayoutFile,
    HeroSpecificUIArray: [SHeroSpecificUI],
    PurchaseWarning: CStringLink,
    PurchaseWarningCondition: EPurchaseWarningCondition
}) {
    static namespace;
}
class CHeroAbil extends CClass.Ex({
    Name: CStringLink,
    Icon: CImageLink,
    Description: CStringLink,
    Tooltip: CStringLink,
    Image: CImageLink,
    Movie: CMovieFile,
    RequiredLevel: UInt32,
    RequiredMission: CMapLink,
    State: EHeroAbilState,
    UpgradeArray: [CUpgradeLink],
    LevelUpgradeArray: [CUpgradeLink],
    AbilCommandArray: [CAbilCommand],
    StatModifierArray: [SHeroStatModifier],
    UserReference: CUserReference
}) {
    static namespace;
}
class CHeroStat extends CClass.Ex({
    Name: CStringLink,
    Value: Int32,
    UserReference: CUserReference
}) {
    static namespace;
}
class CItem extends CClass.Ex({
    Face: CButtonLink,
    Flags: FItem,
    Class: CItemClassLink,
    Container: CItemContainerLink,
    Level: UInt32,
    Charge: SCharge,
    GroupCooldownLink: TCooldownLink,
    Requirements: CRequirementLink,
    CarryBehaviorArray: [CBehaviorLink],
    CarryWeaponArray: [SUnitWeaponData],
    EquipBehaviorArray: [CBehaviorLink],
    EquipWeaponArray: [SUnitWeaponData]
}) {
    static namespace;
}
class CItemAbil extends CItem.Ex({
    Abil: CAbilLink,
    ToggledFace: CButtonLink,
    AbilFlags: FAbilFlags
}) {
}
class CItemAbilPowerUp extends CItemAbil.Ex({
    CasterFilters: CTargetFilters,
    KillAfterUse: Bit
}) {
}
class CItemEffect extends CItem.Ex({
    Face: CButtonLink,
    Class: CItemClassLink,
    Container: CItemContainerLink,
    Level: UInt32,
    Charge: SCharge,
    GroupCooldownLink: TCooldownLink,
    Requirements: CRequirementLink,
    CarryBehaviorArray: [CBehaviorLink],
    CarryWeaponArray: [SUnitWeaponData],
    EquipBehaviorArray: [CBehaviorLink],
    EquipWeaponArray: [SUnitWeaponData],
    Effect: CEffectLink,
    EffectCost: SCost,
    EffectFlags: FEffectFlags,
    RefundFraction: SCostFactor,
    TargetFilters: CTargetFilters,
    Range: Real
}) {
}
class CItemEffectInstant extends CItemEffect.Ex({}) {
}
class CItemEffectTarget extends CItemEffect.Ex({}) {
}
class CItemClass extends CClass.Ex({
    Name: CStringLink
}) {
    static namespace;
}
class CItemContainer extends CClass.Ex({
    Model: CModelLink,
    ModelHeight: UInt32,
    ModelWidth: UInt32,
    Slots: [SItemContainerSlot]
}) {
    static namespace;
}
class CKinetic extends CClass.Ex({
    Name: CStringLink,
    ValidatorArray: [CValidatorLink],
    EditorCategories: TEditorCategories,
    Chance: Real,
    Cycles: UInt32,
    Duration: CGameTime
}) {
    static namespace;
}
class CKineticFollow extends CKinetic.Ex({
    Where: SEffectWhichLocation,
    Follow: EKineticFollow
}) {
}
class CKineticRotate extends CKinetic.Ex({
    Around: SEffectWhichLocation,
    Pitch: CVariatorGameFangle,
    Roll: CVariatorGameFangle,
    Yaw: CVariatorGameFangle
}) {
}
class CKineticSequence extends CKinetic.Ex({
    KineticArray: [CKineticLink]
}) {
}
class CKineticSet extends CKinetic.Ex({
    KineticArray: [CKineticLink]
}) {
}
class CKineticTranslate extends CKinetic.Ex({
    XOffset: CVariatorGameFixed,
    YOffset: CVariatorGameFixed,
    ZOffset: CVariatorGameFixed
}) {
}
class CKineticDistance extends CKinetic.Ex({
    DistanceAwayFrom: SEffectWhichLocation,
    Distance: SAccumulatedFixed
}) {
}
class CLensFlareSet extends CClass.Ex({
    Flare: [SFlareInfo]
}) {
    static namespace;
}
class CLight extends CClass.Ex({
    TimePerDay: CTimeOfDay,
    TimePerLoop: CTimeOfDay,
    TimeStart: CTimeOfDay,
    TimeEventArray: { index: EGameTimeEvent, value: STimeEvent },
    ToDInfoArray: [SLightInfo],
    EditorCategories: TEditorCategories,
    AmbientEnvironmentMap: CImageLink,
    LightingRegionMap: CImageLink
}) {
    static namespace;
}
class CLocation extends CClass.Ex({
    Name: CStringLink,
    Description: CStringLink,
    Movie: CMovieFile,
    MissionTitle: CStringLink,
    MissionText: CStringLink,
    PlanetToolTip: CStringLink,
    PrimaryObjectiveTitle: CStringLink,
    PrimaryObjectiveText: CStringLink,
    SecondaryObjectiveTitle: CStringLink,
    SecondaryObjectiveText: CStringLink,
    RewardTitle: CStringLink,
    RewardText: CStringLink,
    BonusTitle: CStringLink,
    BonusText: CStringLink,
    ContactName: CStringLink,
    ContactModel: CModelLink,
    ContactActor: CActorLink,
    PlanetModel: CModelLink,
    BackgroundModel: CModelLink,
    BackgroundImage: CImageLink,
    MissionCategoryArray: [SMissionCategory],
    AmbientSound: CSoundtrackLink,
    UserReference: CUserReference
}) {
    static namespace;
}
class CLoot extends CClass.Ex({
    ValidatorArray: [CValidatorLink]
}) {
    static namespace;
}
class CLootSpawn extends CLoot.Ex({
    SpawnLocation: EEffectLocation,
    SpawnOwner: EEffectPlayer,
    SpawnRange: Real
}) {
}
class CLootEffect extends CLoot.Ex({
    Effect: CEffectLink
}) {
}
class CLootItem extends CLoot.Ex({
    SpawnLocation: EEffectLocation,
    SpawnOwner: EEffectPlayer,
    SpawnRange: Real,
    ClassArray: [CItemClassLink],
    MaxLevel: UInt32,
    MinLevel: UInt32
}) {
}
class CLootSet extends CLoot.Ex({
    MinCount: UInt32,
    MaxCount: UInt32,
    ChildArray: [SLootChoice]
}) {
}
class CLootUnit extends CLoot.Ex({
    SpawnLocation: EEffectLocation,
    SpawnOwner: EEffectPlayer,
    SpawnRange: Real,
    Unit: CUnitLink
}) {
}
class CMap extends CClass.Ex({
    Name: CStringLink,
    File: CMapFile,
    Kind: EMapKind,
    Description: CStringLink,
    MissionTitle: CStringLink,
    MissionText: CStringLink,
    MissionBackgroundImage: CImageLink,
    PrimaryObjectiveTitle: CStringLink,
    PrimaryObjectiveText: CStringLink,
    PrimaryObjectiveTooltip: CStringLink,
    SecondaryObjectiveTitle: CStringLink,
    SecondaryObjectiveText: CStringLink,
    SecondaryObjectiveTooltip: CStringLink,
    RewardTitle: CStringLink,
    RewardText: CStringLink,
    RewardTooltip: CStringLink,
    ResearchTitle: CStringLink,
    ResearchText: CStringLink,
    ResearchTooltip: CStringLink,
    BonusTitle: CStringLink,
    BonusText: CStringLink,
    BonusTooltip: CStringLink,
    TechnologyTitle: CStringLink,
    TechnologyNameText: CStringLink,
    TechnologyDescriptionText: CStringLink,
    TechnologyTooltip: CStringLink,
    TechnologyUnitLink: CUnitLink,
    ContactTitle: CStringLink,
    ContactNameText: CStringLink,
    ContactModelLink: CModelLink,
    ContactTooltip: CStringLink,
    ContactActor: CActorLink,
    LoadingImage: CImageLink,
    LoadingTitle: CStringLink,
    LoadingSubtitle: CStringLink,
    LoadingBody: CStringLink,
    LoadingHelp: CStringLink,
    LoadingHelpRestart: CStringLink,
    LoadingHelpAlternate: CStringLink,
    LoadingTextOffset: C2iVector,
    LoadingTextWidth: UInt32,
    LoadingTextHeight: UInt32,
    LoadingTextStyle: CStyleName,
    ArmyCategory: CArmyCategoryLink,
    Location: CLocationLink,
    ObjectiveArray: [CObjectiveLink],
    Summary: CStringLink,
    UserReference: CUserReference
}) {
    static namespace;
}
class CModel extends CClass.Ex({
    Model: CModelFile,
    LowQualityModel: CModelLink,
    RequiredAnims: [CAnimsFile],
    OptionalAnims: [CAnimsFile],
    RequiredAnimsEx: [SAnimFile],
    AnimAliases: [SAnimAlias],
    AnimBlendTime: Real32,
    AnimSpeed: Real32,
    AttachProps: [SAttachProps],
    EditorCategories: TEditorCategories,
    Events: [SModelDataEvent],
    FacialController: CFacialFile,
    Flags: FModel,
    FuzzyGeometryPadding: Real32,
    Image: CImageLink,
    Lighting: CLightLink,
    Occlusion: EOcclusion,
    OccludingOpacity: Real32,
    PausedParticleSystemBehavior: EPausedParticleSystemBehavior,
    PhysicsMaterialMappings: [SPhysicsMaterialMapping],
    PhysicsMaterialOverride: CPhysicsMaterialLink,
    PhysicsGravityFactor: Real32,
    PhysicsForceFactor: Real32,
    PhysicsDeathMotionFactor: CVariatorActorReal32,
    PlanetPanelCamera: CString,
    Priority: UInt8,
    Radius: Real32,
    RadiusLoose: Real32,
    Quality: UInt32,
    PortraitOffset: C3Vector,
    ScaleMax: C3Vector,
    ScaleMin: C3Vector,
    SelectionLayer: UInt32,
    SelectionOffset: C3Vector,
    SelectionRadius: Real32,
    ShadowRadius: Real32,
    SquibTypeDefault: ESquibType,
    TechPurchaseCamera: CString,
    TechPurchaseSpeed: Real32,
    Tipability: Real32,
    TipabilityLength: Real32,
    TipabilityWidth: Real32,
    TipabilityBlendRate: CActorAngle,
    TipabilityPitchMax: CActorAngle,
    TipabilityRollMax: CActorAngle,
    BoundingBoxPadding: C3Vector,
    TextureAppliedGroups: CTextureProps,
    TextureDeclares: [STextureDeclare],
    TextureInfos: [STextureInfo],
    TextureExpressionsForEditor: [STextureExpressionSpec],
    TextureMatchesForEditor: [STextureMatchSpec],
    UnitGlossaryCamera: CString,
    UnitGlossaryVariation: UInt8,
    UnitGlossaryTeamColorIndex: UInt32,
    VariationCount: UInt32,
    Variations: [SModelVariation],
    WalkAnimMoveSpeed: CGameRate,
    RunAnimMoveSpeed: CGameRate,
    RunAnimMoveSpeedThreshold: CGameRate
}) {
    static namespace;
}
class CModelFoliage extends CModel.Ex({
    Layer: EFoliageLayer,
    SpringDampening: Real32,
    SpringStrength: Real32,
    DragCoefficient: Real32,
    WindInfluence: Real32,
    ForceNormalsUp: Bit,
    RandomDeviation: Real32,
    Flexibility: Real32
}) {
}
class CMount extends CClass.Ex({
    Name: CStringLink,
    InfoText: CStringLink,
    AttributeId: CFourCC,
    Flags: FMount,
    Model: CModelLink,
    Attached: Bit,
    RequiredRewardArray: [CRewardLink],
    VOArray: [CSoundLink],
    VariationIcon: CImageLink,
    VariationArray: [CMountLink],
    MountCategory: TMountCategory
}) {
    static namespace;
}
class CMover extends CClass.Ex({
    Flags: FMover,
    HeightMap: EHeightMap,
    PathMode: EPathMode,
    PlacementArray: { index: EPlacementArray, value: SPathingData },
    RestoreHeightDuration: CGameTime
}) {
    static namespace;
}
class CMoverAvoid extends CMover.Ex({}) {
}
class CMoverFlock extends CMover.Ex({}) {
}
class CMoverMissile extends CMover.Ex({
    MotionPhases: [SMotionPhase],
    MotionOverlays: [SMotionOverlay],
    RotationIgnoredByUnit: Bit,
    RespectUnitHeightAtDestination: Bit
}) {
}
class CMoverNull extends CMover.Ex({}) {
}
class CObjective extends CClass.Ex({
    Name: CStringLink,
    Description: CStringLink,
    Type: EObjectiveType,
    RequiredCount: Int32,
    RewardArray: { index: ERewardArray, value: Int32 },
    UserReference: CUserReference
}) {
    static namespace;
}
class CPhysicsMaterial extends CClass.Ex({
    Density: Real32,
    Friction: Real32,
    Restitution: Real32,
    LinearDamping: Real32,
    AngularDamping: Real32
}) {
    static namespace;
}
class CPing extends CClass.Ex({
    Model: CModelLink,
    Sound: CSoundLink,
    ActorSound: CActorLink,
    Color: CColor,
    Duration: Real,
    Scale: Real,
    Rotation: Real,
    Tooltip: CStringLink,
    Flags: FPing
}) {
    static namespace;
}
class CPlayerResponse extends CClass.Ex({
    EditorCategories: TEditorCategories,
    Priority: UInt32,
    Location: EDamageLocation
}) {
    static namespace;
}
class CPlayerResponseUnit extends CPlayerResponse.Ex({
    Chance: Real,
    Cost: SCost,
    Handled: CEffectLink,
    CasterFilters: CTargetFilters,
    TargetFilters: CTargetFilters,
    ValidatorArray: [CValidatorLink],
    ContinueMethod: EResponseContinueMethod,
    ProvideCategories: FDamageResponseCategory,
    PreventCategories: FDamageResponseCategory
}) {
}
class CPlayerResponseUnitDamage extends CPlayerResponseUnit.Ex({
    DeathType: FDeathType,
    ClampMaximum: Real,
    ClampMinimum: Real,
    Exhausted: CEffectLink,
    Evade: Bit,
    Fatal: Bit,
    Ignore: [Real],
    Kind: FDamageKind,
    Maximum: Real,
    Minimum: Real,
    ModifyAmount: Real,
    ModifyFraction: Real,
    ModifyLimit: Real,
    ModifyLimitVitalMaxFractionArray: { index: EUnitVital, value: Real },
    ModifyMinimumDamage: Bit,
    RequireEffectArray: [CEffectLink],
    ExcludeEffectArray: [CEffectLink],
    RequireEffectInChainArray: [CEffectLink],
    ExcludeEffectInChainArray: [CEffectLink],
    DamageValue: EDamageResponseDamageValue,
    ModifyScoreArray: [SScoreValueUpdate]
}) {
}
class CPlayerResponseUnitDeath extends CPlayerResponseUnit.Ex({
    DeathType: FDeathType
}) {
}
class CPlayerResponseUnitBirth extends CPlayerResponseUnit.Ex({
    BirthType: FResponseUnitBirthType
}) {
}
class CPortraitPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    Description: CStringLink,
    Image: STextureSheetEntry,
    ProductId: TBattleProductId,
    ReleaseDate: SProductReleaseDate,
    PortraitArray: [CRewardLink],
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CPreload extends CClass.Ex({
    NormalConditions: [CBankConditionLink],
    NormalTiming: EPreloadTiming,
    QueuedConditions: [CBankConditionLink],
    Flags: FPreload
}) {
    static namespace;
}
class CPreloadAsset extends CPreload.Ex({
    File: CAssetFile
}) {
}
class CPreloadScene extends CPreload.Ex({
    File: CCutsceneFile,
    Filter: CString
}) {
}
class CPreloadActor extends CPreload.Ex({
    Link: CActorLink
}) {
}
class CPreloadConversation extends CPreload.Ex({
    Link: CConversationLink
}) {
}
class CPreloadModel extends CPreload.Ex({
    Link: CModelLink,
    Variations: CString,
    ModelFlags: FModelFlags
}) {
}
class CPreloadSound extends CPreload.Ex({
    Link: CSoundLink,
    Variations: CString
}) {
}
class CPreloadUnit extends CPreload.Ex({
    Link: CUnitLink
}) {
}
class CPremiumMap extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    StoreTypeName: CStringLink,
    ReleaseDate: SProductReleaseDate,
    HyperlinkId: TProductHyperlinkId,
    ProductId: TBattleProductId,
    LicenseId: UInt32,
    Price: CStringLink,
    ScreenShotImageArray: [CImageLink],
    ScreenShotDescriptionArray: [CStringLink],
    Movie: CMovieFile,
    MoviePreviewImage: CImageLink,
    MovieDescription: CStringLink,
    Description: CStringLink,
    Title: CStringLink,
    PayToPlay: Bit,
    SuppressedRegion: CFourCC,
    ShortDescription: CStringLink,
    LanguageWarning: CStringLink,
    ScreenShotImageThumbnailArray: [CImageLink],
    MovieImageThumbnail: CImageLink,
    CustomFeaturedDescription: CStringLink
}) {
    static namespace;
}
class CRace extends CClass.Ex({
    Name: CStringLink,
    AttributeId: CFourCC,
    Icon: CImageLink,
    RaceIcon: CImageLink,
    StartLocationAlert: CAlertLink,
    GameMusic: CSoundtrackLink,
    Flags: FRace,
    ShowResource: FResourceType,
    StartingUnitArray: [SStartingUnit],
    StartingResource: { index: EResourceType, value: UInt32 },
    FoodCeiling: UInt32,
    UpkeepTax: [SUpkeepTax],
    GlossaryTeamColorIndex: UInt32,
    MiniMapBorderColor: CColor,
    PlacementGridColorBlindColor: CColor,
    VictorySound: CSoundLink,
    DefeatSound: CSoundLink,
    ExpansionOrder: UInt32,
    LevelAchievementId: UInt,
    DefaultConsoleSkin: CConsoleSkinLink
}) {
    static namespace;
}
class CRaceBannerPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    Description: CStringLink,
    Image: STextureSheetEntry,
    ProductId: TBattleProductId,
    ReleaseDate: SProductReleaseDate,
    RaceBannerArray: [CRewardLink],
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CRequirement extends CClass.Ex({
    EditorCategories: TEditorCategories,
    CanBeSuppressed: FRequirement,
    NodeArray: { index: ENodeArray, value: SRequirementNode }
}) {
    static namespace;
}
class CRequirementNode extends CClass.Ex({
    Flags: FRequirementNode,
    Tooltip: CStringLink
}) {
    static namespace;
}
class CRequirementGT extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementLT extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementGTE extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementLTE extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementEq extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementNE extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementAnd extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementOr extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementXor extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementNot extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementOdd extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementDiv extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementMod extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementMul extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementSum extends CRequirementNode.Ex({
    OperandArray: [CRequirementNodeLink]
}) {
}
class CRequirementConst extends CRequirementNode.Ex({
    Value: Int32
}) {
}
class CRequirementAllowAbil extends CRequirementNode.Ex({
    Link: CAbilLink,
    Index: UInt32
}) {
}
class CRequirementAllowBehavior extends CRequirementNode.Ex({
    Link: CBehaviorLink
}) {
}
class CRequirementAllowUnit extends CRequirementNode.Ex({
    Link: CUnitLink
}) {
}
class CRequirementAllowUpgrade extends CRequirementNode.Ex({
    Link: CUpgradeLink
}) {
}
class CRequirementCountAbil extends CRequirementNode.Ex({
    Count: SRequirementCountAbil
}) {
}
class CRequirementCountBehavior extends CRequirementNode.Ex({
    Count: SRequirementCountBehavior
}) {
}
class CRequirementCountEffect extends CRequirementNode.Ex({
    Count: SRequirementCountEffect
}) {
}
class CRequirementCountUnit extends CRequirementNode.Ex({
    Count: SRequirementCountUnit
}) {
}
class CRequirementCountUpgrade extends CRequirementNode.Ex({
    Count: SRequirementCountUpgrade
}) {
}
class CReverb extends CClass.Ex({
    Room: Int32,
    RoomHF: Int32,
    RoomLF: Int32,
    DecayTime: Real32,
    DecayHFRatio: Real32,
    Reflections: Int32,
    ReflectionsDelay: Real32,
    Reverb: Int32,
    ReverbDelay: Real32,
    HFReference: Real32,
    LFReference: Real32,
    RoomRolloffFactor: Real32,
    Diffusion: Real32,
    Density: Real32,
    SpeakerMix: { index: ESpeakerMode, value: Real32 }
}) {
    static namespace;
}
class CReward extends CClass.Ex({
    Category: SRewardCategory,
    Flags: FReward,
    Name: CStringLink,
    Description: CStringLink,
    DescriptionUnearned: CStringLink,
    IconFile: CImageLink,
    IconCols: UInt32,
    IconRows: UInt32,
    IconSlot: UInt32,
    IgnorePlayerRace: Bit,
    Race: CRaceLink,
    Hero: CHeroLink,
    License: TBattleLicenseName,
    Upgrades: [CUpgradeLink],
    Skin: CSkinLink,
    UIOrderHint: UInt32,
    LargeImage: CImageLink,
    RewardSpecificUIArray: [SRewardSpecificUI],
    ParentBundle: CBundleLink
}) {
    static namespace;
}
class CRewardDecal extends CReward.Ex({
    DecalPack: CDecalPackLink,
    Texture: CTextureLink,
    Spray: CSprayLink
}) {
}
class CRewardIcon extends CReward.Ex({}) {
}
class CRewardModel extends CReward.Ex({
    Model: CModelLink
}) {
}
class CRewardPortrait extends CReward.Ex({
    Model: CModelLink,
    PortraitPack: CPortraitPackLink
}) {
}
class CRewardBadge extends CReward.Ex({
    Texture: CTextureLink
}) {
}
class CRewardPoints extends CReward.Ex({
    Points: UInt32
}) {
}
class CRewardTrophy extends CReward.Ex({
    Trophy: CTrophyLink
}) {
}
class CRewardEmoticon extends CReward.Ex({
    Emoticon: CEmoticonLink
}) {
}
class CRewardVoicePack extends CReward.Ex({
    VoicePack: CVoicePackLink,
    ReplacementArray: [SGameReplacement]
}) {
}
class CRewardPortraitInGame extends CReward.Ex({
    Enabled: Bit
}) {
}
class CRewardConsoleSkin extends CReward.Ex({
    ConsoleSkin: CConsoleSkinLink
}) {
}
class CRewardSpray extends CReward.Ex({
    Texture: CTextureLink,
    Spray: CSprayLink
}) {
}
class CRewardSprayUseDecal extends CReward.Ex({
    Enabled: Bit
}) {
}
class CRewardRaceBanner extends CReward.Ex({
    RaceBannerPack: CRaceBannerPackLink,
    Image1v1: CImageLink,
    Image2v2: CImageLink,
    Image3v3: CImageLink,
    Image4v4: CImageLink
}) {
}
class CRewardStim extends CReward.Ex({
    StimPack: CStimPackLink,
    Texture: CTextureLink
}) {
}
class CScoreResult extends CClass.Ex({
    Name: CStringLink,
    PublishName: CStringLink,
    Tooltip: CStringLink,
    Icon: CImageLink,
    Flags: FScoreResult,
    SortValue: Int32
}) {
    static namespace;
}
class CScoreResultRoot extends CScoreResult.Ex({
    HeaderTable: [CScoreResultLink]
}) {
}
class CScoreResultScore extends CScoreResult.Ex({
    ValueTable: [CScoreValueLink]
}) {
}
class CScoreResultGraph extends CScoreResult.Ex({
    ValueTable: [CScoreValueLink]
}) {
}
class CScoreResultPane extends CScoreResult.Ex({
    ValueTable: [CScoreValueLink]
}) {
}
class CScoreResultBuildOrder extends CScoreResult.Ex({}) {
}
class CScoreResultCallouts extends CScoreResult.Ex({}) {
}
class CScoreResultExperience extends CScoreResult.Ex({
    ValueTable: [CScoreValueLink]
}) {
}
class CScoreResultPerformance extends CScoreResult.Ex({
    ValueTable: [CScoreValueLink]
}) {
}
class CScoreValue extends CClass.Ex({
    Name: CStringLink,
    PublishName: CStringLink,
    Tooltip: CStringLink,
    Icon: CImageLink,
    Flags: FScoreValueFlags,
    Sort: EScoreSort,
    Report: EScoreValueReport,
    UniqueTag: CFourCC
}) {
    static namespace;
}
class CScoreValueCustom extends CScoreValue.Ex({
    Collapse: EScoreCollapse,
    Type: EScoreValueType
}) {
}
class CScoreValueStandard extends CScoreValue.Ex({
    Value: EScoreValue
}) {
}
class CScoreValueConstant extends CScoreValue.Ex({
    Collapse: EScoreCollapse,
    Type: EScoreValueType,
    Value: Real
}) {
}
class CScoreValueCombine extends CScoreValue.Ex({
    Collapse: EScoreCollapse,
    Type: EScoreValueType,
    Operation: EScoreValueOperation,
    ValueTable: [CScoreValueLink]
}) {
}
class CShape extends CClass.Ex({
    Name: CStringLink,
    EditorCategories: TEditorCategories
}) {
    static namespace;
}
class CShapeArc extends CShape.Ex({
    Arc: CFangleArc,
    Radius: Real
}) {
}
class CShapeQuad extends CShape.Ex({
    Quad: CfQuad
}) {
}
class CSkin extends CClass.Ex({
    Name: CStringLink,
    InfoText: CStringLink,
    AttributeId: CFourCC,
    ReplacementArray: [SGameReplacement],
    VariationIcon: CImageLink,
    DisplayModel: [CModelLink],
    ModelGroups: [SSkinModelGroup],
    ModelMacroRun: [SSkinModelMacroRun],
    EffectArray: [SUpgradeEffect],
    Camera: CString,
    Rotation: Int32,
    WarChestUILight: CString,
    WarChestDisplayModel: CModelLink,
    WarChestDisplayActor: CActorLink,
    CollectionDisplayModel: CModelLink,
    CollectionDisplayUnit: CUnitLink,
    CollectionDisplayModelAlternate: CModelLink,
    CollectionDisplayUnitAlternate: CUnitLink,
    CollectionDisplayActor: CActorLink,
    IsDefaultSkin: Bit
}) {
    static namespace;
}
class CSkinPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    EntryArray: [SSkinPackEntry],
    ReleaseDate: SProductReleaseDate,
    StoreTypeName: CStringLink,
    CollectionId: CIdentifier
}) {
}
class CSound extends CClass.Ex({
    EditorCategories: TEditorCategories,
    AssetArray: [SSoundAsset],
    AssetArrayTemplate: SSoundAssetTemplate,
    Flags: FSound,
    Category: ESoundCategory,
    CategoryLocal: ESoundCategory,
    Chance: UInt8,
    ConeAngle: CRange,
    ConeOrientation: C3Vector,
    ConeVolume: CRange,
    DopplerLevel: Real32,
    DupeDestroyCount: UInt16,
    DupeDestroyCountPerPlayer: UInt16,
    DupeFadeBlend: ESoundBlend,
    DupeFadeIn: [SVolumeFade],
    DupeFadeOut: [SVolumeFade],
    DupeHistoryCount: UInt16,
    DupeMaximumMethod: ESoundDupe,
    DupeMuteCount: UInt16,
    DupeMuteCountPerPlayer: UInt16,
    DupeRepeatCount: UInt16,
    DupeThresholdFadeTime: UInt32,
    DupeThresholdPoints: [SVolumeThreshold],
    DupeWait: CiRange,
    DupePrioritization: ESoundDupePriority,
    Exclusivity: CSoundExclusivityLink,
    FogFadeBlend: ESoundBlend,
    FogFadeIn: [SVolumeFade],
    FogFadeOut: [SVolumeFade],
    HerdNode: CHerdNodeLink,
    LocaleFlags: SSoundLocaleFlags,
    LoopCount: Int32,
    LoopDelay: CiRange,
    LowPassGain: Real32,
    MixerPriority: Int16,
    MixerPriorityNonLocal: Int16,
    Mode: ESoundMode,
    Mute: Bit,
    MuteFadeBlend: ESoundBlend,
    MuteFadeIn: [SVolumeFade],
    MuteFadeOut: [SVolumeFade],
    OcclusionDirect: CRange,
    OcclusionReverb: CRange,
    OffsetFadeBlend: ESoundBlend,
    OffsetFadeIn: [SVolumeFade],
    OffsetFadeOut: [SVolumeFade],
    OffsetShiftBlend: ESoundBlend,
    OffsetShiftIn: [SPitchShift],
    OffsetShiftOut: [SPitchShift],
    OverlapPitchDelta: Real32,
    OverlapTimeDelta: UInt16,
    Pan: CRange,
    PanLevel: Real32,
    PanLevelNonLocal: Real32,
    Pitch: CPitchRange,
    PlayDelay: CiRange,
    PositionRandomOffset: C3Vector,
    PositionRandomOffsetPower: Real32,
    ResourcePriority: UInt8,
    ReverbBalance: SReverbBalance,
    ReverbRolloffBlend: ESoundBlend,
    ReverbRolloffPoints: [SReverbRolloff],
    Select: ESoundSelect,
    Solo: Bit,
    SpeakerMix: { index: ESpeakerMode, value: Real32 },
    SpeakerMixNonLocal: { index: ESpeakerMode, value: Real32 },
    Spread: Real32,
    SustainFadeBlend: ESoundBlend,
    SustainFade: [SVolumeFade],
    Timeout: UInt32,
    VariationMinimum: UInt32,
    Volume: CVolumeRange,
    VolumeRolloffBlend: ESoundBlend,
    VolumeRolloffFadeBlend: ESoundBlend,
    VolumeRolloffFadeIn: [SVolumeFade],
    VolumeRolloffFadeOut: [SVolumeFade],
    VolumeRolloffPoints: [SVolumeRolloff],
    LocalVolumeAdjustment: CVolumeRange,
    NonLocalVolumeAdjustment: CVolumeRange,
    CategoryDuckingLocal: CSoundMixSnapshotLink,
    CategoryDuckingNonLocal: CSoundMixSnapshotLink
}) {
    static namespace;
}
class CSoundExclusivity extends CClass.Ex({
    Group: UInt32,
    Priority: Real32,
    CollideWithLower: EExclusivityAction,
    CollideWithEqual: EExclusivityAction,
    CollideWithHigher: EExclusivityAction,
    QCollideWithLower: EExclusivityQueueAction,
    QCollideWithEqual: EExclusivityQueueAction,
    QCollideWithHigher: EExclusivityQueueAction,
    QTimeout: UInt32,
    QDelay: UInt32,
    InterruptFadeBlend: ESoundBlend,
    InterruptFade: [SVolumeFade],
    InterruptDelay: UInt32,
    Flags: FSoundExclusivity,
    SuppressGroups: [UInt32],
    DupeWait: UInt32
}) {
    static namespace;
}
class CSoundMixSnapshot extends CClass.Ex({
    Attack: UInt32,
    Hold: UInt32,
    Release: UInt32,
    Flags: FSoundMixSnapshot,
    MixGlobal: { index: EMix, value: CVolume },
    MixNonLocal: { index: EMix, value: CVolume }
}) {
    static namespace;
}
class CSoundtrack extends CClass.Ex({
    CueArray: [SSoundtrackCue],
    Delay: CiRange,
    Flags: FSoundtrack,
    Select: ESoundSelect,
    Next: CSoundtrackLink
}) {
    static namespace;
}
class CSpray extends CClass.Ex({
    Model: CModelLink,
    Texture: CTextureLink,
    Button: CButtonLink
}) {
    static namespace;
}
class CSprayPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    Description: CStringLink,
    Image: STextureSheetEntry,
    ProductId: TBattleProductId,
    ReleaseDate: SProductReleaseDate,
    SprayArray: [CRewardLink],
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CStimPack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    ProductId: TBattleProductId,
    StoreTypeName: CStringLink,
    Duration: UInt32,
    ReleaseDate: SProductReleaseDate
}) {
    static namespace;
}
class CTacCooldown extends CClass.Ex({
    UnitLink: CUnitLink,
    TacAbilData: [STacAbilData]
}) {
    static namespace;
}
class CTactical extends CClass.Ex({}) {
    static namespace;
}
class CTacticalOrder extends CTactical.Ex({
    Abil: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    Marker: SMarker,
    Retreat: Bit,
    TargetFind: CTargetFindLink,
    Validator: CValidatorLink
}) {
}
class CTacticalSet extends CTactical.Ex({
    Array: [CTacticalLink]
}) {
}
class CTalent extends CClass.Ex({
    Face: CButtonLink,
    Abil: CAbilLink,
    RankArray: [STalentRank],
    AbilityModificationArray: [STalentAbilityModification],
    Active: Bit,
    Trait: Bit
}) {
    static namespace;
}
class CTalentProfile extends CClass.Ex({
    Name: CStringLink,
    Talents: [CTalentLink],
    Flags: FTalentProfile
}) {
    static namespace;
}
class CTargetFind extends CClass.Ex({
    Flags: FTargetFind,
    TargetFilters: CTargetFilters,
    CasterValidator: CValidatorLink,
    TargetValidator: CValidatorLink
}) {
    static namespace;
}
class CTargetFindBestPoint extends CTargetFind.Ex({
    DamageBase: Real,
    Effect: CEffectLink,
    MinCount: UInt32,
    MinScore: Real,
    BonusAttri: EUnitAttribute
}) {
}
class CTargetFindWorkerRallyPoint extends CTargetFind.Ex({
    CommandIndex: UInt32
}) {
}
class CTargetFindRallyPoint extends CTargetFind.Ex({
    CommandIndex: UInt32
}) {
}
class CTargetFindEnumArea extends CTargetFind.Ex({
    LaunchLocation: SEffectWhichLocation,
    ImpactLocation: SEffectWhichLocation,
    ExcludeArray: [SEffectWhichUnit],
    IncludeArray: [SEffectWhichUnit],
    SearchFilters: CTargetFilters,
    MinCountError: CCmdResult,
    MinCount: UInt32,
    MaxCount: SAccumulatedUInt32,
    RecycleCount: UInt32,
    SearchFlags: FSearchFlags,
    AreaArray: [STargetFindEnumArea],
    Abil: CAbilLink,
    ExtendRadius: Real,
    TargetSorts: STargetSorts
}) {
}
class CTargetFindEffect extends CTargetFind.Ex({
    Effect: CEffectLink,
    ExtendRadius: Real,
    TargetSorts: STargetSorts
}) {
}
class CTargetFindLastAttacker extends CTargetFind.Ex({}) {
}
class CTargetFindOffset extends CTargetFind.Ex({
    Angle: CFangle,
    Distance: CfRange
}) {
}
class CTargetFindOrder extends CTargetFind.Ex({
    Abil: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex
}) {
}
class CTargetFindSet extends CTargetFind.Ex({
    Type: ETargetFindSet,
    Array: [CTargetFindLink]
}) {
}
class CTargetSort extends CClass.Ex({
    WhichUnit: SEffectWhichUnit,
    Descending: Bit
}) {
    static namespace;
}
class CTargetSortAlliance extends CTargetSort.Ex({
    Alliance: EAllianceId,
    WithPlayer: SEffectWhichPlayer
}) {
}
class CTargetSortAngle extends CTargetSort.Ex({
    LaunchLocation: SEffectWhichLocation,
    ImpactLocation: SEffectWhichLocation
}) {
}
class CTargetSortBehaviorCount extends CTargetSort.Ex({
    Behavior: CBehaviorLink,
    Value: UInt32
}) {
}
class CTargetSortBehaviorDuration extends CTargetSort.Ex({
    Behavior: CBehaviorLink,
    Value: Real
}) {
}
class CTargetSortChargeCount extends CTargetSort.Ex({
    Ability: CAbilLink,
    Charge: TChargeLink,
    Value: Real
}) {
}
class CTargetSortChargeRegen extends CTargetSort.Ex({
    Ability: CAbilLink,
    Charge: TChargeLink,
    Value: Real
}) {
}
class CTargetSortCooldown extends CTargetSort.Ex({
    Ability: CAbilLink,
    Cooldown: TCooldownLink,
    Value: Real
}) {
}
class CTargetSortDistance extends CTargetSort.Ex({
    WhichLocation: SEffectWhichLocation
}) {
}
class CTargetSortField extends CTargetSort.Ex({
    Field: TCatalogFieldPath,
    Value: CIdentifier
}) {
}
class CTargetSortInterruptible extends CTargetSort.Ex({
    Value: Bit
}) {
}
class CTargetSortMarker extends CTargetSort.Ex({
    Value: UInt32
}) {
}
class CTargetSortPowerSourceLevel extends CTargetSort.Ex({
    Behavior: CBehaviorLink,
    Value: UInt32
}) {
}
class CTargetSortPowerUserLevel extends CTargetSort.Ex({
    Behavior: CBehaviorLink,
    Value: UInt32
}) {
}
class CTargetSortPriority extends CTargetSort.Ex({
    Value: TAttackTargetPriority
}) {
}
class CTargetSortRandom extends CTargetSort.Ex({}) {
}
class CTargetSortValidator extends CTargetSort.Ex({
    Validator: CValidatorLink
}) {
}
class CTargetSortVeterancy extends CTargetSort.Ex({
    Behavior: CBehaviorLink,
    Value: UInt32
}) {
}
class CTargetSortVital extends CTargetSort.Ex({
    Value: Real,
    Vital: EUnitVital
}) {
}
class CTargetSortVitalFraction extends CTargetSort.Ex({
    Value: Real,
    Vital: EUnitVital
}) {
}
class CTerrain extends CClass.Ex({
    Name: CStringLink,
    EditorCategories: TEditorCategories,
    EditorHidden: Bit,
    Lighting: CLightLink,
    LoadingScreen: CImageLink,
    TextureProp: CTextureProps,
    Camera: CCameraLink,
    Ambience: CSoundtrackLink,
    DSPArray: [SDSPArray],
    DSPArrayMasterOutput: [CDSPLink],
    ReverbGlobal: CReverbLink,
    ReverbAmbient: CReverbLink,
    SoundDistanceFactor: Real32,
    SoundDopplerFactor: Real32,
    SoundRolloffFactor: Real32,
    TilingFreq: Real32,
    POMScale: Real32,
    HideLowestLevel: Bit,
    MinimapBackgroundColor: CColor,
    MinimapBrightenFactor: Real32,
    BlendTextures: [CTerrainTexLink],
    HardTiles: [CTileLink],
    CliffSets: [CCliffLink],
    FixedSkyboxActor: CActorCreateKey,
    FixedSkyboxModel: CModelLink,
    NonFixedSkyboxActor: CActorCreateKey,
    NonFixedSkyboxModel: CModelLink,
    EnvironmentMap: CImageLink,
    FOWColor: CColor,
    FOWPlaneEnabled: Bit,
    FogEnabled: Bit,
    FogColor: CColor,
    FogDensity: Real32,
    FogFalloff: Real32,
    FogStartingHeight: Real32,
    FogNearPlane: Real32,
    FogFarPlane: Real32,
    FogDistanceFalloff: Real32,
    Gravity: Real32,
    PhysicsTimeScale: Real32,
    WindAngleHorizontal: Real32,
    WindAngleVertical: Real32,
    WindSpeed: Real32,
    WindTurbulencePower: Real32,
    WindTurbulenceSpeed: Real32,
    CreepBaseTexture: CImageLink,
    CreepBaseSpecularMap: CImageLink,
    CreepEdgeNormalMap: CImageLink,
    CreepHeightMap: CImageLink,
    CreepNoiseMap: CImageLink,
    CreepSettingsArray: { index: ECreepSettingsArray, value: SCreepSettings },
    FoliageSettingsArray: { index: EFoliageSettingsArray, value: SFoliageSimulationConfig },
    HeightFlags: FHeightFlags,
    HeightMapEnabled: Bit,
    MinimumVisionCliffLevel: UInt8,
    RampNoBuild: Bit
}) {
    static namespace;
}
class CTerrainObject extends CClass.Ex({
    Model: CModelFile,
    EditorFlags: FEditor,
    EditorModel: CModelLink,
    EditorIcon: CImageLink,
    EditorCategories: TEditorCategories,
    EditorCursorOffset: Real,
    TexSets: [CTerrainLink],
    Footprint: CFootprintLink,
    Radius: Real,
    OccludeHeight: Real,
    BoostedCliffLevel: TCliffLevel
}) {
    static namespace;
}
class CCliffDoodad extends CClass.Ex({
    Model: CModelFile,
    EditorFlags: FEditor,
    EditorModel: CModelLink,
    EditorIcon: CImageLink,
    EditorCategories: TEditorCategories,
    EditorCursorOffset: Real,
    TexSets: [CTerrainLink],
    Footprint: CFootprintLink,
    Radius: Real,
    OccludeHeight: Real,
    BoostedCliffLevel: TCliffLevel,
    CliffSet: CCliffLink,
    NumCellsDown: UInt32,
    NumCellsAcross: UInt32,
    HeightCodes: [CString]
}) {
    static namespace;
}
class CTerrainTex extends CClass.Ex({
    Texture: CImageLink,
    Normalmap: CImageLink,
    Heightmap: CImageLink,
    HeightMapOffset: Real32,
    HeightMapScale: Real32,
    EditorIcon: CImageLink,
    AnimRate: C2fVector,
    DoodadEntry: [STerrainDoodad],
    PhysicsMaterial: CPhysicsMaterialLink
}) {
    static namespace;
}
class CTexture extends CClass.Ex({
    File: CImageLink,
    Prefix: CIdentifier,
    Slot: CTextureSlot,
    PropsAdd: CTextureProps,
    PropsRemove: CTextureProps,
    PropsSet: CTextureProps,
    MovieSoundSettings: CSoundLink,
    MovieSoundSettings5dot1: CSoundLink,
    MovieSoundSettingsStereo: CSoundLink,
    Flags: FTexture
}) {
    static namespace;
}
class CTextureSheet extends CClass.Ex({
    Image: CImageLink,
    Rows: UInt32,
    Columns: UInt32
}) {
    static namespace;
}
class CTile extends CClass.Ex({
    Material: CImageLink,
    EditorIcon: CImageLink,
    Flags: FTile,
    TesselationDistance: Real32,
    TileWidthDistance: Real32,
    TileHeightRepetitions: UInt32,
    CapLength: Real32,
    DefaultSplineWidth: Real32,
    DefaultWingWidth: Real32
}) {
    static namespace;
}
class CTrophy extends CClass.Ex({
    DefinitionId: UInt32,
    TopCutsceneFilter: CString,
    BottomCutsceneFilter: CString,
    CutsceneFile: CCutsceneFile,
    GameModel: CModelLink,
    Skin: CSkinLink
}) {
    static namespace;
}
class CTurret extends CClass.Ex({
    Idle: ETurretIdle,
    YawStart: CFangle,
    YawArc: CFangleArc,
    YawRate: CFangleRate,
    YawIdleRate: CFangleRate,
    Fidget: SFidget
}) {
    static namespace;
}
class CUnit extends CClass.Ex({
    Name: CStringLink,
    UserTag: CStringLink,
    RandomNameArray: [CStringLink],
    Subtitle: CStringLink,
    Description: CStringLink,
    InfoTooltipPriority: UInt32,
    DeathTime: CGameTime,
    DeathRevealFilters: CTargetFilters,
    DeathRevealRadius: Real,
    DeathRevealDuration: CGameTime,
    DeathRevealType: EDeathReveal,
    ReviveDelay: CGameTime,
    ReviveType: CUnitLink,
    Facing: CFacing,
    EditorFacingAlignment: CFangle,
    Race: CRaceLink,
    Mob: EUnitMob,
    Gender: EUnitGender,
    FlagArray: FUnit,
    UserFlagArray: FUnitUser,
    ResourceState: EResourceState,
    ResourceType: EResourceType,
    ResourceDropOff: FResourceType,
    FogVisibility: EFogVisibility,
    EditorFlags: FEditor,
    PlaneArray: FPlane,
    PushPriority: Real,
    Collide: FUnitCollide,
    DefaultAcquireLevel: EAcquireLevel,
    Response: EUnitResponse,
    Attributes: FUnitAttribute,
    Level: UInt32,
    ArmorType: EArmorType,
    LifeStart: Real,
    LifeMax: Real,
    LifeArmor: Real,
    LifeArmorFormula: SUnitArmorFormula,
    LifeArmorDisplayFlags: FEquipmentDisplay,
    LifeRegenDelay: CGameTime,
    LifeRegenRate: CGameRate,
    LifeRegenRateCreep: CGameRate,
    LifeRegenRateNight: CGameRate,
    LifeArmorName: CStringLink,
    LifeArmorTip: CStringLink,
    LifeArmorLevel: UInt32,
    LifeDamageGain: { index: EDamageKind, value: Real },
    LifeDamageLeech: [Real],
    EnergyStart: Real,
    EnergyMax: Real,
    EnergyArmor: Real,
    EnergyArmorFormula: SUnitArmorFormula,
    EnergyRegenDelay: CGameTime,
    EnergyRegenRate: CGameRate,
    EnergyRegenRateCreep: CGameRate,
    EnergyRegenRateNight: CGameRate,
    EnergyDamageGain: [Real],
    EnergyDamageLeech: [Real],
    EnergyDamageRatio: Real,
    ShieldsStart: Real,
    ShieldsMax: Real,
    ShieldArmor: Real,
    ShieldArmorFormula: SUnitArmorFormula,
    ShieldArmorDisplayFlags: FEquipmentDisplay,
    ShieldRegenDelay: CGameTime,
    ShieldRegenRate: CGameRate,
    ShieldRegenRateCreep: CGameRate,
    ShieldRegenRateNight: CGameRate,
    ShieldArmorName: CStringLink,
    ShieldArmorTip: CStringLink,
    ShieldArmorLevel: UInt32,
    ShieldDamageGain: [Real],
    ShieldDamageLeech: [Real],
    ShieldDamageRatio: Real,
    ResourceDamageLeech: { index: EDamageKind, value: SUnitResourceRatio },
    ResourceDamageLeechFilters: CTargetFilters,
    VitalBonusDensity: { index: EUnitVital, value: Real },
    VitalMultiplierDensity: { index: EUnitVital, value: Real },
    Mover: CMoverLink,
    Speed: CGameSpeed,
    SpeedDisplayFlags: FEquipmentDisplay,
    SpeedBonusCreep: CGameSpeed,
    SpeedMultiplierCreep: Real,
    SpeedMaximum: CGameSpeed,
    SpeedMinimum: CGameSpeed,
    AttackSpeedMultiplierCreep: Real,
    Acceleration: CGameAcceleration,
    Deceleration: CGameAcceleration,
    LateralAcceleration: CGameAcceleration,
    StationaryTurningRate: CFangleRate,
    TurningRate: CFangleRate,
    Sight: Real,
    SightBonus: { index: EGameTimeEvent, value: Real },
    Height: Real,
    VisionHeight: Real,
    OccludeHeight: Real,
    BoostedCliffLevel: TCliffLevel,
    BoostedHeight: [Real],
    Food: Real,
    CostCategory: ECostCategory,
    CostResource: { index: EResourceType, value: Int32 },
    StockCharge: SStockCharge,
    PawnItemReduction: Real,
    BuildTime: CGameTime,
    RepairTime: CGameTime,
    ReviveTime: CGameTime,
    AttackTargetPriority: TAttackTargetPriority,
    AIOverideTargetPriority: TAttackTargetPriority,
    DamageDealtXP: UInt32,
    DamageTakenXP: UInt32,
    KillXP: UInt32,
    KillResource: { index: EResourceType, value: Int32 },
    AbilArray: [SUnitAbilData],
    BehaviorArray: [SUnitBehaviorData],
    TurretArray: [CTurretLink],
    WeaponArray: [SUnitWeaponData],
    EffectArray: { index: EEffectArray, value: CEffectLink },
    CardLayouts: [SCardLayout],
    Radius: TUnitRadius,
    DeadRadius: TUnitRadius,
    SeparationRadius: Real,
    FormationRank: UInt8,
    InnerRadius: TUnitRadius,
    InnerRadiusSafetyMultiplier: Real,
    DeadInnerRadius: TUnitRadius,
    CargoOverlapFilters: CTargetFilters,
    CargoSize: TCargoSize,
    Footprint: CFootprintLink,
    DeadFootprint: CFootprintLink,
    PlacementFootprint: CFootprintLink,
    AddedOnArray: [SAddedOnData],
    AddOnOffsetX: Real,
    AddOnOffsetY: Real,
    BuiltOn: [CUnitLink],
    BuildOnAs: [CUnitLink],
    ScoreMake: Int32,
    ScoreMakeCostFactor: { index: EResourceType, value: Real },
    ScoreKill: Int32,
    ScoreKillCostFactor: { index: EResourceType, value: Real },
    ScoreLost: Int32,
    ScoreLostCostFactor: [Real],
    ScoreResult: CScoreResultLink,
    SubgroupPriority: UInt8,
    SubgroupPriorityDelta: Int16,
    MinimapRadius: Real,
    EditorCategories: TEditorCategories,
    TacticalAI: CTacticalLink,
    TacticalAIRange: TGalaxyFunction,
    TacticalAIThink: TGalaxyFunction,
    TacticalAIChannel: TGalaxyFunction,
    TacticalAIFilters: CTargetFilters,
    AIKiteRange: Real,
    AIEvalFactor: Real,
    AIEvalConstant: Real,
    Item: CItemLink,
    Mass: Real,
    PowerupCost: SCost,
    PowerupEffect: CEffectLink,
    PowerupFilters: CTargetFilters,
    PowerupRange: Real,
    LeaderAlias: CUnitLink,
    HotkeyAlias: CUnitLink,
    SelectAlias: CUnitLink,
    SubgroupAlias: CUnitLink,
    TechAliasArray: [TTechAlias],
    EquipmentArray: [SUnitEquipment],
    SyncModelData: CSyncModelDataFile,
    AINotifyEffect: CEffectLink,
    GlossaryCategory: CStringLink,
    GlossaryPriority: Int32,
    GlossaryStrongArray: [CUnitLink],
    GlossaryWeakArray: [CUnitLink],
    GlossaryAlias: CUnitLink,
    HotkeyCategory: CStringLink,
    KillDisplay: EUnitDisplay,
    RankDisplay: EUnitDisplay,
    AIEvaluateAlias: CUnitLink,
    TechTreeProducedUnitArray: [CUnitLink],
    TechTreeUnlockedUnitArray: [CUnitLink],
    Fidget: SFidget,
    LootArray: [CLootLink],
    TauntDuration: { index: EUnitTaunt, value: CGameTime },
    TauntDoesntStopUnit: FTauntDoesntStopUnit,
    IdleCommand: CAbilCommand,
    ReviveInfoBase: SUnitReviveInfo,
    ReviveInfoLevel: SUnitReviveInfo,
    OverlapIndex: UInt8,
    AlliedPushPriority: Int8,
    AcquireMovementLimit: Real,
    AcquireLeashRadius: Real,
    AcquireLeashResetRadius: Real,
    OrderDisplayMinimum: UInt32,
    EffectHistoryLimit: [UInt16],
    TargetingHitTestPriority: UInt8,
    DataCollection: CDataCollectionLink
}) {
    static namespace;
}
TCatalogFieldPath.dataClass = CUnit;
class CUnitHero extends CUnit.Ex({
    AttributePointsInfoArray: [SAttributePointsInfo],
    LearnInfoArray: { index: EAbilLearnCmd, value: SAbilLearnInfo },
    MainAttribute: CBehaviorLink,
    MainAttributeDamageBonus: { index: EDamageKind, value: Real },
    TierRequirements: [CRequirementLink]
}) {
}
class CUpgrade extends CClass.Ex({
    Flags: FUpgrade,
    Name: CStringLink,
    InfoTooltipPriority: UInt32,
    WebPriority: UInt32,
    Icon: CImageLink,
    Alert: CAlertLink,
    Race: CRaceLink,
    ScoreAmount: UInt32,
    ScoreCount: EScoreValue,
    ScoreValue: EScoreValue,
    ScoreResult: CScoreResultLink,
    EffectArray: [SUpgradeEffect],
    EffectArrayTemplate: [SUpgradeEffectTemplate],
    UnitAllowed: [CUnitLink],
    UnitDisallowed: [CUnitLink],
    EditorCategories: TEditorCategories,
    TechAliasArray: [TTechAlias],
    AffectedUnitArray: [CUnitLink],
    MaxLevel: UInt8,
    LeaderAlias: CUpgradeLink,
    LeaderPriority: UInt32,
    LeaderLevel: UInt32,
    DataCollection: CDataCollectionLink,
    EnumRequiredUserFlags: FUnitUser,
    EnumExcludedUserFlags: FUnitUser,
    LevelButton: [CButtonLink],
    LevelRequirements: [CRequirementLink],
    BonusResourcePerLevel: { index: EResourceType, value: Int32 },
    BonusTimePerLevel: CGameTime
}) {
    static namespace;
}
class CUser extends CClass.Ex({
    Fields: [SUserField],
    Instances: [SUserInstance]
}) {
    static namespace;
}
class CValidator extends CClass.Ex({
    IgnoreWhileChanneling: UInt8,
    ResultFailed: CCmdResult
}) {
    static namespace;
}
class CValidatorCombine extends CValidator.Ex({
    Type: EValidateCombine,
    CombineArray: [CValidatorLink],
    Negate: Bit
}) {
}
class CValidatorCondition extends CValidator.Ex({
    IfArray: [SValidatorCondition],
    Else: CValidatorLink
}) {
}
class CValidatorFunction extends CValidator.Ex({
    Line: [SValidatorFunction],
    ResultFallback: CCmdResult
}) {
}
class CValidatorEffect extends CValidator.Ex({
    WhichEffect: CEffectLink,
    ResultNoEffect: CCmdResult
}) {
}
class CValidatorEffectCompare extends CValidator.Ex({
    WhichEffect: CEffectLink,
    ResultNoEffect: CCmdResult,
    OtherEffect: CEffectLink,
    Compare: EValueCompare
}) {
}
class CValidatorEffectCompareDodged extends CValidator.Ex({
    WhichEffect: CEffectLink,
    ResultNoEffect: CCmdResult,
    OtherEffect: CEffectLink,
    Compare: EValueCompare,
    Value: UInt32
}) {
}
class CValidatorEffectCompareEvaded extends CValidator.Ex({
    WhichEffect: CEffectLink,
    ResultNoEffect: CCmdResult,
    OtherEffect: CEffectLink,
    Compare: EValueCompare,
    Value: UInt32
}) {
}
class CValidatorEffectTreeUserData extends CValidator.Ex({
    CheckExistence: Bit,
    ResultNoKey: CCmdResult,
    Compare: EValueCompare,
    Key: CIdentifier,
    Value: SAccumulatedFixed,
    BehaviorScope: SEffectWhichBehavior
}) {
}
class CValidatorGameCompareTimeEvent extends CValidator.Ex({
    Compare: EValueCompare,
    TimeEvent: EGameTimeEvent
}) {
}
class CValidatorGameCompareTimeOfDay extends CValidator.Ex({
    Compare: EValueCompare,
    Value: CTimeOfDay
}) {
}
class CValidatorGameCompareTerrain extends CValidator.Ex({
    Compare: EValueCompare,
    Value: CTerrainLink
}) {
}
class CValidatorGameCommanderActive extends CValidator.Ex({
    Commander: CCommanderLink
}) {
}
class CValidatorLocation extends CValidator.Ex({
    WhichLocation: SEffectWhichLocation
}) {
}
class CValidatorLocationCompareCliffLevel extends CValidatorLocation.Ex({
    OtherLocation: SEffectWhichLocation,
    Compare: EValueCompare,
    Value: TCliffLevel
}) {
}
class CValidatorLocationComparePower extends CValidatorLocation.Ex({
    FromUnit: SEffectWhichUnit,
    WhichPlayer: SEffectWhichPlayer,
    PowerLink: TPowerLink,
    PowerSource: [CBehaviorLink],
    Compare: EValueCompare,
    Value: TPowerLevel
}) {
}
class CValidatorLocationCompareRange extends CValidatorLocation.Ex({
    Compare: EValueCompare,
    Range: Real,
    Pathing: Bit,
    Value: SEffectWhichLocation
}) {
}
class CValidatorLocationArc extends CValidatorLocation.Ex({
    OtherLocation: SEffectWhichLocation,
    Find: Bit,
    Arc: CFangleArc,
    Value: SEffectWhichLocation
}) {
}
class CValidatorLocationCreep extends CValidatorLocation.Ex({
    WhichPlayer: SEffectWhichPlayer,
    Find: Bit,
    RadiusBonus: Real
}) {
}
class CValidatorLocationCrossChasm extends CValidatorLocation.Ex({
    OtherLocation: SEffectWhichLocation,
    Find: Bit
}) {
}
class CValidatorLocationCrossCliff extends CValidatorLocation.Ex({
    OtherLocation: SEffectWhichLocation,
    Find: Bit,
    CrossRamp: Bit
}) {
}
class CValidatorLocationEnumArea extends CValidatorLocation.Ex({
    AreaArray: [SValidatorEnumArea],
    Compare: EValueCompare,
    Count: UInt32,
    SearchFlags: FSearchFlags,
    LaunchLocation: SEffectWhichLocation,
    SearchFilters: CTargetFilters,
    ExcludeArray: [SEffectWhichUnit],
    IncludeArray: [SEffectWhichUnit],
    CachedSearch: CIdentifier,
    CombinedVital: EUnitVital,
    CombinedVitalCompare: EValueCompare,
    CombinedVitalUnit: SEffectWhichUnit,
    CombinedVitalValue: UInt32
}) {
}
class CValidatorLocationPathable extends CValidatorLocation.Ex({
    Find: Bit,
    Types: FPathingType
}) {
}
class CValidatorLocationInPlayableMapArea extends CValidatorLocation.Ex({
    Find: Bit
}) {
}
class CValidatorLocationPlacement extends CValidatorLocation.Ex({
    FromUnit: SEffectWhichUnit,
    OtherUnit: SEffectWhichUnit,
    Range: Real,
    Unit: CUnitLink
}) {
}
class CValidatorLocationShrub extends CValidatorLocation.Ex({
    WhichPlayer: SEffectWhichPlayer,
    Find: Bit
}) {
}
class CValidatorLocationType extends CValidatorLocation.Ex({
    None: CValidatorLink,
    Point: CValidatorLink,
    Unit: CValidatorLink
}) {
}
class CValidatorLocationVision extends CValidatorLocation.Ex({
    WhichPlayer: SEffectWhichPlayer,
    Find: Bit
}) {
}
class CValidatorPlayer extends CValidator.Ex({
    WhichPlayer: SEffectWhichPlayer,
    OtherPlayer: SEffectWhichPlayer,
    ResultNoPlayer: CCmdResult
}) {
}
class CValidatorPlayerAlliance extends CValidatorPlayer.Ex({
    Find: Bit,
    WithPlayer: SEffectWhichPlayer,
    Value: EAllianceId
}) {
}
class CValidatorPlayerRequirement extends CValidatorPlayer.Ex({
    Find: Bit,
    UnitSelectionNotRequired: Bit,
    Value: CRequirementLink,
    WhichUnit: SEffectWhichUnit
}) {
}
class CValidatorPlayerTalent extends CValidatorPlayer.Ex({
    Find: Bit,
    Value: CTalentLink
}) {
}
class CValidatorPlayerFood extends CValidatorPlayer.Ex({
    AllowCheat: Bit,
    Value: Real,
    TestUnitType: CUnitLink,
    TypeFallbackUnit: SEffectWhichUnit,
    Count: UInt32,
    ResultFoodMax: CCmdResult
}) {
}
class CValidatorPlayerCompare extends CValidatorPlayer.Ex({
    Compare: EValueCompare
}) {
}
class CValidatorPlayerCompareDifficulty extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: TDifficultyLevel
}) {
}
class CValidatorPlayerCompareFoodAvailable extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: Real
}) {
}
class CValidatorPlayerCompareFoodMade extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: Real
}) {
}
class CValidatorPlayerCompareFoodUsed extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: Real
}) {
}
class CValidatorPlayerCompareRace extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: CRaceLink
}) {
}
class CValidatorPlayerCompareResource extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Resource: EResourceType,
    Value: UInt32
}) {
}
class CValidatorPlayerCompareResult extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: EGameResult
}) {
}
class CValidatorPlayerCompareType extends CValidatorPlayer.Ex({
    Compare: EValueCompare,
    Value: EPlayerType
}) {
}
class CValidatorUnit extends CValidator.Ex({
    WhichUnit: SEffectWhichUnit,
    OtherUnit: SEffectWhichUnit,
    ResultNoUnit: CCmdResult
}) {
}
class CValidatorUnitInWeaponRange extends CValidatorUnit.Ex({}) {
}
class CValidatorUnitAI extends CValidatorUnit.Ex({
    Find: Bit,
    Flag: EUnitAIFlag
}) {
}
class CValidatorUnitCombatAI extends CValidatorUnit.Ex({
    Find: Bit
}) {
}
class CValidatorUnitAlliance extends CValidatorUnit.Ex({
    Find: Bit,
    WithPlayer: SEffectWhichPlayer,
    Value: EAllianceId,
    AlliancePlayer: EAlliancePlayer
}) {
}
class CValidatorUnitAbil extends CValidatorUnit.Ex({
    Find: Bit,
    AbilClass: EClassIdCAbil,
    AbilLink: CAbilLink
}) {
}
class CValidatorUnitBehaviorStackAlias extends CValidatorUnit.Ex({
    Find: Bit,
    IgnoreDisabledBehavior: Bit,
    StackAlias: CIdentifier
}) {
}
class CValidatorUnitBehaviorState extends CValidatorUnit.Ex({
    Enabled: Bit,
    BehaviorState: EBehaviorState
}) {
}
class CValidatorUnitState extends CValidatorUnit.Ex({
    Enabled: Bit,
    State: EUnitTestState
}) {
}
class CValidatorUnitDetected extends CValidatorUnit.Ex({
    WhichPlayer: SEffectWhichPlayer,
    Detected: Bit,
    Flags: FValidatorUnitDetected
}) {
}
class CValidatorUnitArmor extends CValidatorUnit.Ex({
    Find: Bit,
    ArmorType: EArmorType
}) {
}
class CValidatorUnitFilters extends CValidatorUnit.Ex({
    Filters: CTargetFilters
}) {
}
class CValidatorUnitFlying extends CValidatorUnit.Ex({
    Find: Bit
}) {
}
class CValidatorUnitInventory extends CValidatorUnit.Ex({
    ResultNoInventory: CCmdResult,
    RequireEnabled: Bit
}) {
}
class CValidatorUnitInventoryIsFull extends CValidatorUnit.Ex({
    ResultNoInventory: CCmdResult,
    RequireEnabled: Bit,
    Find: Bit
}) {
}
class CValidatorUnitInventoryContainsItem extends CValidatorUnit.Ex({
    ResultNoInventory: CCmdResult,
    RequireEnabled: Bit,
    Find: Bit,
    Item: CUnitLink
}) {
}
class CValidatorUnitLastDamagePlayer extends CValidatorUnit.Ex({
    Relationship: EPlayerRelationship
}) {
}
class CValidatorUnitKinetic extends CValidatorUnit.Ex({
    Value: CKineticLink,
    Find: Bit
}) {
}
class CValidatorUnitMissileNullified extends CValidatorUnit.Ex({
    Find: Bit
}) {
}
class CValidatorUnitMover extends CValidatorUnit.Ex({
    Value: CMoverLink,
    Find: Bit
}) {
}
class CValidatorUnitOrder extends CValidatorUnit.Ex({
    AbilLink: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    CmdFlags: FCmd,
    Target: SEffectWhichLocation,
    CheckStateOnly: Bit
}) {
}
class CValidatorUnitOrderQueue extends CValidatorUnit.Ex({
    AbilLink: CAbilLink,
    AbilClass: EClassIdCAbil,
    AbilTechAlias: TTechAlias,
    AbilCmdIndex: TAbilCmdIndex,
    Find: Bit,
    Queued: Bit,
    Target: SEffectWhichLocation,
    Item: CItemLink
}) {
}
class CValidatorUnitOrderTargetPathable extends CValidatorUnit.Ex({
    AbilLink: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    Find: Bit,
    MaxDistance: Real
}) {
}
class CValidatorUnitOrderTargetType extends CValidatorUnit.Ex({
    AbilLink: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    Find: Bit,
    Type: EEffectLocationType
}) {
}
class CValidatorUnitPathable extends CValidatorUnit.Ex({
    WhichLocation: SEffectWhichLocation,
    Find: Bit,
    Range: Real,
    MaxDistance: Real
}) {
}
class CValidatorUnitPathing extends CValidatorUnit.Ex({
    Find: Bit
}) {
}
class CValidatorUnitScanning extends CValidatorUnit.Ex({
    Find: Bit
}) {
}
class CValidatorUnitType extends CValidatorUnit.Ex({
    Value: CUnitLink,
    Find: Bit,
    Type: EUnitType
}) {
}
class CValidatorUnitWeaponAnimating extends CValidatorUnit.Ex({
    Weapon: CWeaponLink,
    Find: Bit
}) {
}
class CValidatorUnitWeaponFiring extends CValidatorUnit.Ex({
    Weapon: CWeaponLink,
    Find: Bit
}) {
}
class CValidatorUnitWeaponPlane extends CValidatorUnit.Ex({
    Find: Bit,
    Plane: EPlane
}) {
}
class CValidatorUnitTestWeaponType extends CValidatorUnit.Ex({
    Find: Bit,
    WeaponType: EWeaponType,
    RequireActivated: Bit,
    RequireEnabled: Bit
}) {
}
class CValidatorUnitCompare extends CValidatorUnit.Ex({
    Compare: EValueCompare
}) {
}
class CValidatorUnitCompareAIAreaEvalRatio extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Radius: Real,
    Value: Real
}) {
}
class CValidatorUnitCompareAbilLevel extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    AbilLink: CAbilLink,
    Value: UInt32
}) {
}
class CValidatorUnitCompareAbilSkillPoint extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    AbilLink: CAbilLink,
    CountType: ESkillPoint,
    Value: Int32
}) {
}
class CValidatorUnitCompareAbilStage extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    AbilityStage: EAbilEffectStage,
    Ability: CAbilLink
}) {
}
class CValidatorUnitCompareAttackPriority extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Attacker: SEffectWhichUnit,
    AttackerAlternateType: CUnitLink,
    Flags: FValidatorUnitCompareAttackPriority,
    Value: TAttackTargetPriority
}) {
}
class CValidatorUnitCompareBehaviorCount extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: SAccumulatedUInt32,
    Behavior: CBehaviorLink,
    Categories: FBehaviorCategory,
    BehaviorAlignment: EEffectRemoveBehaviorAlignment,
    Heroic: EBehaviorHeroicState,
    ExcludeOriginPlayer: SEffectWhichPlayer,
    ExcludeCasterUnit: SEffectWhichUnit,
    RequireOriginPlayer: SEffectWhichPlayer,
    RequireCasterUnit: SEffectWhichUnit
}) {
}
class CValidatorUnitCompareCargo extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Type: ECargoSpace,
    Value: UInt8
}) {
}
class CValidatorUnitCompareChargeUsed extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    ChargeLink: TChargeLink,
    Location: EChargeLocation,
    Ability: CAbilLink,
    Behavior: CBehaviorLink,
    Value: Real
}) {
}
class CValidatorUnitCompareCooldown extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    CooldownLink: TCooldownLink,
    Location: ECooldownLocation,
    Ability: CAbilLink,
    Behavior: CBehaviorLink,
    Value: Real
}) {
}
class CValidatorUnitCompareDamageDealtTime extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: CGameTime
}) {
}
class CValidatorUnitCompareDamageTakenTime extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: CGameTime
}) {
}
class CValidatorUnitCompareDeath extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: EDeathType
}) {
}
class CValidatorUnitCompareDetectRange extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: Real,
    Radar: Bit
}) {
}
class CValidatorUnitCompareField extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Field: TCatalogFieldPath,
    Value: CIdentifier
}) {
}
class CValidatorUnitCompareKillCount extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt16
}) {
}
class CValidatorUnitCompareMarkerCount extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32
}) {
}
class CValidatorUnitCompareMoverPhase extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32
}) {
}
class CValidatorUnitCompareOrderCount extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    AbilLink: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    Value: UInt32
}) {
}
class CValidatorUnitCompareOrderTargetRange extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    AbilLink: CAbilLink,
    AbilCmdIndex: TAbilCmdIndex,
    Value: Real,
    Pathing: Bit
}) {
}
class CValidatorUnitComparePowerSourceLevel extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    Behavior: CBehaviorLink
}) {
}
class CValidatorUnitComparePowerUserLevel extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    Behavior: CBehaviorLink
}) {
}
class CValidatorUnitCompareRallyPointCount extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    AbilLink: CAbilLink,
    Point: UInt32
}) {
}
class CValidatorUnitCompareResourceContents extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    Behavior: CBehaviorLink
}) {
}
class CValidatorUnitCompareResourceHarvesters extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    Active: Bit,
    Queued: Bit,
    Behavior: CBehaviorLink
}) {
}
class CValidatorUnitCompareSpeed extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: CGameSpeed
}) {
}
class CValidatorUnitCompareVeterancyLevel extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    Behavior: CBehaviorLink,
    ResultMaxLevel: CCmdResult
}) {
}
class CValidatorUnitCompareVital extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Type: EVitalType,
    Value: Real,
    Vital: EUnitVital
}) {
}
class CValidatorUnitCompareVitality extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    Type: EVitalType,
    Value: Real
}) {
}
class CValidatorUnitCompareHeight extends CValidatorUnit.Ex({
    Compare: EValueCompare,
    CasterAdd: Real,
    TargetAdd: Real,
    CasterHeight: Bit,
    CasterGroundHeight: Bit,
    CasterZ: Bit,
    TargetHeight: Bit,
    TargetGroundHeight: Bit,
    TargetZ: Bit
}) {
}
class CValidatorCompareTrackedUnitsCount extends CValidator.Ex({
    Compare: EValueCompare,
    Value: UInt32,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    TrackedUnitValidatorArray: [CValidatorLink],
    TrackedUnitFilters: CTargetFilters
}) {
}
class CValidatorIsUnitTracked extends CValidator.Ex({
    Find: Bit,
    BehaviorLink: CBehaviorLink,
    TrackerUnit: SEffectWhichUnit,
    TrackedUnit: SEffectWhichUnit
}) {
}
class CVoiceOver extends CClass.Ex({
    Character: CCharacterLink,
    Skins: [SVoiceOverSkin],
    Groups: [SVoiceOverGroup],
    Lines: [SVoiceOverLine]
}) {
    static namespace;
}
class CVoicePack extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    TypeName: CStringLink,
    Description: CStringLink,
    Icon: CImageLink,
    ProductId: TBattleProductId,
    UnlockedRewardArray: [CRewardLink],
    ExampleLineArray: [SVoicePackExampleLine],
    ReleaseDate: SProductReleaseDate,
    ParentBundle: CBundleLink,
    LocaleRestriction: CFourCC,
    IsPurchaseHidden: Bit,
    ImageTexture: CImageLink,
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CWarChest extends CClass.Ex({
    Default: Bit,
    Name: CStringLink,
    ShortName: CStringLink,
    StoreName: CStringLink,
    HyperlinkId: TProductHyperlinkId,
    ProductId: TBattleProductId,
    ReleaseDate: SProductReleaseDate,
    SeasonId: CStringLink,
    IsBundle: Bit,
    CelebrationString: CIdentifier,
    StoreTypeName: CStringLink
}) {
    static namespace;
}
class CWarChestSeason extends CClass.Ex({
    Name: CStringLink,
    ESportsSeason: CStringLink,
    ESportsName: CStringLink,
    ESportsLocation: CStringLink,
    ESportsDate: CStringLink,
    ESportsShowPlayers: Bit,
    HowItWorks1: CStringLink,
    HowItWorks2: CStringLink,
    HowItWorks3: CStringLink,
    HowItWorks4: CStringLink,
    LearnMoreTitle1: CStringLink,
    LearnMoreTitle2: CStringLink,
    LearnMoreTitle3: CStringLink,
    LearnMoreDescription1: CStringLink,
    LearnMoreDescription2: CStringLink,
    LearnMoreDescription3: CStringLink,
    LearnMoreImage1: CImageLink,
    LearnMoreImage2: CImageLink,
    LearnMoreImage3: CImageLink,
    PurchaseTitle: CStringLink,
    PurchaseDescription: CStringLink,
    PurchaseWarning: CStringLink,
    PurchaseImage: CImageLink
}) {
    static namespace;
}
class CWater extends CClass.Ex({
    TextureKey: CImageLink,
    TilingFreq: C4Vector,
    ScrollVectors: C4Vector,
    FramesPerSec: Real32,
    State: [SWaterStateDesc],
    CausticsFPS: Real32,
    CausticsTilingFreq: C2Vector,
    ReceiveShadows: Bit,
    IsLava: Bit,
    Density: Real32,
    Drag: Real32,
    AngularDamping: Real32,
    MaxLinearVelocity: Real32,
    BeachShoreline: CModelLink,
    CliffShoreline: CModelLink,
    LavaModel: CModelLink,
    Doodads: [SWaterDoodad],
    Sound: CSoundLink,
    ReflectionCubeMap: CImageLink
}) {
    static namespace;
}
class CWeapon extends CClass.Ex({
    Name: CStringLink,
    EditorCategories: TEditorCategories,
    InfoTooltipPriority: UInt32,
    Tip: CStringLink,
    Options: FWeaponOptions,
    Icon: CImageLink,
    DisplayEffect: CEffectLink,
    DisplayAttackCount: UInt32,
    DisplayName: CStringLink,
    Level: UInt32,
    TargetFilters: CTargetFilters,
    ChaseFilters: CTargetFilters,
    SupportedFilters: CTargetFilters,
    AcquireFilters: CTargetFilters,
    AcquireCallForHelpFilters: CTargetFilters,
    AcquireProvokeFilters: CTargetFilters,
    AcquireScanFilters: CTargetFilters,
    AcquireTargetSorts: STargetSorts,
    AcquirePrioritization: EWeaponPrioritization,
    AcquireCliffLevelRange: CfRange,
    MinScanRange: Real,
    Range: Real,
    RangeSlop: Real,
    RangeDisplayFlags: FEquipmentDisplay,
    MinimumRange: Real,
    TeleportResetRange: Real,
    Arc: CFangleArc,
    ArcSlop: CFangleArc,
    Marker: SMarker,
    Cost: SCost,
    Period: CGameTime,
    PeriodDisplayFlags: FEquipmentDisplay,
    RateMultiplier: Real,
    AttackType: EAttackType,
    DamagePoint: CGameTime,
    PreswingBeforeAttack: CGameTime,
    PreswingBetweenAttacks: CGameTime,
    Backswing: CGameTime,
    Effect: CEffectLink,
    PreEffect: CEffectLink,
    CriticalEffect: CEffectLink,
    PreEffectBehavior: SEffectBehavior,
    PostEffectBehavior: SEffectBehavior,
    CriticalChance: Real,
    CursorRangeMode: ECursorRangeMode
}) {
    static namespace;
}
class CWeaponLegacy extends CWeapon.Ex({
    LegacyOptions: FWeaponLegacyOptions,
    AllowedMovement: EWeaponLegacyMovement,
    PathingAmmoUnit: CUnitLink,
    ReloadDuration: CGameTime,
    RandomDelayMin: CGameTime,
    RandomDelayMax: CGameTime,
    UninterruptibleDelay: CGameTime,
    UninterruptibleDuration: CGameTime
}) {
}
class CWeaponStrafe extends CWeapon.Ex({
    LoiterInnerRadius: Real,
    LoiterRadius: Real
}) {
}
export const DATA_CLASS_SCHEMA = {
    CAbil, CAbilProgress, CAbilEffect, CAbilQueueable, CAbilRedirect, CAbilArmMagazine, CAbilAttack, CAbilAugment, CAbilAttackModifier, CAbilBattery, CAbilBeacon, CAbilBehavior, CAbilBuild, CAbilBuildable, CAbilEffectInstant, CAbilEffectTarget, CAbilHarvest, CAbilInteract, CAbilInventory, CAbilLearn, CAbilMerge, CAbilMergeable, CAbilMorph, CAbilMorphPlacement, CAbilMove, CAbilPawn, CAbilQueue, CAbilRally, CAbilRedirectInstant, CAbilRedirectTarget, CAbilResearch, CAbilRevive, CAbilSpecialize, CAbilStop, CAbilTrain, CAbilTransport, CAbilWarpable, CAbilWarpTrain,
    CAccumulator, CAccumulatorConstant, CAccumulatorVitals, CAccumulatorDistance, CAccumulatorBehavior, CAccumulatorAttributePoints, CAccumulatorTrackedUnitCount, CAccumulatorLevel, CAccumulatorAbilLevel, CAccumulatorUnitLevel, CAccumulatorVeterancyLevel, CAccumulatorCargo, CAccumulatorEffectAmount, CAccumulatorUserData, CAccumulatorUnitCustomValue, CAccumulatorSwitch, CAccumulatorArithmetic, CAccumulatorPlayerScoreValue,
    CAchievement,
    CAchievementTerm, CAchievementTermAbil, CAchievementTermAbilInteract, CAchievementTermAbilLoad, CAchievementTermAbilUse, CAchievementTermAchievement, CAchievementTermBehavior, CAchievementTermBehaviorAbsorbed, CAchievementTermBehaviorCount, CAchievementTermBehaviorElapsed, CAchievementTermBehaviorState, CAchievementTermCombine, CAchievementTermEffect, CAchievementTermEffectAbsorbed, CAchievementTermEffectDamaged, CAchievementTermEffectDodged, CAchievementTermEffectHealed, CAchievementTermEffectKilled, CAchievementTermEffectUse, CAchievementTermGeneric, CAchievementTermReplay, CAchievementTermScoreValue, CAchievementTermTime, CAchievementTermUnit, CAchievementTermUnitBirth, CAchievementTermUnitDeath, CAchievementTermUnitKills, CAchievementTermUnitRegen, CAchievementTermUnitSupplyLoss,
    CActor, CActorSupport, CActorBase, CActorBearings, CActorCamera, CActorModel, CActorModelMaterial, CActorQuad, CActorForce, CActorForceLineSegment, CActorBeam, CActorRange, CActorSound, CActorSplat, CActorAction, CActorActionOverride, CActorArc, CActorBeamSimple, CActorBeamStandard, CActorBlob, CActorCameraModel, CActorCreep, CActorCutscene, CActorDoodad, CActorDoodadPreserver, CActorFoliageFXSpawner, CActorEditorCamera, CActorEditorPoint, CActorEventMacro, CActorEventMacroRunnable, CActorForceBox, CActorForceConeRoundedEnd, CActorForceCylinder, CActorForceSphere, CActorGlobalConfig, CActorOverrides, CActorLight, CActorLightOmni, CActorLightSpot, CActorLightModel, CActorLightOmniModel, CActorLightSpotModel, CActorLookAt, CActorList, CActorListPerPlayer, CActorPortrait, CActorPower, CActorProgress, CActorPropertyCurveSet, CActorQueryResponse, CActorRegion, CActorRegionArc, CActorRegionCircle, CActorRegionCombine, CActorRegionGame, CActorRegionPolygon, CActorRegionQuad, CActorRegionWater, CActorScene, CActorSelection, CActorSetQueried, CActorShadow, CActorShield, CActorShieldImpact, CActorSimple, CActorSite, CActorSiteBillboard, CActorSiteMover, CActorSiteOrbiter, CActorSiteRocker, CActorSiteOp, CActorSiteOpBase, CActorSiteOp2DRotation, CActorSiteOpAction, CActorSiteOpAttach, CActorSiteOpAttachVolume, CActorSiteOpBanker, CActorSiteOpBankerUnit, CActorSiteOpBasic, CActorSiteOpGameCameraFollow, CActorSiteOpDeathMotion, CActorSiteOpDeltaSum, CActorSiteOpEffect, CActorSiteOpForward, CActorSiteOpHeight, CActorSiteOpHigherOfTerrainAndWater, CActorSiteOpHostBearings, CActorSiteOpHostedOffset, CActorSiteOpIncoming, CActorSiteOpLocalOffset, CActorSiteOpOrientAttachPointTo, CActorSiteOpPatch, CActorSiteOpPersistentOffset, CActorSiteOpOrbiter, CActorSiteOpPhysicsImpact, CActorSiteOpRandomPointInCircle, CActorSiteOpRandomPointInCrossbar, CActorSiteOpRandomPointInSphere, CActorSiteOpRotationExplicit, CActorSiteOpRotationRandom, CActorSiteOpRotationVariancer, CActorSiteOpRotator, CActorSiteOpRotationSmooth, CActorSiteOpSelectionOffset, CActorSiteOpSerpentHead, CActorSiteOpSerpentSegment, CActorSiteOpShadow, CActorSiteOpTether, CActorSiteOpTipability, CActorSiteOpTilter, CActorSiteOpUp, CActorSiteOpZ, CActorSiteOpCursor, CActorSiteOpYawLimiter, CActorSiteOpPitchLimiter, CActorSnapshot, CActorStateMonitor, CActorSquib, CActorBatch, CActorTerrain, CActorTerrainDeformer, CActorText, CActorTurret, CActorUnit, CActorUnitRing, CActorMissile, CActorMinimap,
    CAlert,
    CArmyCategory,
    CArmyUnit,
    CArmyUpgrade,
    CArtifact,
    CArtifactSlot,
    CAttachMethod, CAttachMethodArcTest, CAttachMethodBestMatch, CAttachMethodFilter, CAttachMethodAttachType, CAttachMethodIncoming, CAttachMethodLeastDeflection, CAttachMethodNodeOccupancy, CAttachMethodNodeOccupancy2, CAttachMethodNumericField, CAttachMethodPattern, CAttachMethodPortAllocator, CAttachMethodProximity, CAttachMethodRandom, CAttachMethodReduction, CAttachMethodVolumesRequery, CAttachMethodVolumesTargets, CAttachMethodVolumesWeightedPick,
    CBankCondition, CBankConditionCompare, CBankConditionCompareValueCount, CBankConditionCompareValueInteger, CBankConditionCompareValueString, CBankConditionCompareValueSum, CBankConditionCombine, CBankConditionCurrentMap,
    CBeam, CBeamSync, CBeamSyncSweeper, CBeamAsync, CBeamAsyncLinear, CBeamAsyncShadow,
    CBehavior, CBehaviorAttackModifier, CBehaviorAttribute, CBehaviorUnitTracker, CBehaviorBuff, CBehaviorClickResponse, CBehaviorConjoined, CBehaviorCreepSource, CBehaviorJump, CBehaviorPowerSource, CBehaviorPowerUser, CBehaviorResource, CBehaviorReveal, CBehaviorSpawn, CBehaviorVeterancy, CBehaviorWander,
    CBoost,
    CBundle,
    CButton,
    CCamera,
    CCampaign,
    CCharacter,
    CCliff,
    CCliffMesh,
    CColorStyle,
    CCommander,
    CConfig,
    CConsoleSkin,
    CConversation,
    CConversationState,
    CCursor,
    CDataCollection, CDataCollectionUnit, CDataCollectionUpgrade, CDataCollectionAbil,
    CDataCollectionPattern,
    CDecalPack,
    CDSP, CDSPChorus, CDSPCompressor, CDSPCustomCompressor, CDSPDistortion, CDSPEcho, CDSPFlange, CDSPHighPass, CDSPLimiter, CDSPLowPass, CDSPLowPassSimple, CDSPNormalize, CDSPOscillator, CDSPParamEQ, CDSPPitchShift, CDSPReverb,
    CEffect, CEffectResponse, CEffectAddTrackedUnit, CEffectClearTrackedUnits, CEffectAddTrackedUnits, CEffectRemoveTrackedUnit, CEffectApplyBehavior, CEffectApplyForce, CEffectApplyKinetic, CEffectCancelOrder, CEffectCreateHealer, CEffectCreep, CEffectCreatePersistent, CEffectRandomPointInCircle, CEffectCreateUnit, CEffectDamage, CEffectDestroyHealer, CEffectDestroyPersistent, CEffectEnumArea, CEffectEnumTrackedUnits, CEffectEnumMagazine, CEffectEnumTransport, CEffectEnumInventory, CEffectLastTarget, CEffectLoadContainer, CEffectIssueOrder, CEffectLaunchMissile, CEffectModifyPlayer, CEffectModifyUnit, CEffectMorph, CEffectRedirectMissile, CEffectReleaseMagazine, CEffectRemoveBehavior, CEffectRemoveKinetic, CEffectReturnMagazine, CEffectSet, CEffectSwitch, CEffectTeleport, CEffectTransferBehavior, CEffectUseCalldown, CEffectUseMagazine, CEffectUserData,
    CEmoticon,
    CEmoticonPack,
    CFootprint,
    CFoW,
    CGame,
    CGameUI,
    CHerd,
    CHerdNode,
    CHero,
    CHeroAbil,
    CHeroStat,
    CItem, CItemAbil, CItemAbilPowerUp, CItemEffect, CItemEffectInstant, CItemEffectTarget,
    CItemClass,
    CItemContainer,
    CKinetic, CKineticFollow, CKineticRotate, CKineticSequence, CKineticSet, CKineticTranslate, CKineticDistance,
    CLensFlareSet,
    CLight,
    CLocation,
    CLoot, CLootSpawn, CLootEffect, CLootItem, CLootSet, CLootUnit,
    CMap,
    CModel, CModelFoliage,
    CMount,
    CMover, CMoverAvoid, CMoverFlock, CMoverMissile, CMoverNull,
    CObjective,
    CPhysicsMaterial,
    CPing,
    CPlayerResponse, CPlayerResponseUnit, CPlayerResponseUnitDamage, CPlayerResponseUnitDeath, CPlayerResponseUnitBirth,
    CPortraitPack,
    CPreload, CPreloadAsset, CPreloadScene, CPreloadActor, CPreloadConversation, CPreloadModel, CPreloadSound, CPreloadUnit,
    CPremiumMap,
    CRace,
    CRaceBannerPack,
    CRequirement,
    CRequirementNode, CRequirementGT, CRequirementLT, CRequirementGTE, CRequirementLTE, CRequirementEq, CRequirementNE, CRequirementAnd, CRequirementOr, CRequirementXor, CRequirementNot, CRequirementOdd, CRequirementDiv, CRequirementMod, CRequirementMul, CRequirementSum, CRequirementConst, CRequirementAllowAbil, CRequirementAllowBehavior, CRequirementAllowUnit, CRequirementAllowUpgrade, CRequirementCountAbil, CRequirementCountBehavior, CRequirementCountEffect, CRequirementCountUnit, CRequirementCountUpgrade,
    CReverb,
    CReward, CRewardDecal, CRewardIcon, CRewardModel, CRewardPortrait, CRewardBadge, CRewardPoints, CRewardTrophy, CRewardEmoticon, CRewardVoicePack, CRewardPortraitInGame, CRewardConsoleSkin, CRewardSpray, CRewardSprayUseDecal, CRewardRaceBanner, CRewardStim,
    CScoreResult, CScoreResultRoot, CScoreResultScore, CScoreResultGraph, CScoreResultPane, CScoreResultBuildOrder, CScoreResultCallouts, CScoreResultExperience, CScoreResultPerformance,
    CScoreValue, CScoreValueCustom, CScoreValueStandard, CScoreValueConstant, CScoreValueCombine,
    CShape, CShapeArc, CShapeQuad,
    CSkin,
    CSkinPack,
    CSound,
    CSoundExclusivity,
    CSoundMixSnapshot,
    CSoundtrack,
    CSpray,
    CSprayPack,
    CStimPack,
    CTacCooldown,
    CTactical, CTacticalOrder, CTacticalSet,
    CTalent,
    CTalentProfile,
    CTargetFind, CTargetFindBestPoint, CTargetFindWorkerRallyPoint, CTargetFindRallyPoint, CTargetFindEnumArea, CTargetFindEffect, CTargetFindLastAttacker, CTargetFindOffset, CTargetFindOrder, CTargetFindSet,
    CTargetSort, CTargetSortAlliance, CTargetSortAngle, CTargetSortBehaviorCount, CTargetSortBehaviorDuration, CTargetSortChargeCount, CTargetSortChargeRegen, CTargetSortCooldown, CTargetSortDistance, CTargetSortField, CTargetSortInterruptible, CTargetSortMarker, CTargetSortPowerSourceLevel, CTargetSortPowerUserLevel, CTargetSortPriority, CTargetSortRandom, CTargetSortValidator, CTargetSortVeterancy, CTargetSortVital, CTargetSortVitalFraction,
    CTerrain,
    CTerrainObject,
    CCliffDoodad,
    CTerrainTex,
    CTexture,
    CTextureSheet,
    CTile,
    CTrophy,
    CTurret,
    CUnit, CUnitHero,
    CUpgrade,
    CUser,
    CValidator, CValidatorCombine, CValidatorCondition, CValidatorFunction, CValidatorEffect, CValidatorEffectCompare, CValidatorEffectCompareDodged, CValidatorEffectCompareEvaded, CValidatorEffectTreeUserData, CValidatorGameCompareTimeEvent, CValidatorGameCompareTimeOfDay, CValidatorGameCompareTerrain, CValidatorGameCommanderActive, CValidatorLocation, CValidatorLocationCompareCliffLevel, CValidatorLocationComparePower, CValidatorLocationCompareRange, CValidatorLocationArc, CValidatorLocationCreep, CValidatorLocationCrossChasm, CValidatorLocationCrossCliff, CValidatorLocationEnumArea, CValidatorLocationPathable, CValidatorLocationInPlayableMapArea, CValidatorLocationPlacement, CValidatorLocationShrub, CValidatorLocationType, CValidatorLocationVision, CValidatorPlayer, CValidatorPlayerAlliance, CValidatorPlayerRequirement, CValidatorPlayerTalent, CValidatorPlayerFood, CValidatorPlayerCompare, CValidatorPlayerCompareDifficulty, CValidatorPlayerCompareFoodAvailable, CValidatorPlayerCompareFoodMade, CValidatorPlayerCompareFoodUsed, CValidatorPlayerCompareRace, CValidatorPlayerCompareResource, CValidatorPlayerCompareResult, CValidatorPlayerCompareType, CValidatorUnit, CValidatorUnitInWeaponRange, CValidatorUnitAI, CValidatorUnitCombatAI, CValidatorUnitAlliance, CValidatorUnitAbil, CValidatorUnitBehaviorStackAlias, CValidatorUnitBehaviorState, CValidatorUnitState, CValidatorUnitDetected, CValidatorUnitArmor, CValidatorUnitFilters, CValidatorUnitFlying, CValidatorUnitInventory, CValidatorUnitInventoryIsFull, CValidatorUnitInventoryContainsItem, CValidatorUnitLastDamagePlayer, CValidatorUnitKinetic, CValidatorUnitMissileNullified, CValidatorUnitMover, CValidatorUnitOrder, CValidatorUnitOrderQueue, CValidatorUnitOrderTargetPathable, CValidatorUnitOrderTargetType, CValidatorUnitPathable, CValidatorUnitPathing, CValidatorUnitScanning, CValidatorUnitType, CValidatorUnitWeaponAnimating, CValidatorUnitWeaponFiring, CValidatorUnitWeaponPlane, CValidatorUnitTestWeaponType, CValidatorUnitCompare, CValidatorUnitCompareAIAreaEvalRatio, CValidatorUnitCompareAbilLevel, CValidatorUnitCompareAbilSkillPoint, CValidatorUnitCompareAbilStage, CValidatorUnitCompareAttackPriority, CValidatorUnitCompareBehaviorCount, CValidatorUnitCompareCargo, CValidatorUnitCompareChargeUsed, CValidatorUnitCompareCooldown, CValidatorUnitCompareDamageDealtTime, CValidatorUnitCompareDamageTakenTime, CValidatorUnitCompareDeath, CValidatorUnitCompareDetectRange, CValidatorUnitCompareField, CValidatorUnitCompareKillCount, CValidatorUnitCompareMarkerCount, CValidatorUnitCompareMoverPhase, CValidatorUnitCompareOrderCount, CValidatorUnitCompareOrderTargetRange, CValidatorUnitComparePowerSourceLevel, CValidatorUnitComparePowerUserLevel, CValidatorUnitCompareRallyPointCount, CValidatorUnitCompareResourceContents, CValidatorUnitCompareResourceHarvesters, CValidatorUnitCompareSpeed, CValidatorUnitCompareVeterancyLevel, CValidatorUnitCompareVital, CValidatorUnitCompareVitality, CValidatorUnitCompareHeight, CValidatorCompareTrackedUnitsCount, CValidatorIsUnitTracked,
    CVoiceOver,
    CVoicePack,
    CWarChest,
    CWarChestSeason,
    CWater,
    CWeapon, CWeaponLegacy, CWeaponStrafe
};
// #endregion
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// #region Examples
// let xxx = {} as CAbilArmMagazine
// xxx.Name
// let x = new CUnit({Name: "s",A: 2})
// x.CardLayouts
// x.AbilArray
// x.AbilArray2
//   keepAsString = true
//   writeAsString=  true
//   toString(value: string[]): string { return value.join(',')}
//   fromString(svalue: string,){
//     let value = svalue.split(','), [ns] = value
//     // let schema = {Catalog: EGameCatalog, Link: `CData${ns}Link`,Property: CString,} //todo property is not String. AttributeBonus[Armored] - property might containt [] .
//     Object.defineProperty(value,'_schema',{enumerable: false,  value: CTuple,[EGameCatalog,CData${ns}Link,AttributePath] })
//     return value
//   }
// },
// CTargetFilters: class, CTargetFilters extends CFlags {
//   group = false
//   listRaw = ETargetFilter
//   writeAsString = true
// },
// CActorTermCondition: class, CActorTermCondition extends Instruction {
//   fromString(svalue: string,): string[] {
//     let value = svalue.trim().split(' ').filter(Boolean)
//     const termTag = value[0] as keyof typeof ActorTermConditionsTypes
//     let extraTypes = ActorTermConditionsTypes[termTag] || [],
//     if(extraTypes.length === 0) extraTypes = [CString] //fallback type
//     const types = [EActorEventConditionType, ...extraTypes],
//     Object.defineProperty(value,'_schema',{enumerable: false,  value: `CTuple[${types.join(',')}]`})
//     return value
//   }
//   toString(value: string[]): string { return value.join(' ') }
// },
// CActorTerm: class, CActorTerm extends Instruction {
//   // fromString(value: string,): string {   return value.trim() }
//   fromString(svalue: string,): string[] {
//     let value = svalue.trim().split('.').filter(Boolean)
//     const termTag = value[0] as keyof typeof ActorTermsTypes
//     let extraTypes = ActorTermsTypes[termTag],
//     if(extraTypes.length === 0) extraTypes = [CString]//fallback type
//     const types = [EActorEventTermType, ...extraTypes],
//     Object.defineProperty(value,'_schema',{enumerable: false,  value: this.schema.getType(`CTuple[${types.join(',')}]`)})
//     return value
//   }
//   toString(value: string[]): string { return value.join('.')}
// },
// CActorTerms: class, CActorTerms extends Instruction  {
//   toString(value: string[]): string {  return value.join(';')}
//   fromString(svalue: string,){
//     let value = svalue.split(';').filter(Boolean)
//     let schema = !value.length || this._isTerm(value[0]) ? 'CTuple[CActorTerm,CActorTermCondition]': 'CTuple[CActorTermCondition]'
//     Object.defineProperty(value,'_schema',{enumerable: false, value: this.schema.getType(schema)})
//     return value
//   }
//   private _isTerm(value:string){
//     let termTag = (value.match(/^!?(\w+)/)?.[1]!) as keyof typeof ActorTermsTypes
//     return !value.includes(' ') && ActorTermsTypes[termTag],
//   }
// },
// CActorTerms: 'CTuple[CActorTermOrCondition,CActorTermCondition](;)'
// CActorTermOrCondition: '',
// TEditorCategories: class, TEditorCategories extends SchemaStructure<ResolveStruct<SEditorCategories>> {
//   writeAsString =  true
//   saveAsString = true
//   fieldsRaw = DATA_STRUCT_SCHEMA_FULL.SEditorCategories
// },
// CConst:  class CActorSiteOps extends SchemaStructure<ResolveStruct<SConst>> {
//   fieldsRaw = DATA_STRUCT_SCHEMA_FULL.SConst
//   makeObject(attributes: Record<string, string>) {
//     let object = super.makeObject(attributes)
//     object.class = Const
//     return object
//   }
// },
// type StringValues<T> = T extends string ? T : never;
// type DATATYPES =
//  | StringValues<keyof typeof E_ClassId>
//  | StringValues<keyof typeof E_StructId> //DATA_CLASS_SCHEMA
//  | StringValues<keyof typeof E_TypeId> //DATA_STRUCT_SCHEMA
//  | keyof typeof LINK_SCHEMA
//  | keyof typeof FILE_TYPES
//  | keyof typeof FLAGS_TYPES
//  | keyof typeof DATA_ENUM_SCHEMA
// const TYPES: Record<string,typeof CData<any>> = {
//   ...FLAGS_TYPES,
//   ...DATA_ENUM_SCHEMA,
//   ...LINK_SCHEMA,
//   ...FILE_TYPES,
//   ...DATA_STRUCT_SCHEMA,
//   ...CATALOG_DATA_TYPES,
//   ...DATA_CLASS_SCHEMA,
// }
// #endregion
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Namespace-grouped schema for the runtime catalog system.
export const DATA_CLASS_SCHEMA_GROUPED = (() => {
    const parentMap = {};
    for (const [name, cls] of Object.entries(DATA_CLASS_SCHEMA)) {
        const parentCls = Object.getPrototypeOf(cls);
        parentMap[name] = (parentCls?.name && parentCls.name !== 'Function') ? parentCls.name : undefined;
    }
    const grouped = {};
    for (const [ns, classNames] of Object.entries(NAMESPACE_CLASS_MAP)) {
        grouped[ns] = {};
        for (const className of classNames) {
            grouped[ns][className] = parentMap[className] ? { parent: parentMap[className] } : {};
        }
    }
    return grouped;
})();
