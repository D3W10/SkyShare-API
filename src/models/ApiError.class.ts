import type { ErrorList } from "./ErrorList.type";

class ApiError extends Error {
    private _code: ErrorList;

    constructor(code: ErrorList) {
        super(code);
        this._code = code;
    }

    public get code() {
        return this._code;
    }
}

export default ApiError;