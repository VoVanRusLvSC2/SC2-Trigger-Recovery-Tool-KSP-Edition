/** Multiple authenticated accounts/regions behind one registered battlenet: VFS scheme. */
import { randomUUID } from 'node:crypto';
import { BattleNetVfsError, BattleNetVfsProvider, normalizeBattleNetRegion, } from "../content-sources/vfs-provider.js";
export { BattleNetPublishOutcomeUnknownError, BattleNetPublishRejectedError } from "../publishing/publisher.js";
const keyOf = (accountId, region) => JSON.stringify([accountId, region]);
const failure = (code, message) => new BattleNetVfsError(`blizzard.battlenet/${code}`, message);
const joinedSignal = (...signals) => AbortSignal.any(signals.filter((signal) => signal !== undefined));
function identity(value, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f]/u.test(value)) {
        throw failure('invalid-session', `${label} must be a non-empty bounded identity`);
    }
    return value;
}
/** Register this provider instead of a single-profile BattleNetVfsProvider. */
export class BattleNetAccountsProvider {
    options;
    id = 'blizzard.starcraft2.vfs.battlenet-accounts';
    scheme = 'battlenet';
    supportedRegions;
    lifetime = new AbortController();
    records = new Map();
    pending = new Set();
    loginTasks = new Map();
    retiring = new Set();
    loggedOutAt = new Map();
    loggedOutAllAt = 0;
    sequence = 0;
    disposal;
    constructor(options) {
        this.options = options;
        this.supportedRegions = Object.freeze([...new Set(options.authentication.supportedRegions.map(region => {
                const normalized = normalizeBattleNetRegion(region);
                if (region !== normalized)
                    throw failure('invalid-region', 'Backend regions must use canonical us/eu/kr identifiers');
                return normalized;
            }))]);
    }
    /** Safe for a selector UI: never exposes API objects, authentication tickets or cookies. */
    listConnections() {
        return Object.freeze([...this.records.values()].filter(record => !record.signal.aborted)
            .map(record => record.info)
            .sort((a, b) => a.accountName.localeCompare(b.accountName) || a.region.localeCompare(b.region)));
    }
    login(options) {
        const task = this.performLogin(options);
        this.loginTasks.set(task, { accountId: options.accountId, region: options.region });
        void task.then(() => this.loginTasks.delete(task), () => this.loginTasks.delete(task));
        return task;
    }
    async performLogin(options) {
        this.lifetime.signal.throwIfAborted();
        options.signal?.throwIfAborted();
        const region = normalizeBattleNetRegion(options.region);
        if (!this.supportedRegions.includes(region)) {
            throw failure('login-region-unavailable', `The native login backend does not support ${region}`);
        }
        if (options.accountId !== undefined) {
            identity(options.accountId, 'accountId');
            const current = this.records.get(keyOf(options.accountId, region));
            if (current && !current.signal.aborted)
                return current.info;
        }
        const pending = {
            sequence: ++this.sequence, region, accountId: options.accountId, controller: new AbortController(),
        };
        this.pending.add(pending);
        const signal = joinedSignal(this.lifetime.signal, options.signal, pending.controller.signal);
        let session;
        let adopted = false;
        try {
            session = await this.options.authentication.login({
                region, signal, browserSessionId: `modkit-battlenet-${randomUUID()}`,
                ...(options.accountId === undefined ? {} : { expectedAccountId: options.accountId }),
                ...(options.ticket === undefined ? {} : { ticket: options.ticket }),
            });
            signal.throwIfAborted();
            session.signal?.throwIfAborted();
            const accountId = identity(session.accountId, 'accountId');
            const profileId = identity(session.profileId, 'profileId');
            if (session.region !== region)
                throw failure('region-mismatch', 'Login returned a session for a different region');
            if (options.accountId !== undefined && accountId !== options.accountId) {
                throw failure('account-mismatch', 'The browser signed into a different account; the requested account was not replaced');
            }
            const assertAdoptable = () => {
                signal.throwIfAborted();
                session?.signal?.throwIfAborted();
                if (this.loggedOutAllAt > pending.sequence || (this.loggedOutAt.get(keyOf(accountId, region)) ?? 0) > pending.sequence ||
                    (this.loggedOutAt.get(keyOf(accountId, '*')) ?? 0) > pending.sequence) {
                    throw failure('login-cancelled', 'This account was logged out while authentication was pending');
                }
            };
            assertAdoptable();
            const key = keyOf(accountId, region);
            const current = this.records.get(key);
            if (current && !current.signal.aborted)
                return current.info;
            if (current) {
                await this.release(current);
                assertAdoptable();
                // Another login may have completed while the expired connection was closing.
                const replacement = this.records.get(key);
                if (replacement && replacement !== current && !replacement.signal.aborted)
                    return replacement.info;
            }
            const info = Object.freeze({
                accountId, profileId, region,
                accountName: identity(session.accountName, 'accountName'),
                profileName: identity(session.profileName, 'profileName'),
            });
            const lifetime = new AbortController();
            const record = {
                info, session, lifetime, mounts: new Set(),
                signal: joinedSignal(this.lifetime.signal, lifetime.signal, session.signal),
                provider: new BattleNetVfsProvider({
                    cacheDirectory: this.options.cacheDirectory,
                    ...(this.options.limits === undefined ? {} : { limits: this.options.limits }),
                    ...(this.options.maxArchiveBytes === undefined ? {} : { maxArchiveBytes: this.options.maxArchiveBytes }),
                    ...(this.options.maxCataloguePages === undefined ? {} : { maxCataloguePages: this.options.maxCataloguePages }),
                    api: session.api, accountId, region, profileKey: JSON.stringify([accountId, profileId]),
                }),
            };
            this.records.set(key, record);
            adopted = true;
            // The ticket leaves with the caller that asked for the login and is never held here.
            return session.webTicket === undefined ? info : Object.freeze({ ...info, webTicket: session.webTicket });
        }
        finally {
            this.pending.delete(pending);
            if (session && !adopted)
                await session.close();
        }
    }
    /** What this account has left to publish into, in the selected region. */
    async storage(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        return record.provider.storage(region, joinedSignal(options.signal, record.signal));
    }
    /** Ask the server what a publication name is worth, before a first publication is compiled. */
    async prepublish(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        return record.provider.prepublish(region, options.names, joinedSignal(options.signal, record.signal));
    }
    /** Submit a saved map/mod through the selected native account/region connection. */
    async publish(options) {
        this.lifetime.signal.throwIfAborted();
        options.signal?.throwIfAborted();
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Log in to this account and region before publishing');
        return record.provider.publish({ ...options, region, signal: joinedSignal(options.signal, record.signal) });
    }
    async deletePublication(options) {
        this.lifetime.signal.throwIfAborted();
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        return record.provider.deletePublication({ ...options, region, signal: joinedSignal(options.signal, record.signal) });
    }
    async isCached(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        return record.provider.isCached(region, options.publication, joinedSignal(options.signal, record.signal));
    }
    /** The local file of an already-downloaded publication, for a host that reveals or opens it. */
    async cachedArchivePath(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        return record.provider.cachedArchivePath(region, options.publication, joinedSignal(options.signal, record.signal));
    }
    async download(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        await record.provider.download(region, options.publication, joinedSignal(options.signal, record.signal));
    }
    async clearCache(options) {
        const accountId = identity(options.accountId, 'accountId');
        const region = normalizeBattleNetRegion(options.region);
        const record = this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted)
            throw failure('login-required', 'Sign in to the selected account and region');
        await record.provider.clearCache(region, options.publication, joinedSignal(options.signal, record.signal));
    }
    /** Canonical URI containing the non-secret account identity, never a token. */
    uri(options) {
        const accountId = identity(options.accountId, 'accountId');
        const url = new URL(`battlenet://${normalizeBattleNetRegion(options.region)}/${options.scope ?? 'mine'}`);
        url.searchParams.set('account', accountId);
        if (options.name !== undefined)
            url.searchParams.set('name', options.name);
        return url.href;
    }
    async open(uri, context) {
        this.lifetime.signal.throwIfAborted();
        context.signal?.throwIfAborted();
        // Preserve the base provider's rejection of dot segments before URL canonicalization.
        if (/(?:^|[/\\])\.{1,2}(?:[/\\?#]|$)/u.test(decodeURIComponent(uri))) {
            throw failure('invalid-uri', 'Dot segments are not allowed');
        }
        const url = new URL(uri);
        if (url.protocol !== 'battlenet:' || url.username || url.password || url.port || url.hash ||
            url.searchParams.getAll('account').length > 1) {
            throw failure('invalid-uri', 'Expected a Battle.net URI with a single account selector');
        }
        const region = normalizeBattleNetRegion(url.hostname);
        let accountId = url.searchParams.get('account');
        if (accountId === null) {
            const connections = this.listConnections().filter(connection => connection.region === region);
            if (connections.length > 1)
                throw failure('account-required', 'Choose an account with ?account=<accountId>');
            accountId = connections[0]?.accountId ?? null;
        }
        if (accountId === '')
            throw failure('invalid-uri', 'The account selector must not be empty');
        const record = accountId === null ? undefined : this.records.get(keyOf(accountId, region));
        if (!record || record.signal.aborted) {
            throw failure('login-required', `Log in to the selected account in ${region} before opening its catalogue`);
        }
        url.hostname = region;
        url.searchParams.set('account', record.info.accountId);
        const signal = joinedSignal(context.signal, record.signal);
        const inner = await record.provider.open(url.href, { limits: context.limits, signal });
        try {
            signal.throwIfAborted();
        }
        catch (error) {
            await inner.dispose();
            throw error;
        }
        const mount = {
            id: inner.id, rootUri: inner.rootUri, revision: inner.revision,
            stat: (path, activeSignal) => inner.stat(path, activeSignal),
            list: (path, activeSignal) => inner.list(path, activeSignal),
            open: (path, activeSignal) => inner.open(path, activeSignal),
            dispose: () => { record.mounts.delete(mount); return inner.dispose(); },
        };
        record.mounts.add(mount);
        return mount;
    }
    /** Omit region to disconnect this account from all servers. Other accounts stay connected. */
    async logout(accountId, region) {
        identity(accountId, 'accountId');
        const normalized = region === undefined ? undefined : normalizeBattleNetRegion(region);
        this.loggedOutAt.set(keyOf(accountId, normalized ?? '*'), ++this.sequence);
        for (const pending of this.pending) {
            if (pending.accountId === accountId && (normalized === undefined || pending.region === normalized)) {
                pending.controller.abort(failure('login-cancelled', 'Login was cancelled by logout'));
            }
        }
        const tasks = [...this.loginTasks].filter(([, request]) => request.accountId === accountId &&
            (normalized === undefined || (request.region === 'na' ? 'us' : request.region) === normalized)).map(([task]) => task);
        try {
            await this.releaseMany([...new Set([...this.records.values(), ...this.retiring])].filter(record => record.info.accountId === accountId &&
                (normalized === undefined || record.info.region === normalized)));
        }
        finally {
            await Promise.allSettled(tasks);
        }
        // A sign-out is the one moment a remembered sign-in must go; closing the app is not.
        await this.options.authentication.forget?.(normalized);
    }
    /** Disconnect every account and cancel pending logins. The provider can be used to log in again. */
    async logoutAll() {
        await this.closeAll();
        await this.options.authentication.forget?.();
    }
    async closeAll() {
        this.loggedOutAllAt = ++this.sequence;
        const tasks = [...this.loginTasks.keys()];
        for (const pending of this.pending)
            pending.controller.abort(failure('login-cancelled', 'All Battle.net sessions were closed'));
        try {
            await this.releaseMany([...new Set([...this.records.values(), ...this.retiring])]);
        }
        finally {
            await Promise.allSettled(tasks);
        }
    }
    dispose() {
        if (this.disposal)
            return this.disposal;
        this.disposal = Promise.resolve().then(() => this.closeAll());
        this.lifetime.abort(failure('accounts-disposed', 'Battle.net accounts provider is disposed'));
        return this.disposal;
    }
    release(record) {
        if (record.closing)
            return record.closing;
        this.retiring.add(record);
        // Install the shared close promise before abort listeners can re-enter logout/dispose.
        record.closing = Promise.resolve().then(async () => {
            const results = await Promise.allSettled([
                ...[...record.mounts].map(mount => Promise.resolve().then(() => mount.dispose())),
                record.provider.dispose(),
                Promise.resolve().then(() => record.session.close()),
            ]);
            record.mounts.clear();
            const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
            if (errors.length)
                throw new AggregateError(errors, 'Battle.net session cleanup failed');
        }).finally(() => this.retiring.delete(record));
        record.lifetime.abort(failure('logged-out', 'This Battle.net account/region connection was closed'));
        const key = keyOf(record.info.accountId, record.info.region);
        if (this.records.get(key) === record)
            this.records.delete(key);
        return record.closing;
    }
    async releaseMany(records) {
        const results = await Promise.allSettled(records.map(record => this.release(record)));
        const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
        if (errors.length)
            throw new AggregateError(errors, 'Some Battle.net connections failed to close');
    }
}
//# sourceMappingURL=account-provider.js.map