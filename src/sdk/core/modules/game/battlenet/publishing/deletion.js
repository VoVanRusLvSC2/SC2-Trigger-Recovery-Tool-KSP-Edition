import { randomUUID } from 'node:crypto';
import { BattleNetVfsError } from "../shared/errors.js";
import { checkedPublication } from "../content-sources/vfs-provider.js";
export class BattleNetDeleteOutcomeUnknownError extends BattleNetVfsError {
    operationId;
    constructor(operationId) {
        super('blizzard.battlenet/delete-outcome-unknown', `Deletion may have reached Blizzard. Reconcile operation ${operationId} before retrying.`);
        this.operationId = operationId;
    }
}
export async function deleteBattleNetPublication(options, region, signal, backend) {
    signal.throwIfAborted();
    const publication = Object.freeze(checkedPublication(options.publication));
    const operationId = options.operationId ?? randomUUID();
    if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(operationId))
        throw new Error('Invalid deletion operation ID');
    let reply;
    try {
        reply = await backend(Object.freeze({ region, publication, operationId, signal }));
    }
    catch {
        throw new BattleNetDeleteOutcomeUnknownError(operationId);
    }
    if (!reply || reply.operationId !== operationId || reply.region !== region)
        throw new BattleNetDeleteOutcomeUnknownError(operationId);
    if (reply.status === 'rejected' && typeof reply.reason === 'string' && reply.reason.length > 0 && reply.reason.length <= 4096) {
        throw new BattleNetVfsError('blizzard.battlenet/delete-rejected', `Deletion rejected: ${reply.reason}`);
    }
    if (reply.status !== 'unlinked' || reply.id !== publication.id || reply.version !== publication.version || reply.serverUnlinkVerified !== true) {
        throw new BattleNetDeleteOutcomeUnknownError(operationId);
    }
    return Object.freeze({ status: 'unlinked', region, operationId, id: reply.id, version: reply.version, serverUnlinkVerified: true });
}
//# sourceMappingURL=deletion.js.map