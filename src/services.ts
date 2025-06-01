import dataLayer from "./data";
import { handleHttp, handleWs } from "./handleErrors";
import ApiError from "./models/ApiError.class";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";

const TIMEOUT = 600000;
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

function parseMsg<T = any>(msg: string) {
    let json: { type: string, data: T };

    try {
        json = JSON.parse(msg);
    }
    catch {
        throw new ApiError("invalidData");
    }

    if (!json.type || !json.data)
        throw new ApiError("invalidData");

    return json;
}

async function generateUniqueCode() {
    let code = "", invalid = false, iterations = 0;

    do {
        code = generateCode();
        iterations++;
    }
    while ((invalid = await dataLayer.hasTransfer(code)) && iterations < 100);

    if (invalid)
        throw new ApiError("unableToGenerateCode");

    return code;
}

function createTransfer(socket: WebSocket) {
    let stage = 0, code: string | undefined, subscription: () => unknown | undefined;

    handleWs(async (message, reply, close) => {
        let timeout: NodeJS.Timeout;
        const { type, data } = parseMsg<{ offer?: RTCSessionDescriptionInit, ice?: RTCIceCandidate }>(message.toString());

        if (type === "offer" && stage === 0) {
            const offer = data.offer;
            if (!offer)
                return close("error", undefined, "missingData");

            code = await generateUniqueCode();
            stage++;

            dataLayer.createTransfer(code, offer);
            reply("code", { code, timeout: TIMEOUT });

            timeout = setTimeout(() => {
                console.log(`Timeout reached for code ${code}, closing LISTEN`);
                close("timeout", undefined, "unknownError");
            }, TIMEOUT);

            subscription = dataLayer.subscribe(code, async d => {
                if (!code) return;

                if (stage === 1) {
                    stage++;

                    const answer = await dataLayer.obtainAnswer(code);
                    if (answer)
                        reply("answer", { answer });
                }
                else if (stage === 2 && d.ice)
                    reply("ice", { ice: d.ice });
            }, "sender");
        }
        else if (type === "ice" && stage === 2) {
            if (!code) return;

            dataLayer.notify(code, "receiver", { ice: data.ice });
        }
    }, socket);

    socket.on("close", () => subscription?.());
}

function checkTransfer(request: FastifyRequest, rep: FastifyReply) {
    handleHttp(async reply => {
        const { code } = request.params as { code: string };

        reply("success", { status: await dataLayer.hasTransfer(code) });
    }, rep);
}

function answerTransfer(socket: WebSocket, request: FastifyRequest) {
    let stage = 0, code: string | undefined, subscription: () => unknown | undefined;

    handleWs(async (message, reply, close) => {
        code = (request.params as { code: string }).code;
        const { type, data } = parseMsg<{ answer?: RTCSessionDescriptionInit, ice?: RTCIceCandidate }>(message.toString());

        if (type === "answer" && stage === 0) {
            const answer = data.answer;
            if (!answer)
                return close("error", undefined, "missingData");

            stage++;
            dataLayer.setAnswer(code, answer);
            dataLayer.notify(code, "sender");

            subscription = dataLayer.subscribe(code, async d => {
                if (stage === 1 && d.ice)
                    reply("ice", { ice: d.ice });
            }, "receiver");
        }
        else if (type === "ice" && stage === 1)
            dataLayer.notify(code, "sender", { ice: data.ice });
    }, socket);

    socket.on("close", () => subscription?.());
}

function getCredentials(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ username: "danielnunes", password: "123456" });
}

export default {
    createTransfer,
    checkTransfer,
    answerTransfer,
    getCredentials
}