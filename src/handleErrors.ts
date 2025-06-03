import ApiError from "./models/ApiError.class";
import { errorMapper } from "./models/errorMapper.const";
import type { FastifyReply } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { RawData } from "ws";
import type { ErrorCause } from "./models/ErrorCause.type";
import type { ErrorList } from "./models/ErrorList.type";
import type { ApiReply } from "./models/ApiReply.interface";

interface WsApiReply extends ApiReply {
    type: string;
}

const httpCodeMap: Record<ErrorCause, number> = {
    success: 200,
    userError: 400,
    serverError: 500
};

const wsCodeMap: Record<ErrorCause, number> = {
    success: 1000,
    userError: 1003,
    serverError: 1003
};

export async function handleHttp(func: (reply: (code: ErrorList, data?: any) => unknown) => unknown, reply: FastifyReply) {
    try {
        await func(
            (code, data) => {
                reply.header("Access-Control-Allow-Origin", "*");
                reply.send({ code, data } satisfies ApiReply)
            }
        );
    }
    catch (err) {
        const apiError = err instanceof ApiError;
        const httpCode = apiError ? httpCodeMap[errorMapper[err.code]] : 500;

        console.error(err);
        reply.header("Access-Control-Allow-Origin", "*");
        reply.code(httpCode).send({ code: apiError ? err.code : "unknown" } satisfies ApiReply);
    }
}

export async function handleWs(func: (message: RawData, reply: (type: string, data?: any, code?: ErrorList) => unknown, close: (type: string, data?: any, code?: ErrorList) => unknown) => unknown, socket: WebSocket) {
    socket.on("message", async message => {
        try {
            await func(
                message,
                (type, data, code = "success") => socket.send(JSON.stringify({ code, type, data } satisfies WsApiReply)),
                (type, data, code = "success") => socket.close(wsCodeMap[errorMapper[code]], JSON.stringify({ code, type, data } satisfies WsApiReply))
            );
        }
        catch (err) {
            const apiError = err instanceof ApiError;
            const wsCode = apiError ? wsCodeMap[errorMapper[err.code]] : 1003;

            console.error(err);
            socket.close(wsCode, JSON.stringify({ code: apiError ? err.code : "unknown", type: "error" } satisfies WsApiReply));
        }
    });
}