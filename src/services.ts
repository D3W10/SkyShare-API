import dataLayer from "./data";
import { handleHttp, handleWs } from "./handleErrors";
import ApiError from "./models/ApiError.class";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import crypto from 'crypto';

const TIMEOUT = 600000;
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const secret = process.env.COTURN_SECRET;
const ttl = process.env.COTURN_TTL;

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
    let stage = 0, code: string | undefined, timeout: NodeJS.Timeout, subscription: () => unknown | undefined;

    handleWs(async (message, reply, close) => {
        const { type, data } = parseMsg<{ offer?: RTCSessionDescriptionInit, ice?: RTCIceCandidate }>(message.toString());

        if (type === "offer" && stage === 0) {
            const offer = data.offer;
            if (!offer)
                return close("error", undefined, "missingData");

            code = await generateUniqueCode();
            stage++;

            dataLayer.createTransfer(code, offer);
            reply("code", { code, timeout: TIMEOUT });

            const timeoutClose = () => close("timeout", undefined, "timeoutReached");
            timeout = setTimeout(timeoutClose, TIMEOUT);

            subscription = dataLayer.subscribe(code, async d => {
                if (!code) return;

                if (d.type === "answer" && stage === 1) {
                    stage++;
                    clearTimeout(timeout);

                    const answer = await dataLayer.obtainAnswer(code);
                    if (answer)
                        reply("answer", { answer });
                }
                else if (d.type === "ice" && stage === 2)
                    reply("ice", { ice: d.ice });
                else if (d.type === "disconnect" && stage === 2) {
                    stage--;
                    timeout = setTimeout(timeoutClose, TIMEOUT);
                    reply("disconnect");
                }
            }, "sender");
        }
        else if (type === "ice" && stage === 2) {
            if (!code) return;

            dataLayer.notify(code, "receiver", { type: "ice", ice: data.ice });
        }
    }, socket);

    socket.on("close", () => {
        if (code) {
            dataLayer.removeTransfer(code);
            dataLayer.notify(code, "receiver", { type: "end" });
        }
        if (timeout)
            clearTimeout(timeout);

        subscription?.();
    });
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
            dataLayer.notify(code, "sender", { type: "answer" });

            subscription = dataLayer.subscribe(code, async d => {
                if (d.type === "ice" && stage === 1)
                    reply("ice", { ice: d.ice });
                else if (d.type === "end")
                    close("end", undefined, "senderEnded");
            }, "receiver");
        }
        else if (type === "ice" && stage === 1)
            dataLayer.notify(code, "sender", { type: "ice", ice: data.ice });
    }, socket);

    socket.on("close", () => {
        if (code) {
            dataLayer.removeAnswer(code);
            dataLayer.notify(code, "sender", { type: "disconnect" });
        }

        subscription?.();
    });
}

function getCredentials(request: FastifyRequest, reply: FastifyReply) {
    const unixTime = Math.floor(Date.now() / 1000) + ttl;
    const username = unixTime.toString();

    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const password = hmac.digest('base64');

    reply.send({ username, password });
}

export default {
    createTransfer,
    checkTransfer,
    answerTransfer,
    getCredentials
}