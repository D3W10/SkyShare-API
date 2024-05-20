export enum ErrorCode {
    MISSING_PARAMETER = 1, NO_PARAMETERS,
    INVALID_USERNAME, INVALID_EMAIL,
    INVALID_PASSWORD, INVALID_NEW_USERNAME,
    INVALID_NEW_EMAIL, INVALID_NEW_PASSWORD,
    WRONG_USERPASS, USERNAME_UNAVAILABLE,
    EMAIL_UNAVAILABLE, PHOTO_TOO_BIG,
    INVALID_PHOTO, UNKNOWN_SIGNUP,
    INVALID_REQUEST_TYPE, INVALID_RECOVERY_TOKEN,
    UNKNOWN_EDIT
}

const errorList =  {
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
    [ErrorCode.INVALID_RECOVERY_TOKEN]: "Invalid recovery token",
    [ErrorCode.UNKNOWN_EDIT]: "Unknown edit error"
}

export function getError(error: ErrorCode) {
    return { code: error, message: errorList[error] };
}

export function getSuccess() {
    return { code: 0, message: "Success" };
}

export function getServerError() {
    return { code: -1, message: "Server error" };
}