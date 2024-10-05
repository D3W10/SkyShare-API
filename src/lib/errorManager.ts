export enum ErrorCode {
    SERVER_ERROR = -1, SUCCESS,
    MISSING_PARAMETER, NO_PARAMETERS,
    INVALID_USERNAME, INVALID_EMAIL,
    INVALID_PASSWORD, INVALID_NEW_USERNAME,
    INVALID_NEW_EMAIL, INVALID_NEW_PASSWORD,
    WRONG_USERPASS, USERNAME_UNAVAILABLE,
    EMAIL_UNAVAILABLE, PHOTO_TOO_BIG,
    INVALID_PHOTO, UNKNOWN_SIGNUP,
    INVALID_REQUEST_TYPE, INVALID_VERIFICATION_TOKEN,
    INVALID_RECOVERY_TOKEN, UNKNOWN_EDIT,
    UNKNOWN_PASSWORD, UNKNOWN_HISTORY
}

const errorList = {
    [ErrorCode.SERVER_ERROR]: "Server error",
    [ErrorCode.SUCCESS]: "Success",
    [ErrorCode.MISSING_PARAMETER]: "Required parameters are missing",
    [ErrorCode.NO_PARAMETERS]: "No parameters were provided",
    [ErrorCode.INVALID_USERNAME]: "Invalid username",
    [ErrorCode.INVALID_EMAIL]: "Invalid email",
    [ErrorCode.INVALID_PASSWORD]: "Invalid password",
    [ErrorCode.INVALID_NEW_USERNAME]: "Invalid new username",
    [ErrorCode.INVALID_NEW_EMAIL]: "Invalid new email",
    [ErrorCode.INVALID_NEW_PASSWORD]: "Invalid new password",
    [ErrorCode.WRONG_USERPASS]: "Wrong username or password",
    [ErrorCode.USERNAME_UNAVAILABLE]: "Username in use",
    [ErrorCode.EMAIL_UNAVAILABLE]: "Email in use",
    [ErrorCode.PHOTO_TOO_BIG]: "Photo too big",
    [ErrorCode.INVALID_PHOTO]: "Invalid photo",
    [ErrorCode.UNKNOWN_SIGNUP]: "Unknown signup error",
    [ErrorCode.INVALID_REQUEST_TYPE]: "Invalid request type",
    [ErrorCode.INVALID_VERIFICATION_TOKEN]: "Invalid verification token",
    [ErrorCode.INVALID_RECOVERY_TOKEN]: "Invalid recovery token",
    [ErrorCode.UNKNOWN_EDIT]: "Unknown edit error",
    [ErrorCode.UNKNOWN_PASSWORD]: "Unknown password error",
    [ErrorCode.UNKNOWN_HISTORY]: "Unknown history error"
}

interface IServerRes {
    code: ErrorCode;
    message: string;
    value?: { [key: string]: any };
}

interface IUserData {
    username: string;
    email: string;
    photo?: string;
    createdAt: Date;
    emailVerified: boolean;
    settings: {
        history: IHistoryEntry[];
        historyEnabled: boolean;
    };
}

interface IHistoryEntry {
    code: string;
    size: number;
    secondary: string;
    type: 0 | 1;
    date: Date;
}

export function getRes(error: ErrorCode, value?: any): IServerRes {
    return { code: error, message: errorList[error], value };
}

export function getUser(user: Parse.User<Parse.Attributes>): IUserData {
    return { username: user.getUsername()!, email: user.getEmail()!, photo: user.get("photo")?.url(), createdAt: user.createdAt, emailVerified: user.get("emailVerified"), settings: { history: user.get("history"), historyEnabled: user.get("historyEnabled") } };
}

export function handleError(error: unknown): [IServerRes, { status: number }] {
    if (error instanceof SyntaxError && error.stack && error.stack.split(/\n/g)[1].includes("JSON.parse")) {
        return [getRes(ErrorCode.MISSING_PARAMETER), { status: 400 }];
    }
    else {
        console.error(error);

        return [getRes(ErrorCode.SERVER_ERROR), { status: 500 }];
    }
}