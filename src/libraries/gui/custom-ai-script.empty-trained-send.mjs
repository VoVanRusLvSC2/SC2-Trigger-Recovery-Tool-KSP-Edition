const RULE =
  '//--------------------------------------------------------------------------------------------------';
const INDENT = '    ';
export const customAiScriptName = (definition) => `ai${definition.id}`;
const waveSteps = (definition) =>
  definition.steps.filter((step) => step.type === 'Wave' && step.id !== undefined);
function byDifficulty(lines, variable, values) {
  for (const { level, value } of values)
    lines.push(`${INDENT}if (d == ${level}) { ${variable} = ${value}; }`);
}
const guard = (fail) => [
  `${INDENT}if (p < 0 || p >= 16) {`,
  `${INDENT}${INDENT}return${fail === '' ? '' : ' ' + fail};`,
  `${INDENT}}`,
];
/** `ai<Id>.galaxy` of one definition. */
export function generateCustomAiScript(definition, names) {
  const ai = customAiScriptName(definition);
  const waves = waveSteps(definition);
  const lines = [
    '//==================================================================================================',
    '// ',
    '// Generated AI Script',
    '// ',
    `// AI Name: ${names.aiName(definition)}`,
    '// ',
    '//==================================================================================================',
    'include "TriggerLibs/natives"',
    'include "TriggerLibs/AI"',
    'include "TriggerLibs/Computer"',
    '',
    RULE,
    '// Globals',
    RULE,
    `point[17] ${ai}_defGather;`,
    `string[17] ${ai}_customData;`,
    `wave[17] ${ai}_lastWave;`,
    '',
  ];
  for (const step of waves) waveBlock(lines, ai, step, names);
  const dispatch = (head, call, tail, of = waves) => {
    lines.push(RULE, head);
    for (const step of of)
      lines.push(`${INDENT}if (w == ${step.id}) { ${call(`${ai}_wave${step.id}`)} }`);
    if (tail !== undefined) lines.push(`${INDENT}${tail}`);
    lines.push('}', '');
  };
  lines.push(RULE, '// Attack Wave Wrappers', RULE);
  lines.push(`void ${ai}_wave_enable (int w, int p, bool val) {`);
  for (const step of waves)
    lines.push(`${INDENT}if (w == ${step.id}) { ${ai}_wave${step.id}_enable(p, val); }`);
  lines.push('}', '');
  dispatch(
    `bool ${ai}_wave_isEnabled (int w, int p) {`,
    (wave) => `return ${wave}_isEnabled(p);`,
    'return false;',
  );
  dispatch(
    `unitgroup ${ai}_wave_createdUnits (int w, int p) {`,
    (wave) => `return ${wave}_createdUnits(p);`,
    'return null;',
    waves.filter((step) => step.createUnits),
  );
  dispatch(
    `wave ${ai}_wave_createdWave (int w, int p) {`,
    (wave) => `return ${wave}_createdWave(p);`,
    'return null;',
  );
  dispatch(
    `void ${ai}_wave_run (int w, int p, playergroup target, bool wait) {`,
    (wave) => `${wave}_run(p, target, wait);`,
    undefined,
  );
  lines.push(
    RULE,
    '// Attack Wave Sequence',
    RULE,
    `trigger ${ai}_waves_trigger = null;`,
    `int ${ai}_waves_runPlayer;`,
    `playergroup ${ai}_waves_runTarget;`,
    '',
    RULE,
    `void ${ai}_waves_init () {`,
    `${INDENT}${ai}_waves_trigger = TriggerCreate("${ai}_waves_runFunc");`,
    '}',
    '',
    RULE,
    `bool ${ai}_waves_runFunc (bool c, bool a) {`,
    `${INDENT}int p = ${ai}_waves_runPlayer;`,
    `${INDENT}playergroup target = ${ai}_waves_runTarget;`,
    '',
    ...guard('false'),
    '',
  );
  for (const step of definition.steps) {
    if (step.type === 'Comment') lines.push(`${INDENT}// ${step.text ?? ''}`);
    else if (step.id !== undefined && (step.type === 'Wave' || step.type === 'Link')) {
      lines.push(
        `${INDENT}${ai}_wave${step.id}_run(p, target, ${step.noWait ? 'false' : 'true'});`,
      );
      // A wave that does not wait still yields once, so the next starts on a later game loop.
      if (step.noWait) lines.push(`${INDENT}Wait(0, c_timeAI);`);
    }
  }
  if (
    definition.steps.some(
      (step) =>
        step.type === 'Comment' ||
        (step.id !== undefined && (step.type === 'Wave' || step.type === 'Link')),
    )
  )
    lines.push('');
  // Native RepeatWaves counts executed Wave/Link occurrences; comments are excluded.
  const executable = definition.steps.filter(
    (step) => step.id !== undefined && (step.type === 'Wave' || step.type === 'Link'),
  );
  if (definition.repeatWaves !== undefined && definition.repeatWaves > 0 && executable.length > 0) {
    lines.push(`${INDENT}while (true) {`);
    for (const step of executable.slice(-definition.repeatWaves)) {
      lines.push(
        `${INDENT}${INDENT}${ai}_wave${step.id}_run(p, target, ${step.noWait ? 'false' : 'true'});`,
      );
      if (step.noWait) lines.push(`${INDENT}${INDENT}Wait(0, c_timeAI);`);
    }
    lines.push(`${INDENT}}`, '');
  }
  lines.push(
    `${INDENT}return true;`,
    '}',
    '',
    RULE,
    `void ${ai}_waves_run (int p, playergroup target) {`,
    `${INDENT}${ai}_waves_runPlayer = p;`,
    `${INDENT}${ai}_waves_runTarget = PlayerGroupCopy(target);`,
    '',
    `${INDENT}TriggerExecute(${ai}_waves_trigger, false, false);`,
    '}',
    '',
    RULE,
    `void ${ai}_waves_enable (int p, bool val) {`,
    ...guard(''),
    '',
    ...waves.map((step) => `${INDENT}${ai}_wave${step.id}_enable(p, val);`),
    '}',
    '',
    RULE,
    `void ${ai}_waves_stop () {`,
    `${INDENT}TriggerStop(${ai}_waves_trigger);`,
    '',
    ...waves.map((step) => `${INDENT}TriggerStop(${ai}_wave${step.id}_trigger);`),
    '}',
    '',
    RULE,
    '// Configuration',
    RULE,
    `void ${ai}_setDefGather (int p, point val) {`,
    ...guard(''),
    `${INDENT}${ai}_defGather[p] = val;`,
    '}',
    '',
    RULE,
    `string ${ai}_getCustomData (int p) {`,
    ...guard('null'),
    `${INDENT}return ${ai}_customData[p];`,
    '}',
    '',
    RULE,
    `wave ${ai}_getLastWave (int p) {`,
    ...guard('null'),
    `${INDENT}return ${ai}_lastWave[p];`,
    '}',
    '',
    RULE,
    '// Start',
    RULE,
    `bool ${ai}_initialized = false;`,
    '',
    RULE,
    `void ${ai}_start (int p) {`,
    `${INDENT}int init_i;`,
    '',
    ...guard(''),
    `${INDENT}if (!${ai}_initialized) {`,
    ...waves.map((step) => `${INDENT}${INDENT}${ai}_wave${step.id}_init();`),
    `${INDENT}${INDENT}${ai}_waves_init();`,
    '',
    `${INDENT}${INDENT}for (init_i = 0; init_i <= 16; init_i += 1) {`,
    `${INDENT}${INDENT}${INDENT}${ai}_defGather[init_i] = PointFromId(${definition.gatherDefault ?? 0});`,
    `${INDENT}${INDENT}}`,
    '',
    `${INDENT}${INDENT}${ai}_initialized = true;`,
    `${INDENT}}`,
    '',
    `${INDENT}AICampaignStart(p);`,
    '}',
    '',
  );
  return lines.join('\r\n');
}
function waveBlock(lines, ai, step, names) {
  const wave = `${ai}_wave${step.id}`;
  const time = (type) => step.times.find((item) => item.type === type);
  const arrival = time('Arrival');
  const gather = time('GatherTime');
  const finalWait = time('FinalWait');
  const run = (trigger) => {
    const name = trigger === undefined ? undefined : names.triggerFunction(trigger);
    return name === undefined
      ? []
      : [`${INDENT}TriggerExecute(TriggerFind("${name}"), true, false);`];
  };
  const points = (type) => step.points.filter((point) => point.type === type);
  lines.push(
    RULE,
    `// Attack Wave: ${step.text ?? ''}`,
    RULE,
    `bool[17] ${wave}_enabled;`,
    ...(step.onceOnly ? [`bool[17] ${wave}_hasRun;`] : []),
    ...(step.createUnits ? [`unitgroup[17] ${wave}_lastUnits;`] : []),
    `wave[17] ${wave}_lastWave;`,
    `trigger ${wave}_trigger = null;`,
    `int ${wave}_runPlayer;`,
    `playergroup ${wave}_runTarget;`,
    '',
    RULE,
    `void ${wave}_init () {`,
    `${INDENT}int init_i;`,
    '',
    `${INDENT}for (init_i = 0; init_i <= 16; init_i += 1) {`,
    `${INDENT}${INDENT}${wave}_enabled[init_i] = ${step.initOff ? 'false' : 'true'};`,
    ...(step.onceOnly ? [`${INDENT}${INDENT}${wave}_hasRun[init_i] = false;`] : []),
    ...(step.createUnits ? [`${INDENT}${INDENT}${wave}_lastUnits[init_i] = null;`] : []),
    `${INDENT}${INDENT}${wave}_lastWave[init_i] = null;`,
    `${INDENT}}`,
    '',
    `${INDENT}${wave}_trigger = TriggerCreate("${wave}_runFunc");`,
    '}',
    '',
    RULE,
    `void ${wave}_enable (int p, bool val) {`,
    ...guard(''),
    `${INDENT}${wave}_enabled[p] = val;`,
    '}',
    '',
    RULE,
    `bool ${wave}_isEnabled (int p) {`,
    ...guard('false'),
    `${INDENT}return ${wave}_enabled[p];`,
    '}',
    '',
  );
  if (step.createUnits) {
    lines.push(
      RULE,
      `unitgroup ${wave}_createdUnits (int p) {`,
      ...guard('null'),
      `${INDENT}return ${wave}_lastUnits[p];`,
      '}',
      '',
    );
  }
  lines.push(
    RULE,
    `wave ${wave}_createdWave (int p) {`,
    ...guard('null'),
    `${INDENT}return ${wave}_lastWave[p];`,
    '}',
    '',
    RULE,
    `bool ${wave}_runFunc (bool c, bool a) {`,
    `${INDENT}int p = ${wave}_runPlayer;`,
    `${INDENT}playergroup target = ${wave}_runTarget;`,
    `${INDENT}int d;`,
    `${INDENT}point gatherPoint = null;`,
    ...(step.createUnits
      ? [`${INDENT}int createCount = 0;`, `${INDENT}point createPoint = null;`]
      : []),
    `${INDENT}int ta = 0;`,
    `${INDENT}int tg = 0;`,
    `${INDENT}int ts = 0;`,
    `${INDENT}int tf = 0;`,
    `${INDENT}int td = 0;`,
    '',
    ...guard('false'),
    `${INDENT}d = PlayerDifficulty(p);`,
    `${INDENT}if (!${wave}_enabled[p]) {`,
    `${INDENT}${INDENT}td = 0;`,
    `${INDENT}${INDENT}if (td > 0) {`,
    `${INDENT}${INDENT}${INDENT}Wait(td, c_timeAI);`,
    `${INDENT}${INDENT}}`,
    `${INDENT}${INDENT}return true;`,
    `${INDENT}}`,
    '',
    ...(step.onceOnly
      ? [
          `${INDENT}if (${wave}_hasRun[p]) {`,
          `${INDENT}${INDENT}Wait(0, c_timeAI);`,
          `${INDENT}${INDENT}return true;`,
          `${INDENT}}`,
          `${INDENT}${wave}_hasRun[p] = true;`,
          '',
        ]
      : []),
    `${INDENT}${ai}_customData[p] = "";`,
    '',
    `${INDENT}ta = 0;`,
  );
  byDifficulty(lines, 'ta', arrival?.durations ?? []);
  lines.push(`${INDENT}tg = 0;`);
  byDifficulty(lines, 'tg', gather?.durations ?? []);
  lines.push(`${INDENT}ts = ta;`);
  if (!arrival?.triggerRunAtEnd) lines.push(...run(arrival?.trigger));
  lines.push(
    `${INDENT}if (tg > 0 && tg < ta) {`,
    `${INDENT}${INDENT}Wait(ta - tg, c_timeAI);`,
    `${INDENT}${INDENT}ts = tg;`,
    `${INDENT}}`,
  );
  if (!gather?.triggerRunAtEnd) lines.push(...run(gather?.trigger));
  lines.push(`${INDENT}AIAttackWaveSetTargetPlayer(p, target);`);
  for (const point of points('TargetPoint'))
    lines.push(`${INDENT}AIAttackWaveSetTargetPoint(p, PointFromId(${point.id}));`);
  lines.push(
    '',
    `${INDENT}gatherPoint = ${ai}_defGather[p];`,
    `${INDENT}AIAttackWaveSetGatherPoint(p, gatherPoint);`,
  );
  for (const point of points('Gather'))
    lines.push(
      `${INDENT}gatherPoint = PointFromId(${point.id});`,
      `${INDENT}AIAttackWaveSetGatherPoint(p, gatherPoint);`,
    );
  lines.push('', `${INDENT}AIAttackWaveClearWaypoints(p);`);
  // Preserve the XML order of ordinary and transport route points.
  for (const point of step.points.filter(
    (point) => point.type === 'Waypoint' || point.type === 'Transport',
  )) {
    const add = `AIAttackWaveAddWaypoint(p, PointFromId(${point.id}), ${point.type === 'Transport' ? 'true' : 'false'});`;
    if (point.active === undefined) lines.push(`${INDENT}${add}`);
    else
      lines.push(
        `${INDENT}if (${point.active.map((level) => `(d == ${level})`).join(' || ')}) {`,
        `${INDENT}${INDENT}${add}`,
        `${INDENT}}`,
      );
  }
  lines.push('');
  const send = [
    `${INDENT}AIAttackWaveSend(p, ts, false);`,
    `${INDENT}${wave}_lastWave[p] = WaveLastCreated();`,
    `${INDENT}${ai}_lastWave[p] = ${wave}_lastWave[p];`,
  ];
  if (step.createUnits) {
    lines.push(`${INDENT}createPoint = gatherPoint;`);
    for (const point of points('Create'))
      lines.push(`${INDENT}createPoint = PointFromId(${point.id});`);
    lines.push('', `${INDENT}${wave}_lastUnits[p] = UnitGroupEmpty();`);
    for (const unit of step.units) {
      lines.push(`${INDENT}createCount = 0;`);
      byDifficulty(lines, 'createCount', unit.counts);
      lines.push(
        `${INDENT}if (createCount > 0) {`,
        `${INDENT}${INDENT}UnitCreate(createCount, "${unit.type}", 0, p, createPoint, PointGetFacing(createPoint));`,
        `${INDENT}${INDENT}AIAttackWaveUseGroup(p, UnitLastCreatedGroup());`,
        `${INDENT}${INDENT}UnitGroupAddUnitGroup(${wave}_lastUnits[p], UnitLastCreatedGroup());`,
        `${INDENT}}`,
        '',
      );
    }
    if (step.units.length === 0) lines.push('');
    lines.push(...run(step.configTrigger));
    if (step.units.length > 0) lines.push(...send);
  } else {
    // Without CreateUnits the AI trains the wave: AIAttackWaveAddUnits takes the difficulty one higher.
    for (const unit of step.units) {
      for (const { level, value } of unit.counts)
        lines.push(`${INDENT}AIAttackWaveAddUnits(${level + 1}, ${value}, "${unit.type}");`);
      lines.push('');
    }
    // Native trigger-only waves retain timing/configuration, without creating a last wave.
    lines.push(...run(step.configTrigger));
    lines.push(...send);
  }
  lines.push(`${INDENT}Wait(ts, c_timeAI);`);
  if (arrival?.triggerRunAtEnd) lines.push(...run(arrival.trigger));
  if (gather?.triggerRunAtEnd) lines.push(...run(gather.trigger));
  lines.push(`${INDENT}tf = 0;`);
  byDifficulty(lines, 'tf', finalWait?.durations ?? []);
  lines.push(
    `${INDENT}if (tf > 0) {`,
    `${INDENT}${INDENT}Wait(tf, c_timeAI);`,
    `${INDENT}}`,
    '',
    `${INDENT}return true;`,
    '}',
    '',
    RULE,
    `void ${wave}_run (int p, playergroup target, bool wait) {`,
    `${INDENT}${wave}_runPlayer = p;`,
    `${INDENT}${wave}_runTarget = PlayerGroupCopy(target);`,
    '',
    `${INDENT}TriggerExecute(${wave}_trigger, false, wait);`,
    '}',
    '',
  );
}
/** The MapScript section "Custom AI Functions", from its first rule to the end of `cai_runall`. */
export function generateCustomAiMapScriptSection(document, options) {
  const ais = document.definitions.map(customAiScriptName);
  const lines = [
    RULE,
    '// Custom AI Functions',
    RULE,
    'string[17] cai_playerAI;',
    '',
    RULE,
    'void InitCustomAI () {',
    `${INDENT}int init_i;`,
    '',
    `${INDENT}for (init_i = 0; init_i <= 16; init_i += 1) {`,
    `${INDENT}${INDENT}cai_playerAI[init_i] = null;`,
    `${INDENT}}`,
    '}',
    '',
  ];
  const byPlayer = (head, call, fail, tail, blank = false) => {
    lines.push(RULE, head, ...guard(fail));
    if (blank) lines.push(`${INDENT}cai_playerAI[p] = ai;`, '');
    for (const ai of ais) lines.push(`${INDENT}if (cai_playerAI[p] == "${ai}") { ${call(ai)} }`);
    if (tail !== undefined) lines.push(`${INDENT}${tail}`);
    lines.push('}', '');
  };
  byPlayer('void cai_start (string ai, int p) {', (ai) => `${ai}_start(p);`, '', undefined, true);
  byPlayer('void cai_setDefGather (int p, point val) {', (ai) => `${ai}_setDefGather(p, val);`, '');
  byPlayer(
    'string cai_getCustomData (int p) {',
    (ai) => `return ${ai}_getCustomData(p);`,
    'null',
    'return null;',
  );
  byPlayer(
    'wave cai_getLastWave (int p) {',
    (ai) => `return ${ai}_getLastWave(p);`,
    'null',
    'return null;',
  );
  byPlayer(
    'void cai_waves_run (int p, playergroup target) {',
    (ai) => `${ai}_waves_run(p, target);`,
    '',
  );
  byPlayer('void cai_waves_enable (int p, bool val) {', (ai) => `${ai}_waves_enable(p, val);`, '');
  lines.push(RULE, 'void cai_waves_stop (string ai) {');
  for (const ai of ais) lines.push(`${INDENT}if (ai == "${ai}") { ${ai}_waves_stop(); }`);
  lines.push('}', '');
  byPlayer(
    'void cai_wave_run (int w, int p, playergroup target, bool wait) {',
    (ai) => `${ai}_wave_run(w, p, target, wait);`,
    '',
  );
  byPlayer(
    'void cai_wave_enable (int w, int p, bool val) {',
    (ai) => `${ai}_wave_enable(w, p, val);`,
    '',
  );
  byPlayer(
    'bool cai_wave_isEnabled (int w, int p) {',
    (ai) => `return ${ai}_wave_isEnabled(w, p);`,
    'false',
    'return false;',
  );
  byPlayer(
    'unitgroup cai_wave_createdUnits (int w, int p) {',
    (ai) => `return ${ai}_wave_createdUnits(w, p);`,
    'null',
    'return null;',
  );
  byPlayer(
    'wave cai_wave_createdWave (int w, int p) {',
    (ai) => `return ${ai}_wave_createdWave(w, p);`,
    'null',
    'return null;',
  );
  lines.push(RULE, 'void cai_startall () {');
  for (const definition of document.definitions) {
    if (definition.sourcePlayer !== undefined)
      lines.push(
        `${INDENT}cai_start("${customAiScriptName(definition)}", ${definition.sourcePlayer});`,
      );
  }
  for (const player of options.campaignPlayers) lines.push(`${INDENT}AICampaignStart(${player});`);
  lines.push(
    '}',
    '',
    RULE,
    'void cai_runall () {',
    `${INDENT}playergroup target = PlayerGroupEmpty();`,
  );
  for (const definition of document.definitions) {
    if (definition.sourcePlayer === undefined || definition.targetPlayers.length === 0) continue;
    lines.push('', `${INDENT}PlayerGroupClear(target);`);
    for (const player of definition.targetPlayers)
      lines.push(`${INDENT}PlayerGroupAdd(target, ${player});`);
    lines.push(`${INDENT}cai_waves_run(${definition.sourcePlayer}, target);`);
  }
  lines.push('}');
  return lines.join('\r\n');
}
//# sourceMappingURL=custom-ai-script.js.map
