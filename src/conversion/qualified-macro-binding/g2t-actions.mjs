import { createActionBuilders } from './action-builders.mjs';
import * as syntax from '../exact-function-signatures/index-alternate-5.js';
import { privateSnapshotIntegerLoop } from '../exact-native-export/integer-loop-contract-alternate-3.mjs';
import { privateUnitLoopScaffolding } from '../native-expression-identity/private-unit-loop-scaffolding.mjs';
import * as conversionModel from '../../sdk/thread-analysis/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import * as nativeNames from '../exact-native-export/core-alternate-3.mjs';
import * as editorLayout from '../exact-native-export/editor-layout.mjs';
import * as actionNodes from '../exact-native-export/g2t-core-alternate.mjs';
import * as calls from './g2t-call.mjs';
import * as templates from '../exact-native-export/script-template-alternate-3.mjs';
import { resolveParamDefByRef } from '../exact-native-export/g2t-params-alternate-2.mjs';

export const {
  stmtToActionFCRef,
  buildZeroArgFCRef,
  buildReturnValueFCRef,
  exprStmtToActionFCRef,
  isSimpleVarExpr,
  isAssignableVarTarget,
  buildSetVariableFCRef,
  buildCompoundAssignFCRef,
  buildIfThenElseFCRef,
  buildWhileDoFCRef,
  buildPickEachIntegerFCRef,
  buildPickEachIntegerFromForStmt,
  isFixedLiteralExpr,
  tryMatchForEachIntegerCondition,
  buildForEachIntegerFCRef,
  tryBuildForEachIntegerFromStmtSequence,
  buildRepeatFCRef,
  tryBuildRepeatFromStmtSequence,
  buildRepeatForeverFCRef,
  tryBuildRepeatForeverFromStmt,
  buildWaitForConditionFCRef,
  buildWaitForConditionWithMaximumDurationFCRef,
  tryBuildWaitForConditionFromStmtSequence,
  tryBuildWaitForConditionWithMaxFromStmtSequence,
  buildActionQueueAddFCRef,
  tryBuildActionQueueAddFromStmtSequence,
  parseSwitchIfChain,
  buildSwitchFCRef,
  tryBuildSwitchFromStmtSequence,
  buildPickEachPlayerInGroupFCRef,
  tryBuildDeprecatedForEachPlayerFromStmtSequence,
  tryBuildLegacyPickEachPlayerFromStmtSequence,
  buildPickEachUnitInGroupFCRef,
  tryBuildPickEachPlayerFromStmtSequence,
  tryBuildPickEachUnitFromStmtSequence,
  tryBuildForEachCatalogEntryFromStmtSequence,
  tryBuildForEachUserDataInstanceFromStmtSequence,
  tryBuildForEachUIFrameFromStmtSequence,
  buildCustomScriptActionFCRef,
  tryBuildLoadedAutoTemplateSequence,
  convertStatementListToActionRefs,
  commentActionsBetween,
  isTestCondsGuard,
  isRunActionsGuard,
} = createActionBuilders({
  syntax,
  privateSnapshotIntegerLoop,
  privateUnitLoopScaffolding,
  conversionModel,
  nativeNames,
  editorLayout,
  actionNodes,
  calls,
  templates,
  resolveParamDefByRef,
});
