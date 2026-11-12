// Presentation only: every required qualified axis remains visible, including
// packed localized values. This module cannot grant a pass or prove new code.
import assert from 'node:assert/strict';
import {summarizeOfflineEvidence, requiredOfflineAxes} from './offline-outcome.localized-values.mjs';

const labels = Object.freeze({root:'эквивалентность основного кода', gui:'восстановление GUI',
  generatedSdk:'типы и вызовы нового кода', sourceSdk:'типы и вызовы исходника',
  sourceReference:'связь с исходным архивом', attributes:'определения и defaults атрибутов',
  dependencies:'исходные версии зависимостей', localizedValues:'значения GameStrings/GameHotkeys'});
const dataAxes = new Set(['attributes', 'dependencies', 'localizedValues']);

export function explainOfflineReview(row) {
  const verified = summarizeOfflineEvidence(row);
  assert.equal(row.status, verified.status, 'OUTCOME_AXES_DISAGREE');
  assert.equal(row.codeConclusion, verified.codeConclusion, 'CODE_CONCLUSION_AXES_DISAGREE');
  const pending = requiredOfflineAxes.filter(key => verified.axes[key].status !== 'PASSED');
  assert.deepEqual(row.pendingOffline, pending, 'PENDING_AXES_DISAGREE');
  const rootProved = verified.axes.root.status === 'PASSED';
  const onlyData = pending.length > 0 && pending.every(key => dataAxes.has(key));
  const group = verified.status === 'EVIDENCE_INVALID' ? 'EVIDENCE_INVALID'
    : verified.status === 'SOURCE_UNAVAILABLE' ? 'SOURCE_UNAVAILABLE'
    : verified.status === 'GUI_RECOVERY_INCOMPLETE' ? 'GUI_RECOVERY_INCOMPLETE'
    : !pending.length ? 'OFFLINE_GATES_PASSED_EDITOR_PENDING'
    : rootProved && onlyData ? 'ROOT_PROVED_DATA_UNPROVED'
    : rootProved ? 'ROOT_PROVED_OTHER_GATES_UNCLOSED' : 'ROOT_EQUIVALENCE_UNPROVED';
  const blockers = pending.map(axis => Object.freeze({axis, label:labels[axis],
    status:verified.axes[axis].status, reason:verified.axes[axis].reason}));
  return Object.freeze({group, rootProved, onlyDataPending:onlyData,
    rootSummary:rootProved ? 'Основной код эквивалентен в закреплённом окружении и границах доказательства.'
      : 'Эквивалентность основного кода не доказана.',
    reviewSummary:!pending.length ? 'Все обязательные офлайн-гейты пройдены; Editor отложен.'
      : onlyData && rootProved ? 'REVIEW относится к данным окружения; доказательство основного кода закрыто.'
      : 'Есть незакрытые проверки; это не доказательство ошибки бизнес-логики.',
    blockers:Object.freeze(blockers), wholeProgramEquivalent:false, editorEquivalentCompiler:false,
    originalStatus:row.status, acceptanceChanged:false});
}
