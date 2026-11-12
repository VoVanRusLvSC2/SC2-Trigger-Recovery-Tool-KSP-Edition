import { CEnum, CWTuple, CDTuple, CCTuple, CSArray, CFlags, CSTuple, CRecord, CWArray, CTuple, TypeFlags, CArray } from "./schema.core.js";
import { EGameCatalog, ETargetFilter, EPitchRoll, EClassId, EAttachmentKey, EAbilityorEffectType, EClimate, EConversationType, EDataFamily, EDataGroup, EDoodadType, EFootprintGroup, ELightGroup, EObjectFamily, EObjectType, ETechType, ETerrainObjectType, EUpgradeType, ETypeId, EOptionPhysics, EValueCompare, EPlayerRelationship, EPhysicsImpact, EActorPhysicsImpactRangeType, EPhysiqsMaterialCompare, EAIUIMode, EBaselines, EAnimBracketExitReason, EAnimName, EEffectUnit, EScope, EFlyerHelper, EGameEvent, EGameSpeed, EStatus, EMovement, EAbilOrderDisplayType, EOverkillType, ETeamId, EStateArray, ESubName, EAbilEvent, EAbilChargeEvent, EAbilCooldownEvent, EAbilMorphEvent, EAbilRallyEvent, EAbilTrainEvent, EAbilTransportEvent, EAnimBracketState, EAnimDone, EBehaviorEvent, EBehaviorStackItemEvent, EBuildCoachHoverEvent, ButtonHoverEvent, EConfirmationEvent, ECursorUpdateEvent, ECutsceneEvent, EEffectEvent, EHerdLevelEvent, EHerdSpeedEvent, EPhysicsImpactEvent, ERegionSubject, ESelection, ESignal, ETurretTargetEvent, EUnitBlipUpdateEvent, EUnitConstructionEvent, EUnitDetectedByViewerEvent, EUnitHeightUpdateEvent, EUnitHighlightLocalEvent, EUnitMovementUpdateEvent, EUnitPointsEvent, EUnitPortraitEvent, EUnitRefundEvent, EUnitRegenEvent, EUnitTauntEvent, EUpgradeEvent, EWeaponCriticalUpdateEvent, EWeaponStartEvent, EWeaponStopEvent, EAgainstCenter, EHostSiteOpsSetHost, TLocaleId } from "./schema.enums.js";
import { CActorLink, CEffectLink, CTextureNameLink, CAbilLink, CUserLink, CErrorLink, CStringLink, CEditorCategoryRaceLink, CTokenLink, CPhysicsMaterialLink, CUnitLink, CActorLabelKey, CModelLink, CRewardLink, CStateLink, CTextureFileAliasLink, CTextureSlotLink, CTimerLink, CValidatorLink, CBehaviorLink, CButtonLink, CHerdLink, CTurretLink, CUpgradeLink, CWeaponLink, CActorCreateKey, CIdentifier, TTriggerLibId, TCooldownLink, TChargeLink, TMarkerLink, TPowerLink, TProductHyperlinkId, THyperlinkId, TGalaxyFunction, TBattleProductId, TConversationItemId, TTechAlias, TBattleLicenseName, TUserFieldId, TUserInstanceId, TConversationStateOpId, TConversationStateIndexId, TConversationStateVariation, TConversationTag, TConversationStateInfoId, TVoiceOverSkinId, TVoiceOverGroupId, CAbilSetId, CTexturePath, CImagePath, CAssetFile, CImageLink, CMovieFile, CMapFile, CModelFile, CCutsceneFile, CFontStyleFile, CLayoutFile, CSoundFile, CAnimsFile, CFacialFile, CSyncModelDataFile, CXMLFile, CFontFile, CConstLink } from "./schema.links.js";
import { CString, CScalar, CLink, CBoolean, CSObject } from "./schema.primitives.js";
import { Int, Real, CDigits0030, CPhysicsMaterialLinks, CSquibTypes, CAnimProps, UInt, UReal, Bit, CActorLinks, CActorSiteOps, Int8, Int16, Int32, UInt8, UInt16, UInt32, Real32, UReal32, CColor, CColorRGB, CColorHDR, TCargoSize, TCargoCapacity, TMarkerCount, TPreemptLevel, TAbilCmdIndex, TCliffLevel, TPowerLevel, TDifficultyLevel, TAIBuild, TPlayerId, TMountCategory, TAttackTargetPriority, TUnitRadius, TAttachPropIndex, TCommanderLevel, C3fVector, C2iVector, CScaleVector, C3Vector, C2Vector, C2fVector, C4Vector, THandicap, TCmdResult, TDifficulty, TSoundWeight, TSoundBalance, CFangleArc, CGameTime, CfRange, CFangle, CGamePoint, CQuad, CRange, CVariatorActorReal32, CEffectOffset, CRect, CfQuad, CVolumeRange, CVariatorActorAngle, CActorAngle, CAnimNameKey, CFacing, CVariatorActorFangle, CFangleRate, CGameRate, CAttachKeys, CiRange, CiQuad, CGameSpeed, CVariatorGameFangle, CVariatorGameFixed, CStyleName, CPitchRange, CVolume, CGameAcceleration, CLabelExpression, CIdSetPlayers, CIdSetTeams, CSubNameKey, CGamePoInt3D, CMissileAcceleration, CMissileSpeed, CPhaseOutro, CThrowBand, CFangleRateMissile, CFangleAccelMissile, CPitch, CString4, CString32, CString50, CString80, Month, Day, Year, CFourCC, CCardId, TFootprintOffsets, TFootprintBorders } from "./schema.types.js";
function CWTupleInstructions(enumclass, instructions) {
    const cs = {};
    for (const i in instructions)
        cs[i] = CWTuple.Ex(enumclass, ...(instructions[i] ?? []));
    return cs;
}
function CDTupleInstructions(enumclass, instructions) {
    const cs = {};
    for (const i in instructions)
        cs[i] = CDTuple.Ex(enumclass, ...(instructions[i] ?? []));
    return cs;
}
// abstract export class CUnion<Types extends CData<any> = CData<any>> extends CData<any> {
//   static types: CData<any>[];
//   static Ex<SubTypes extends CData<any>[]>(...types: SubTypes) {
//     return export class extends this {
//       static types = types;
//       declare value: TypeOf<SubTypes[number]>;
//     } as unknown as {
//       new (...args: any[]): CData<TypeOf<SubTypes[number]>>;
//       types: SubTypes;
//     };
//   }
// }
function pathType(path) {
    return CString;
}
class CAttributePath extends CScalar {
    static dataClass;
    static Ex(dataClass) {
        return class extends this {
            static dataClass = dataClass;
        };
    }
    // static FromClassName(dataClass: CLASSNAME): typeof CAttributePath {
    //   if(!this.ClassNames[dataClass]){
    //     this.ClassNames[dataClass] = CAttributePath.Ex(TYPES[dataClass])
    //   }
    //   return this.ClassNames[dataClass]
    // }
    static ClassNames = {};
}
const IQuery = {
    '::Self': [],
    '::Host': [],
    '::Sender': [],
    '::actor': [CActorLink]
};
export class EQuery extends CEnum.FromArray(Object.keys(IQuery)) {
}
const IQueryInstructions = CDTupleInstructions(EQuery, IQuery);
export class CQuery extends CScalar.Dyn((data) => IQueryInstructions[data.value.split(".")[0]]) {
}
const IActorKey = {
    _Unit: []
};
export class EActorKey extends CEnum.FromArray(Object.keys(IActorKey)) {
}
const IActorKeyInstructions = CWTupleInstructions(EActorKey, IActorKey);
export class CActorKey extends CScalar.Dyn((data) => IActorKeyInstructions[data.value.split(" ")[0]] || CActorLink) {
} //_Unit , Actor
const IDataSoupKey = {
    '::RollingIndex': []
};
export class EDataSoupKey extends CEnum.FromArray(Object.keys(IDataSoupKey)) {
}
const IDataSoupKeyInstructions = CWTupleInstructions(EDataSoupKey, IDataSoupKey);
export class CDataSoupKey extends CScalar.Dyn((data) => IDataSoupKeyInstructions[data.value.split(" ")[0]] || CEffectLink) {
} // ::RollingIndex  // SS_BattlecruiserAttackLaunchMissile
export class CLinkDynamic extends CScalar.Dyn((data) => CLink.FromNamespace(data[0].value)) {
}
export class CAttributeDynamic extends CScalar.Dyn((data, mod) => CAttributePath.Ex(mod.getEntityClass(data[0].value, data[1].value))) {
} //todo ANY!
export class CGameContentCreationData extends CCTuple.Ex(EGameCatalog, CLinkDynamic) {
} // EmoticonPack,LegacyOfTheVoid
export class CDataEntryPath extends CCTuple.Ex(EGameCatalog, CLinkDynamic) {
} // EmoticonPack,LegacyOfTheVoid.   //CActorLink: &CData(Actor)
export class CCatalogReference extends CCTuple.Ex(EGameCatalog, CLinkDynamic, CAttributeDynamic) {
} //Effect,PunisherGrenadesU,AttributeBonus[Armored]
export class CTokenType extends CScalar {
}
export class CTextureNameLinkArray extends CCTuple.Ex(CTextureNameLink) {
}
const ITextureExpression = {
    RequireAll: [CTextureNameLinkArray], // RequireAll diffuse;
    RequireAny: [CTextureNameLinkArray] // RequireAny helmet,backpack
};
export class ETextureExpression extends CEnum.FromArray(Object.keys(ITextureExpression)) {
}
const ITextureExpressionInstructions = CWTupleInstructions(ETextureExpression, ITextureExpression);
export class CTextureExpressionSingle extends CScalar.Dyn((data) => ITextureExpressionInstructions[data.value.split(" ")[0]]) {
}
export class CTextureExpression extends CSArray.Ex(CTextureExpressionSingle) {
} //RequireAll diffuse; RequireAny helmet,backpack
export class CTargetFilters extends CFlags.Ex(ETargetFilter) {
    flags = TypeFlags.Use;
}
export class CYawPitchRoll extends CScalar.Dyn((data) => EPitchRoll.enum[data.value] ? EPitchRoll : Real) {
} //Real or 'MAX' ?
export class CBooleanAttribute extends CBoolean {
    flags = TypeFlags.Attribute | TypeFlags.PreventInheritance;
}
export class CClassName extends EClassId {
    flags = TypeFlags.Tag | TypeFlags.PreventInheritance;
}
export class CRefKey extends CScalar.Union(EQuery, CActorLink) {
} //'::actor.VoidRayVoidAttackBeamModel'
export class CAttachmentKeys extends CScalar.Union(CDigits0030, EAttachmentKey) {
}
const IAttachmentName = {
    Ref_Weapon: [CAttachmentKeys],
    Ref_Hit: [CAttachmentKeys],
    Ref_Hardpoint: [CAttachmentKeys],
    Ref_StatusBar: [CAttachmentKeys],
    Ref_Target: [CAttachmentKeys],
    Ref_Damage: [CAttachmentKeys],
    Ref_Foot: [CAttachmentKeys],
    Ref_Center: [],
    Ref_Overhead: [],
    Ref_Origin: [],
    Ref_Head: [],
    Ref_TurretZ: []
};
export class EAttachmentName extends CEnum.FromArray(Object.keys(IAttachmentName)) {
}
const IAttachmentNameInstructions = CWTupleInstructions(EAttachmentName, IAttachmentName);
export class EAttachmentID extends CScalar.Dyn((data) => IAttachmentNameInstructions[data.value.split(" ")[0]]) {
}
function getAbilCmdEnum(mod, abilId) {
    const abilClass = mod.getEntityClass('Abil', abilId);
    const schema = abilClass.schema;
    return schema.CmdButtonArray?.index || schema.InfoArray?.index || null;
}
export class CAbilCommand extends CCTuple.Ex(CAbilLink, CScalar.Dyn((data, mod) => getAbilCmdEnum(mod, data[0].value))) {
} //EAbilCommand is different for different export class
export class CUserReference extends CSTuple.Ex(CUserLink, CScalar.Dyn((data) => CLink.FromNamespace('UserInstance' + data[0]))) {
} //PlayerCommanders;ZergDehaka
export class CCmdResult extends CCTuple.Ex(CErrorLink, CStringLink) {
} //CantFindEnoughTargets,Error/NoInfestedTarge
export const SEditorCategoriesFields = {
    value: CString,
    Race: CEditorCategoryRaceLink,
    AbilityorEffectType: EAbilityorEffectType,
    Climate: EClimate,
    ConversationType: EConversationType,
    DataFamily: EDataFamily,
    DataGroup: EDataGroup,
    DoodadType: EDoodadType,
    FootprintGroup: EFootprintGroup,
    LightGroup: ELightGroup,
    ObjectFamily: EObjectFamily,
    ObjectType: EObjectType,
    TechType: ETechType,
    TerrainObjectType: ETerrainObjectType,
    UpgradeType: EUpgradeType
};
export const STokenValueFields = {
    id: CTokenLink,
    value: CTokenType
};
export const STokenFields = {
    id: CTokenLink,
    type: ETypeId,
    value: CTokenType
};
export class TEditorCategories extends CSObject {
}
export class CTokenValues extends CRecord.Ex(CTokenLink, CTokenType) {
    flags = TypeFlags.Attribute;
    indexfield = 'id';
}
export class CTokenDefinitions extends CRecord.Ex(CTokenLink, CTokenType) {
    flags = TypeFlags.Instruction;
    indexfield = 'id';
}
export class TUpgradeEffectValue extends CScalar {
}
export class CConstType extends CScalar {
}
export class CNamespaceClassLink extends CLink {
    flags = TypeFlags.Attribute;
}
export class TCatalogFieldPath extends CAttributePath {
    flags = TypeFlags.Attribute;
}
export class CActorAttributePath extends CAttributePath {
}
const IOptions = {
    Physics: [EOptionPhysics]
};
export class EOptions extends CEnum.FromArray(Object.keys(IOptions)) {
}
const IOptionsInstructions = CWTupleInstructions(EOptions, IOptions);
export class COptions extends CScalar.Dyn((data) => IOptionsInstructions[data.value.split(" ")[0]]) {
}
export class CompareFieldInstructionValue extends CScalar.Dyn((data) => pathType('CActor.' + data[2].value)) {
}
const IActorTermConditionsTypes = {
    Option: [COptions], //'Option Physics Low'
    PlayerId: [Int, Int, /*Optional*/ CQuery], //'!PlayerId 15 15'.  //PlayerId 1 1 ::Self
    RefEquals: [/*Optional*/ CQuery, /*Optional*/ CQuery], //'RefEquals ::actor.Teleporter ::Creator'
    CompareField: [CQuery, CActorAttributePath, EValueCompare, CompareFieldInstructionValue], //'CompareField ::Main UnitFlags[ShowBlobShadow] Eq 1'
    PhysicsImpactMaterial: [EPlayerRelationship, CPhysicsMaterialLinks], // !PhysicsImpactMaterial Self {Dirt Sand Snow}'
    PhysicsImpactClassifyCombo: [EPhysicsImpact, CPhysicsMaterialLink, CSquibTypes, EActorPhysicsImpactRangeType, Real, Real], //PhysicsImpactClassifyCombo OnLand Dirt {Flesh LightArmor} Impulse 20.000000 99.989998
    PhysicsImpactClassify: [EPhysicsImpact, EPlayerRelationship, CPhysicsMaterialLink, EPhysiqsMaterialCompare, EActorPhysicsImpactRangeType, Real, Real], // PhysicsImpact; PhysicsImpactClassify OnLand Self Dirt SofterOrEqual Impulse 20.000000 99.989998
    PhysicsImpactMaterialCombo: [CPhysicsMaterialLink, CSquibTypes], //PhysicsImpactMaterialCombo Water {Flesh LightArmor}
    PhysicsImpactFromFloating: [Real], //PhysicsImpactFromFloating; PhysicsImpactCollisionArea 0.600000
    PhysicsImpactCollisionArea: [Real], //PhysicsImpactCollisionArea 0.600000
    IsKnownAs: [CActorLink], // IsKnownAs CollapsibleRockTowerRampRight
    AbilCmd: [CAbilCommand], //'AbilCmd attack,Barrage'
    AbilKey: [CDataSoupKey], //'AbilKey Upgrade'
    AbilTrainProduced: [CUnitLink], //'AbilTrainProduced TalDarimDeathStar'
    AbilTransport: [CUnitLink], //'AbilTransport SiegeTankSieged'
    Age: [], //'Age'
    AIUIMode: [EAIUIMode], //'AIUIMode Selectable'
    AnimBaselineState: [EBaselines], //'AnimBaselineState Walk'
    AnimBracketExitReason: [EAnimBracketExitReason], //'!AnimBracketExitReason ModelSwap'
    AnimName: [EAnimName], //'AnimName Death'
    AnimPlayable: [EAnimName], //'!AnimPlayable Flesh'
    AnimPlaying: [EAnimName], //'!AnimPlaying Bone'
    AnimPlayingName: [EAnimName], //'AnimPlayingName Attack'
    AnimPlayingProps: [CAnimProps], //'AnimPlayingProps Stand,Ready,End'
    At: [EEffectUnit], //'At Caster'
    ButtonEnabled: [], //'ButtonEnabled'
    CanApplyActionPhysics: [CActorLabelKey], //'CanApplyActionPhysics RagdollSpineCrawlerHurl'
    Cap: [Int], //'!Cap 3'
    CreepEngulfs: [], //CreepEngulfs
    CreepIntersects: [], //CreepIntersects
    CreepCanEngulf: [], //CreepCanEngulf
    Death: [], //'Death Disintegrate'
    EffectExecuteIndex: [Int], //'EffectExecuteIndex 1'
    EffectParent: [CEffectLink], //'!EffectParent ChargeCannonSuperChargeSet'
    Exclude: [EScope], //'Exclude Missile'
    FlyerHelper: [EFlyerHelper], //'FlyerHelper All'
    FromEffectTreeDescendant: [], //FromEffectTreeDescendant
    Game: [EGameEvent], //'Game Sync'
    GameSpeed: [EValueCompare, EGameSpeed], //'GameSpeed GE Faster'
    GameTime: [EValueCompare, UInt], //'GameTime LT 5'
    HasAllianceTypeWith: [CString], //'HasAllianceTypeWith Neutral'
    HasStatus: [CString], //'!HasStatus Raged'
    HasScopeFlag: [CString], // '!HasScopeFlag DisableSoundEmitters'
    Height: [EValueCompare, UReal], //'Height LT 0.250000'
    IsActorLocalPlayer: [], //'IsActorLocalPlayer'
    IsDuringReplay: [], //'!IsDuringReplay'
    IsInEditor: [], //'!IsInEditor'
    IsLocalParticipantType: [], //'!IsLocalParticipantType'
    IsStatus: [EStatus, Bit], //'IsStatus Dead 1'
    IsUnderwater: [], //'IsUnderwater'
    KilledByEffect: [CEffectLink], //'KilledByEffect InfantryFlamethrowerDetonateKillSelf'
    Level: [UInt], //'Level 12'
    MissileTentacleIsReturning: [CString], //'!MissileTentacleIsReturning TentacleAttack'
    ModelEventName: [CString], //'ModelEventName UBR_HFS2'
    ModelIsLowQuality: [], //'ModelIsLowQuality'
    ModelName: [CModelLink], //'ModelName UPLNightjarPlacement'
    ModelSwapTo: [CModelLink], //'ModelSwapTo WhiffBeam'
    ModelVariation: [Int], //'ModelVariation 1'
    MorphFrom: [CUnitLink], //'MorphFrom etoe'
    MorphTo: [CUnitLink],
    MotionPhase: [Int], //'MotionPhase 1'
    MovementNetOverInterval: [EMovement, Real], //'MovementNetOverInterval Below 0.001000'
    MoverLink: [CModelLink], //'MoverLink ucry1LMReturn'
    OrderDisplayType: [EAbilOrderDisplayType], //'OrderDisplayType Rally'
    OverkillType: [EOverkillType], //'OverkillType DamageOverInterval'
    PassChance: [UReal], //'PassChance 70.000000'
    PhysicsImpactRelativeApproachSpeed: [UReal], //'PhysicsImpactRelativeApproachSpeed 5.000000'
    PlayerHasClanDecal: [], //'PlayerHasClanDecal'
    PlayerHasReward: [CRewardLink], //'!PlayerHasReward SprayUseDecal_Off'.    
    PlayerHasTrophy: [], //'PlayerHasTrophy'
    Scope: [EScope], //'Scope Unit'
    ScopeContains: [CActorKey], //'ScopeContains _Destructible'
    Selected: [], //Selected
    SoundIsFinalSound: [], //SoundIsFinalSound
    StateChanged: [CStateLink], //'StateChanged A'
    StateValid: [CStateLink], //'StateValid MPStage0of50'
    Taunt: [], //Taunt
    TeamId: [CString, CWArray.Ex(ETeamId)], //'TeamId {} {Warp Out End}'
    TerrainPhysicsMaterialAtActor: [CPhysicsMaterialLinks], //'TerrainPhysicsMaterialAtActor {Dirt Sand Rock}'
    TextureFileAliasIsValid: [CTextureFileAliasLink], //'TextureFileAliasIsValid PlayerSecondary15'
    TextureUpdateSlot: [CTextureSlotLink], //'TextureUpdateSlot decal'
    TimerName: [CTimerLink], //'TimerName DelayDestroy'
    UnitWalking: [], //'!UnitWalking'
    ValidateCreationEffect: [CValidatorLink], //'ValidateCreationEffect HaveNuclearWarheadsHonorguard'
    ValidateEffect: [CValidatorLink], //'ValidateEffect ANrfLevel2'
    ValidatePlayer: [CValidatorLink], //'ValidatePlayer IsPlayerUndead'
    ValidatePosition: [CValidatorLink], //'ValidatePosition NexusBatteryOvercharge8RangePlacementVisual'
    ValidateUnit: [CValidatorLink], //'ValidateUnit TargetIsFlyerWar3'
    ValidateUnitType: [CValidatorLink], //'ValidateUnitType IsUPLSolitaire'
    ViewerTreatsUnitAs: [EStateArray], //'ViewerTreatsUnitAs Detected'
    WeaponTargetDistance: [EValueCompare, UReal], //'WeaponTargetDistance LE 1.000000'
    WeaponTargetElevation: [EValueCompare, UReal], //'WeaponTargetElevation GE 20.000000',
    SubName: [ESubName], //SubName Gone;
};
export { IActorTermConditionsTypes as ActorTermConditionsTypes };
export class EActorTermConditionsType extends CEnum.FromArray(Object.keys(IActorTermConditionsTypes)) {
}
const IActorTermConditionsInstructions = CWTupleInstructions(EActorTermConditionsType, IActorTermConditionsTypes);
const IActorTermsTypes = {
    EditorMapInitialize: [], //EditorMapInitialize
    Abil: [CAbilLink, EAbilEvent], //'Abil.ANfb.SourcePrepStart'
    AbilCharge: [CAbilLink, EAbilChargeEvent], //'AbilCharge.VengeanceMissile.Spend'
    AbilCooldown: [CAbilLink, EAbilCooldownEvent], //'AbilCooldown.BlindingBurst.Regen'
    AbilMorph: [CAbilLink, EAbilMorphEvent], //'AbilMorph.*.Finish; MorphTo etoe; PlayerHasClanDecal'
    AbilRally: [CAbilLink, EAbilRallyEvent], //'AbilRally.*.Place; GameTime GT 0; IsStatus Setup 0'
    AbilTrain: [CAbilLink, EAbilTrainEvent], //'AbilTrain.Adec.Start'
    AbilTransport: [CAbilLink, EAbilTransportEvent], //'AbilTransport.Sch2.TransportUnload'
    ActionDamage: [],
    ActionTargetTeleport: [],
    ActorCopy: [],
    ActorCreation: [],
    ActorDestruction: [],
    ActorOrphan: [],
    ActorThink: [],
    ActorUpdate: [],
    AgeReached: [],
    AIUIUpdate: [],
    AnimBracketState: [EAnimName, EAnimBracketState], //'AnimBracketState.*.AfterClosing; AnimName Death'
    AnimBracketStop: [],
    AnimClear: [],
    AnimDone: [EAnimName, EAnimDone], //'AnimDone.*.Complete'
    AnimGroupApply: [],
    AnimGroupRemove: [],
    AnimPlay: [], //'AnimPlay; AnimName Spell; AnimPlayingName Attack'
    AssetPreInit: [], //'AssetPreInit; ValidatePlayer BattlecruiserUpgraded'
    Behavior: [CBehaviorLink, EBehaviorEvent], //'Behavior.BNef.Off'
    BehaviorLevel: [CBehaviorLink], //'BehaviorLevel.AHer; ValidateUnit NotLv0'
    BehaviorStackAlias: [CBehaviorLink, EBehaviorEvent], //'BehaviorStackAlias.BoreDrill.Off'
    BehaviorStackItem: [CBehaviorLink, EBehaviorStackItemEvent], //'BehaviorStackItem.JupiterSpeedBuff.Remove; ValidateUnit CasterIsMovingLT8; IsStatus JupiterSound 1'
    BuildCoachHover: [CString, EBuildCoachHoverEvent], //'BuildCoachHover.*.Off'
    ButtonHover: [CButtonLink, ButtonHoverEvent], //'ButtonHover.UmojanDeployAntiAerospace.Off; ButtonEnabled'
    CameraProximityUpdate: [], //CameraProximityUpdate
    CommandUI: [], //'CommandUI.*.Birth; OrderDisplayType Rally; ValidatePlayer PlayerIsBWPr'
    Confirmation: [CUnitLink, EConfirmationEvent], //'Confirmation.SCV.Start'
    Create: [], //Create
    CursorUpdate: [CString, ECursorUpdateEvent], //'CursorUpdate.*.Stop; ValidateUnit IsFlying; HasStatus FlyerHelper'
    Cutscene: [CString, ECutsceneEvent], //'Cutscene.*.Stop'
    DeathCustomize: [CString, CString], //'DeathCustomize.*.Death2'
    DeathModelInitializeDone: [], //'DeathModelInitializeDone'
    Destroy: [], //'Destroy'
    Effect: [CEffectLink, EEffectEvent], //'Effect.Xbdt.Stop'
    EffectActionCenter: [], //EffectActionCenter
    EffectActionCommence: [], //EffectActionCommence
    FlyerHelperChange: [], //'FlyerHelperChange; FlyerHelper All; ValidateUnit IsFlying; !ScopeContains FlyerHelperSplat'
    GameInitialize: [], //'GameInitialize'
    HerdLevel: [CHerdLink, EHerdLevelEvent], //'HerdLevel.Herd_ZergLargeUnits.Decrease; Level 1 LT'
    HerdSpeed: [CHerdLink, EHerdSpeedEvent], //'HerdSpeed.Herd_ZergQueens.Decrease'
    MissileTentacleRetracted: [],
    ModelEvent: [],
    ModelSwap: [],
    ModelSwapped: [], //'ModelSwapped; ModelSwapTo WhiffBeam'
    MotionPhaseStart: [], //'MotionPhaseStart; MoverLink ucry1LMReturn'
    MotionPhaseStop: [], //'MotionPhaseStop; MotionPhase 2'
    MoverArrived: [], //'MoverArrived'
    OptionsChange: [], //'OptionsChange; Option Physics Low'
    PhysicsImpact: [], //'PhysicsImpact; PhysicsImpactRelativeApproachSpeed 5.000000; IsStatus TurretImpacted 0'
    PhysicsImpactCustomize: [CString, EPhysicsImpactEvent], //'PhysicsImpactCustomize.*.TurretImpact'
    PhysicsImpactTerrainValidate: [CString, EPhysicsImpactEvent], //'PhysicsImpactTerrainValidate.*.PhysicsImpactLightArmorMassive'
    PreSelectionUpdate: [CString, CString], //'PreSelectionUpdate.*.Stop'
    PreTargetingUpdate: [CString, CString], //'PreTargetingUpdate.*.Stop'
    ProgressLevel: [CString, CString], //'ProgressLevel.War3_Construction.Resume'
    RefSet: [], //'RefSet; IsStatus PlayerLogoActive 0; IsLocalParticipantType Observer'
    RegionSubject: [CString, ERegionSubject], //'RegionSubject.*.RemovedLast'
    SelectionLocalFlash: [], //'SelectionLocalFlash; ValidateUnit UseCliffSelection; IsLocalParticipantType'
    SelectionLocalUpdate: [], //'SelectionLocalUpdate.TR17.Stop'
    SelectionSyncFlash: [], //'SelectionSyncFlash; ValidateUnit UseCliffSelection; IsLocalParticipantType'
    SelectionSyncUpdate: [CString, ESelection], //'SelectionSyncUpdate.*.Add; ValidateUnit UseCliffSelection; IsLocalParticipantType Observer'
    SetScale: [], //SetScale
    SetTintColor: [], //SetTintColor
    Signal: [CString, ESignal], //'Signal.*.DestroyFlag'
    SoundDone: [], //'SoundDone; SoundIsFinalSound'
    StateChange: [], //'StateChange; StateValid MPStage0of50'
    StatusDecrement: [CString, EStatus], //'StatusDecrement.*.Glow'
    StatusIncrement: [CString, EStatus], //'StatusIncrement.*.Glow'
    StatusOff: [CString, EStatus], //'StatusOff.*.DebuffIndicator'
    StatusOn: [CString, EStatus], //'StatusOn.*.DebuffIndicator'
    StatusSet: [CString, EStatus], //'StatusSet.*.Weapon; IsStatus Weapon 3'
    SupporterDestruction: [], //SupporterDestruction
    TextureUpdate: [], //'TextureUpdate; TextureUpdateSlot decal; ValidatePlayer PlayerIsBWZe; !HasStatus OwnedByZerg'
    TimerExpired: [], //'TimerExpired; TimerName DelayDestroy'
    TurretEnable: [CTurretLink], //'TurretEnable.Attu'
    TurretTarget: [CTurretLink, ETurretTargetEvent], //'TurretTarget.CSVTurret.Clear'
    UnitBirth: [CUnitLink], //'UnitBirth.unp2; PlayerHasClanDecal'
    UnitBlipUpdate: [CUnitLink, EUnitBlipUpdateEvent], //'UnitBlipUpdate.*.Stop'
    UnitConstruction: [CUnitLink, EUnitConstructionEvent], //'UnitConstruction.*.Cancel'
    UnitCreation: [CUnitLink], //'UnitCreation.UPLSolitaire'
    UnitDamaged: [], //'UnitDamaged'
    UnitDeath: [], //'UnitDeath'
    UnitDeathCustomize: [], //'UnitDeathCustomize; IsStatus AnimateDead 1'
    UnitDetectedByViewer: [CUnitLink, EUnitDetectedByViewerEvent], //'UnitDetectedByViewer.*.Off'
    UnitFidget: [CUnitLink], //'UnitFidget'
    UnitHeightUpdate: [CUnitLink, EUnitHeightUpdateEvent], //'UnitHeightUpdate.*.Land; ValidateUnit NotHidden'
    UnitHighlightLocal: [CUnitLink, EUnitHighlightLocalEvent], //'UnitHighlightLocal.*.Stop'
    UnitMovementUpdate: [CUnitLink, EUnitMovementUpdateEvent], //'UnitMovementUpdate.*.Walk'
    UnitPlayerChange: [CUnitLink], //'UnitPlayerChange; IsStatus HaloAllyOn 1'
    UnitPoints: [CUnitLink, EUnitPointsEvent], //'UnitPoints.*.Tech'
    UnitPortrait: [CUnitLink, EUnitPortraitEvent], //'UnitPortrait.*.Configure'
    UnitRefund: [CUnitLink, EUnitRefundEvent], //'UnitRefund.*.Morph; ValidateUnit NotDead'
    UnitRegen: [CUnitLink, EUnitRegenEvent], //'UnitRegen.Scion_Processor.LifeOn'
    UnitRevive: [CUnitLink], //'UnitRevive'
    UnitTaunt: [CUnitLink, EUnitTauntEvent], //'UnitTaunt.*.Start; Taunt'
    Upgrade: [CUpgradeLink, EUpgradeEvent], //'Upgrade.RiotOfficerShield.Add'
    WeaponCriticalUpdate: [CWeaponLink, EWeaponCriticalUpdateEvent], //'WeaponCriticalUpdate.*.Off'
    WeaponStart: [CWeaponLink, EWeaponStartEvent], //'WeaponStart.*.AttackStart'
    WeaponStop: [CWeaponLink, EWeaponStopEvent], //'WeaponStop.*.AttackStop'
};
export { IActorTermsTypes as ActorTermsTypes };
export class EActorTermsType extends CEnum.FromArray(Object.keys(IActorTermsTypes)) {
}
const IActorTermsInstructions = CDTupleInstructions(EActorTermsType, IActorTermsTypes);
export class CActorTerm extends CScalar.Dyn((data) => IActorTermConditionsInstructions[data.value.split(" ")[0]] || IActorTermsTypes[data.value.split(".")[0]]) {
}
export class CActorTerms extends CSArray.Ex(CActorTerm) {
} //use validate to get type
const IActorMsgPayloadPtr = {
    ModelSwap: [CModelLink, /*Optional*/ UInt], // ModelSwap Protoss_Base_Terminals_Death 9
    RefSetFromMsg: [CQuery, CQuery], // RefSetFromMsg ::actor.SupplyDropModel ::Sender // RefSetFromMsg ::Host ::Sender
    QueryRegion: [CQuery, CActorLink, /*Optional*/ EAgainstCenter], // QueryRegion ::Self NukedQuery AgainstCenter
    AttachSetBearingsFrom: [CWTuple.Ex(CString, Int), CWTuple.Ex(CString), CActorLinks], //AttachSetBearingsFrom {Weapon 0} {} {LurkerMPSOpAoEVariancer SOpShadow SOpForwardCasterPoint SOp2DRotation LurkerMPSOpShadowSpine SOpRotVariancerUp15}
    HostSiteOpsSet: [EHostSiteOpsSetHost, CActorSiteOps, /*Optional*/ UInt], //HostSiteOpsSet ::Host SOpZFromCollapsibleRockTowerRamp //HostSiteOpsSet ::Host {SOpPurifierCellBlockRotation SOpMoveDownByDot1} 1
    PortraitCustomize: [CModelLink],
    ModelMaterialRemove: [CActorLink],
    ModelMaterialApply: [CActorLink],
    CreateCopy: [CActorLink],
    Create: [CActorLink],
    TimerSet: [Real, CTimerLink],
    QueryRadius: [Real, CActorLink], // QueryRadius 2.000000 ProtossEnergyLineQuery
};
export class EActorMsgPayloadPtr extends CEnum.FromArray(Object.keys(IActorMsgPayloadPtr)) {
}
const IActorMsgPayloadPtrInstructions = CWTupleInstructions(EActorMsgPayloadPtr, IActorMsgPayloadPtr);
export class CActorMsgPayloadPtr extends CScalar.Dyn((data) => IActorMsgPayloadPtrInstructions[data.value.split(" ")[0]]) {
}
/**
 * Expose an Instructions dispatch table (otherwise closure-local inside the
 * `CScalar.Dyn` resolver) as static metadata so tooling can validate and extract
 * relations from these mini-language scalars class-by-class:
 *   - `instructions[keyword]` → a CWTuple/CDTuple whose `memberTypes` are
 *     `[keywordEnum, ...argTypes]`, so `ModelSwap SomeModel 9` validates field-by-field;
 *   - `instructionDelimiter` — how the first (keyword) token is split off (space or dot);
 *   - `instructionFallback` — for classes whose resolver falls back to a plain link when
 *     the first token isn't a known keyword (e.g. `CActorKey → CActorLink`,
 *     `CDataSoupKey → CEffectLink`), the whole value is that link type. Strictly
 *     per-class so the object's own grammar drives validation/navigation.
 */
