import { CCArray, CVariator, CWArray, CSArray, CWTuple, COTuple } from "./schema.core.js";
import { ELetter, EDigit, EAnimName, EPlayerTeam, EActorClassFilter, EActorTableKey, ESquibType } from "./schema.enums.js";
import { CAttachMethodLink, CTexturePropLink, CActorLink, CPhysicsMaterialLink, CActorDeathMemberLink } from "./schema.links.js";
import { CNumber, CString, CScalar } from "./schema.primitives.js";
export class Int extends CNumber.Int() {
}
export class Int8 extends CNumber.Int(-128, 127) {
}
export class Int16 extends CNumber.Int(-32768, 32767) {
}
export class Int32 extends CNumber.Int(-2147483648, 2147483647) {
}
export class UInt extends CNumber.UInt() {
}
export class Bit extends CNumber.UInt(1) {
}
export class UInt8 extends CNumber.UInt(255) {
}
export class UInt16 extends CNumber.UInt(65535) {
}
export class UInt32 extends CNumber.UInt(4294967295) {
}
export class Year extends CNumber.UInt() {
}
export class Month extends CNumber.UInt(12) {
}
export class Day extends CNumber.UInt(31) {
}
export class Real extends CNumber.Real() {
}
export class UReal extends CNumber.UReal() {
}
export class Real32 extends CNumber.Real(-2147483648, 2147483647) {
}
export class UReal32 extends CNumber.UReal(4294967295) {
}
export class Angle extends CNumber.UReal(360) {
}
export class TimeHour extends CNumber.UInt(24, { pad: 2 }) {
}
export class TimeMinute extends CNumber.UInt(60, { pad: 2 }) {
}
export class TimeSecond extends CNumber.UInt(60, { pad: 2 }) {
}
export class TAbilCmdIndex extends CNumber.UInt(30) {
}
export class TCargoSize extends CNumber.UInt(8) {
}
export class TPlayerId extends CNumber.UInt(15) {
}
export class TSoundBalance extends Int {
}
export class TCargoCapacity extends UInt {
}
export class TMarkerCount extends UInt {
}
export class TPreemptLevel extends UInt {
}
export class TCliffLevel extends UInt {
}
export class TPowerLevel extends UInt {
}
export class TDifficultyLevel extends UInt {
}
export class TAIBuild extends UInt {
}
export class TAttackTargetPriority extends UInt {
}
export class TAttachPropIndex extends UInt {
}
export class TCommanderLevel extends UInt {
}
export class THandicap extends UInt {
}
export class TDifficulty extends UInt {
}
export class TSoundWeight extends UInt {
}
export class TUnitRadius extends UReal {
}
export class CGameTime extends UReal {
}
export class CMissileSpeed extends UReal {
}
export class CFangleRate extends Real {
}
export class CGameRate extends Real {
}
export class CGameSpeed extends Real {
}
export class CVolume extends Real {
}
export class CGameAcceleration extends Real {
}
export class CMissileAcceleration extends Real {
}
export class CFangleRateMissile extends Real {
}
export class CFangleAccelMissile extends Real {
}
export class CFangleArc extends Angle {
}
export class CFangle extends Angle {
}
export class CActorAngle extends Real {
}
export class CFacing extends Angle {
}
export class CString4 extends CString.Len(4) {
}
export class CString32 extends CString.Len(32) {
}
export class CString50 extends CString.Len(50) {
}
export class CString80 extends CString.Len(80) {
}
export class CFourCC extends CString4 {
}
export class CCardId extends CString4 {
}
export class CAnimNameKey extends CString {
}
export class CAttachKeys extends CString {
}
export class CStyleName extends CString {
}
export class CLabelExpression extends CString {
}
export class CIdSetPlayers extends CString {
}
export class CIdSetTeams extends CString {
}
export class CSubNameKey extends CString {
}
export class TMountCategory extends CString {
}
export class TCmdResult extends CString {
}
export class CDigits0030 extends CString.Len(2) {
    static validate(s) {
        if (!/^\d{2}$/.test(s))
            return false; // must be exactly 2 digits
        const n = Number(s);
        return n >= 0 && n <= 30;
    }
}
export class CDigits0099 extends CString.Len(2) {
    static validate(s) {
        return /^[0-9]{2}$/.test(s);
    }
}
export class EAnimProp extends CScalar.Union(CDigits0099, ELetter, EDigit, EAnimName) {
}
// type a = CDigits0099['value']
// type b = ELetter['value']
// type c = EDigit['value']
// type d = EAnimName['value']
// type x = EAnimProp['value']
// export class A extends CScalar<"a" | "b"> {}
// export class B extends CScalar<"c" | "d"> {}
// type TA = ScalarValue<typeof A>; // should be "a" | "b"
// type TB = ScalarValue<typeof B>; // should be "c" | "d"
export class EPlayerId extends CScalar.Union(TPlayerId, EPlayerTeam) {
}
// type x = TPlayerId['value']
// type y = EPlayerId['value']
// //example
// let cDigits0030 = new CDigits0030('00')
// cDigits0030.value = '20'
// cDigits0030.value = '31' // ERROR
// #endregion
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// #region Arrays
export class CUInt8Array3 extends CCArray.Ex(UInt8, 3) {
}
export class CUInt8Array4 extends CCArray.Ex(UInt8, 4) {
}
export class CIntArray2 extends CCArray.Ex(Int, 2) {
}
export class CIntArray3 extends CCArray.Ex(Int, 3) {
}
export class CIntArray4 extends CCArray.Ex(Int, 4) {
}
export class CRealArray2 extends CCArray.Ex(Real, 2) {
}
export class CRealArray3 extends CCArray.Ex(Real, 3) {
}
export class CRealArray4 extends CCArray.Ex(Real, 4) {
}
export class CUIntArray extends CCArray.Ex(UInt) {
}
export class CRealArray extends CCArray.Ex(Int) {
}
// let cUInt8Array3 = new CUInt8Array3([221,1,21])
// cUInt8Array3.value = [1,2,3]
export class C2Vector extends CIntArray2 {
}
export class C2iVector extends CIntArray2 {
}
export class CfRange extends CIntArray2 {
}
export class CiRange extends CIntArray2 {
}
export class C3Vector extends CIntArray3 {
}
export class CGamePoint extends CIntArray3 {
}
export class CGamePoInt3D extends CIntArray3 {
}
export class CiQuad extends CIntArray4 {
}
export class C2fVector extends CRealArray2 {
}
export class CScaleVector extends CRealArray2 {
}
export class CRange extends CRealArray2 {
}
export class CVolumeRange extends CRealArray2 {
}
export class CPitchRange extends CRealArray2 {
}
export class CPhaseOutro extends CRealArray2 {
}
export class CPitch extends CRealArray2 {
}
export class C3fVector extends CRealArray3 {
}
export class CEffectOffset extends CRealArray3 {
}
export class C4Vector extends CRealArray4 {
}
export class CRect extends CRealArray4 {
}
export class CfQuad extends CRealArray4 {
}
export class CThrowBand extends CRealArray4 {
}
export class CQuad extends CRealArray4 {
}
export class CColorRGB extends CUInt8Array3 {
}
export class CColorHDR extends CUInt8Array3 {
}
export class CColor extends CUInt8Array4 {
}
export class CVariatorGameFixed extends CVariator.Ex(Real) {
}
export class CVariatorActorFangle extends CVariator.Ex(Real) {
}
export class CVariatorActorReal32 extends CVariator.Ex(Real) {
}
export class CVariatorGameFangle extends CVariator.Ex(Angle) {
}
export class CVariatorActorAngle extends CVariator.Ex(Angle) {
}
export class CActorClassFilters extends CCArray.Ex(EActorClassFilter) {
} //Snapshot,Unit,Missile
export class CAttachMethods extends CWArray.Ex(CAttachMethodLink) {
} //AMFilterDamage AMRandomUniformAll AMReductionFire
export class CTextureProps extends CCArray.Ex(CTexturePropLink) {
} //diffuse,misc,lordaeronsummer
export class CActorTableKeys1x3 extends CCArray.Ex(EActorTableKey) {
} //BasicAir,Basic array of strings?
export class CAnimProps extends CCArray.Ex(EAnimProp) {
}
export class TFootprintOffsets extends CSArray.Ex(CRealArray) {
} //'-0.25,-0.5;0.25,-0.5;-0.25,0.5;0.25,0.5;-0.5,-0.25;-0.5,0.25;0.5,-0.25;0.5,0.25
export class TFootprintBorders extends CSArray.Ex(CUIntArray) {
} //'0,4,2;1,0,2;2,3,2;3,7,2;4,5,2;5,2,2;6,1,2;7,6,2' 
export class CActorLinks extends CWTuple.Ex(CActorLink) {
}
export class CActorSiteOps extends CActorLinks {
}
export class CPhysicsMaterialLinks extends CWArray.Ex(CPhysicsMaterialLink) {
}
export class CSquibTypes extends CWArray.Ex(ESquibType) {
}
export class CActorDeathMembers extends CSArray.Ex(CActorDeathMemberLink) {
} // RagdollBasicNoBlood;RagdollGibNoBlood 
export class CTimeOfDay extends COTuple.Ex(TimeHour, TimeMinute, TimeSecond) {
} //20:00:00
//# sourceMappingURL=schema.types.js.map