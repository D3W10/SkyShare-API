import type { ErrorCause } from "./ErrorCause.type";
import type { ErrorList } from "./ErrorList.type";

export const errorMapper: Record<ErrorList, ErrorCause> = {
    success: "success",
    invalidData: "userError",
    unableToGenerateCode: "serverError",
    missingData: "userError",
    unknownError: "serverError"
};