function attachInstructions(cls, meta) {
    const c = cls;
    c['instructions'] = meta.table;
    c['instructionEnum'] = meta.enumClass;
    c['instructionDelimiter'] = meta.delimiter;
    if (meta.fallback)
        c['instructionFallback'] = meta.fallback;
}
// All Instructions-type complex scalars (the resolver tables are closure-local; this is the
// single place their grammar is published for the catalog/LSP tooling). Delimiter and any
// link fallback are taken straight from each class's own `CScalar.Dyn` resolver above.
attachInstructions(CActorMsgPayloadPtr, {
    table: IActorMsgPayloadPtrInstructions,
    enumClass: EActorMsgPayloadPtr,
    delimiter: ' ',
});
attachInstructions(CActorKey, {
    table: IActorKeyInstructions,
    enumClass: EActorKey,
    delimiter: ' ',
    fallback: CActorLink,
});
attachInstructions(CDataSoupKey, {
    table: IDataSoupKeyInstructions,
    enumClass: EDataSoupKey,
    delimiter: ' ',
    fallback: CEffectLink,
});
attachInstructions(CTextureExpressionSingle, {
    table: ITextureExpressionInstructions,
    enumClass: ETextureExpression,
    delimiter: ' ',
});
attachInstructions(EAttachmentID, {
    table: IAttachmentNameInstructions,
    enumClass: EAttachmentName,
    delimiter: ' ',
});
attachInstructions(COptions, {
    table: IOptionsInstructions,
    enumClass: EOptions,
    delimiter: ' ',
});
// CActorTerm dispatches on a space-delimited *conditions* table first, then a dot-delimited
// *terms* table; only the (more common) space conditions grammar is published here. The
// dot-delimited terms (`Abil.ANfb.SourcePrepStart`) stay opaque — no false positives.
attachInstructions(CActorTerm, {
    table: IActorTermConditionsInstructions,
    enumClass: EActorTermConditionsType,
    delimiter: ' ',
});
// CQuery is dot-delimited (`::actor.SomeActor`) and appears only nested as an arg of other
// instructions; left unpublished for now (dot tokenization + nested-arg walking is future work).
export const CATALOG_DATA_TYPES = { Int, Real, UReal, UInt, CString, Bit, Int8, Int16, Int32, UInt8, UInt16, UInt32, Real32, UReal32, CColor, CColorRGB, CColorHDR, TCargoSize, TCargoCapacity, TMarkerCount, TPreemptLevel, TAbilCmdIndex, TCliffLevel, TPowerLevel, TDifficultyLevel, TAIBuild, TPlayerId, TMountCategory, TAttackTargetPriority, TUnitRadius, TAttachPropIndex, TCommanderLevel, C3fVector, C2iVector, CScaleVector, C3Vector, C2Vector, C2fVector, C4Vector, THandicap, TCmdResult, TDifficulty, TEditorCategories, TSoundWeight, TSoundBalance, CFangleArc, CGameTime, CfRange, CFangle, CGamePoint, CQuad, CRange, CVariatorActorReal32, CEffectOffset, CRect, CfQuad, CVolumeRange, CVariatorActorAngle, CActorCreateKey, CActorLabelKey, CActorAngle, CAnimNameKey, CAnimProps, CFacing, CVariatorActorFangle, CFangleRate, CGameRate, CAttachKeys, CiRange, CiQuad, CGameSpeed, CVariatorGameFangle, CVariatorGameFixed, CStyleName, CPitchRange, CVolume, CGameAcceleration, CLabelExpression, CIdSetPlayers, CIdSetTeams, CSubNameKey, CGamePoInt3D, CMissileAcceleration, CMissileSpeed, CPhaseOutro, CThrowBand, CFangleRateMissile, CFangleAccelMissile, CPitch, CString4, CString32, CString50, CString80, Month, Day, Year, CFourCC, CCardId, CYawPitchRoll, CIdentifier, CCmdResult, TTriggerLibId, TCooldownLink, TChargeLink, TMarkerLink, TPowerLink, TProductHyperlinkId, THyperlinkId, TGalaxyFunction, TBattleProductId, TConversationItemId, TTechAlias, TBattleLicenseName, TUserFieldId, TUserInstanceId, TConversationStateOpId, TConversationStateIndexId, TConversationStateVariation, TConversationTag, TConversationStateInfoId, TUpgradeEffectValue, TVoiceOverSkinId, TVoiceOverGroupId, TLocaleId, CAbilSetId, TFootprintOffsets, TFootprintBorders, CTexturePath, CImagePath, CAssetFile, CImageLink, CMovieFile, CMapFile, CModelFile, CCutsceneFile, CFontStyleFile, CLayoutFile, CSoundFile, CAnimsFile, CFacialFile, CSyncModelDataFile, CXMLFile, CFontFile };
//special structures
// class SEditorCategories extends CStruct.Ex(SEditorCategoriesFields) { }
// class STokenValue extends CStruct.Ex(STokenValueFields) { }
// class SToken extends CStruct.Ex(STokenFields) { }
// Prototype assignments that depend on schema.struct.ts / schema.classes.ts are in schema.init.ts
