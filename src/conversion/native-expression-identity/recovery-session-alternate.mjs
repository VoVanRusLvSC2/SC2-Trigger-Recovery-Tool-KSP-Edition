import { RecoverySession as OriginalRecoverySession } from './recovery-session-alternate-2.mjs';

import { FunctionCandidateIndex } from './function-candidates.mjs';

export { recoverySessionFor } from './recovery-session-alternate-2.mjs';

// Preserve the original element-store registry for every imported AST helper.

export class RecoverySession extends OriginalRecoverySession {
  constructor(program, libraries, plan) {
    super(program, libraries, plan);
    this.candidates = new FunctionCandidateIndex(libraries);
  }
}
