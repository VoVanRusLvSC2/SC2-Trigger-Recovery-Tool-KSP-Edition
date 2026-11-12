export class BattleNetVfsError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'BattleNetVfsError';
    }
}
//# sourceMappingURL=errors.js.map