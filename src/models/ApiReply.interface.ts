import type { ErrorList } from "./ErrorList.type";

export interface ApiReply {
    code: ErrorList;
    data?: {
        [key: string]: any;
    };
}