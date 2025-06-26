import crypto from "crypto";
import jwt from "jsonwebtoken";
import dataLayer from "./data";
import { handleHttp, handleWs } from "./handleErrors";
import ApiError from "./models/ApiError.class";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { ErrorList } from "./models/ErrorList.type";

const TIMEOUT = 600000, SCOPE = "openid profile email";
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

function parseMsg<T = { [key: string]: any }>(msg: string) {
    let json: { type: string, data: T };

    try {
        json = JSON.parse(msg);
    }
    catch {
        throw new ApiError("invalidData");
    }

    if (!json.type)
        throw new ApiError("invalidData");

    json.data ??= {} as T;

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

const createTransfer = (socket: WebSocket, request: FastifyRequest) => {
    let stage = 0, code: string | undefined, timeout: NodeJS.Timeout, unsubscribe: () => unknown | undefined;

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

            unsubscribe = dataLayer.subscribe(code, async d => {
                if (!code) return;

                if (d.type === "answer" && stage === 1) {
                    stage++;
                    clearTimeout(timeout);

                    const answer = await dataLayer.getAnswer(code);
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
        else if (type === "offer" && stage === 1) {
            if (!code || !data.offer) return;

            dataLayer.setOffer(code, data.offer);
        }
        else
            close("error", undefined, "miscommunication");
    }, socket);

    socket.on("close", () => {
        if (code) {
            dataLayer.removeTransfer(code);
            dataLayer.notify(code, "receiver", { type: "end" });
        }
        if (timeout)
            clearTimeout(timeout);

        unsubscribe?.();
    });
};

const checkTransfer = (request: FastifyRequest, reply: FastifyReply) => handleHttp(async () => {
    const { code } = request.params as { code: string };

    return { status: await dataLayer.hasTransfer(code) };
}, reply);

const answerTransfer = (socket: WebSocket, request: FastifyRequest) => {
    let stage = 0, code = (request.params as { code: string }).code, unsubscribe: () => unknown | undefined;

    handleWs(async (message, reply, close) => {
        const { type, data } = parseMsg<{ answer?: RTCSessionDescriptionInit, ice?: RTCIceCandidate }>(message.toString());

        if (type === "offer" && stage === 0) {
            stage++;

            const offer = await dataLayer.getOffer(code);
            if (offer)
                reply("offer", { offer });
        }
        else if (type === "answer" && stage === 1) {
            const answer = data.answer;
            if (!answer)
                return close("error", undefined, "missingData");

            stage++;
            dataLayer.setAnswer(code, answer);
            dataLayer.notify(code, "sender", { type: "answer" });

            unsubscribe = dataLayer.subscribe(code, async d => {
                if (d.type === "ice" && stage === 2)
                    reply("ice", { ice: d.ice });
                else if (d.type === "end")
                    close("end", undefined, "senderEnded");
            }, "receiver");
        }
        else if (type === "ice" && stage === 2)
            dataLayer.notify(code, "sender", { type: "ice", ice: data.ice });
        else
            close("error", undefined, "miscommunication");
    }, socket);

    socket.on("close", () => {
        if (code) {
            dataLayer.removeAnswer(code);
            dataLayer.notify(code, "sender", { type: "disconnect" });
        }

        unsubscribe?.();
    });
};

const initiateLogin = (request: FastifyRequest, reply: FastifyReply) => handleHttp(async () => initiateSignin(request, true), reply);

interface AccessTokenQuery {
    code: string;
    state: string;
    error?: string;
}

const getAccessToken = (request: FastifyRequest<{ Querystring: AccessTokenQuery }>, reply: FastifyReply) => handleHttp(async () => {
    const { code, state, error } = request.query;
    const redirectUri = request.session.oauthRedirectUri, display = request.session.oauthDisplay;
    const throwError = (code: ErrorList) => {
        if (display)
            throw new ApiError(code);
        else
            return redirectUri + "?code=" + code;
    }

    delete request.session.oauthRedirectUri;
    delete request.session.oauthDisplay;

    const storedState = request.session.oauthState;
    if (!state || state !== storedState) {
        delete request.session.oauthState;
        return throwError("stateMismatch");
    }

    delete request.session.oauthState;

    if (error || !code || !redirectUri)
        return throwError("authenticationFailed");

    const query = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.CASDOOR_CLIENT_ID!,
        client_secret: process.env.CASDOOR_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.CASDOOR_REDIRECT_URI!
    });

    const tokenRes = await fetch(`${process.env.CASDOOR_ENDPOINT}api/login/oauth/access_token?${query.toString()}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    }), tokenData = await tokenRes.json() as { access_token: string, refresh_token: string };

    const payload = jwt.verify(tokenData.access_token, process.env.JWT_SECRET!, { algorithms: ["RS256"], });
    if (typeof payload === "string")
        return throwError("authenticationFailed");

    if (display)
        return {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_on: payload.exp ?? Date.now()
        };
    else {
        const resQuery = new URLSearchParams({
            code: "success",
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_on: (payload.exp ?? Date.now()).toString()
        });

        return redirectUri + "?" + resQuery.toString();
    }
}, reply);

const initiateSignup = (request: FastifyRequest, reply: FastifyReply) => handleHttp(async () => initiateSignin(request, false), reply);

interface RefreshTokenQuery {
    refreshToken: string;
}

const refreshToken = (request: FastifyRequest<{ Querystring: RefreshTokenQuery }>, reply: FastifyReply) => handleHttp(async () => {
    if (!request.query.refreshToken)
        throw new ApiError("missingData");

    const query = new URLSearchParams({
        grant_type: "authorization_code",
        refresh_token: request.query.refreshToken,
        scope: SCOPE,
        client_id: process.env.CASDOOR_CLIENT_ID!,
        client_secret: process.env.CASDOOR_CLIENT_SECRET!
    });

    const tokenRes = await fetch(`${process.env.CASDOOR_ENDPOINT}api/login/oauth/refresh_token?${query.toString()}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    });

    if (tokenRes.status !== 200)
        throw new ApiError("unableToRefreshToken");

    const tokenData = await tokenRes.json() as { access_token: string, refresh_token: string };

    const payload = jwt.verify(tokenData.access_token, process.env.JWT_SECRET!, { algorithms: ["RS256"], });
    if (typeof payload === "string")
        throw new ApiError("unableToRefreshToken");

    return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_on: payload.exp ?? Date.now()
    };
}, reply);

const getCredentials = (request: FastifyRequest, reply: FastifyReply) => handleHttp(async () => {
    const unixTime = Math.floor(Date.now() / 1000) + +(process.env.COTURN_TTL ?? "60");
    const username = unixTime.toString();
    const hmac = crypto.createHmac("sha1", process.env.COTURN_SECRET ?? "");
    hmac.update(username);

    return {
        username,
        password: hmac.digest("base64")
    };
}, reply);

function initiateSignin(request: FastifyRequest, login: boolean) {
    const state = crypto.randomBytes(16).toString("hex");
    const { redirect_uri, display } = request.query as { redirect_uri?: string, display?: string };
    if (!redirect_uri)
        throw new ApiError("missingData");

    request.session.oauthState = state;
    request.session.oauthRedirectUri = redirect_uri;
    request.session.oauthDisplay = (display ?? false) === "true";

    const resQuery = new URLSearchParams({
        client_id: process.env.CASDOOR_CLIENT_ID!,
        response_type: "code",
        redirect_uri: process.env.CASDOOR_REDIRECT_URI!,
        scope: SCOPE,
        state
    });

    return `${process.env.CASDOOR_ENDPOINT}${login ? "login" : "signup"}/oauth/authorize?${resQuery.toString()}`;
}

export default {
    createTransfer,
    checkTransfer,
    answerTransfer,
    initiateLogin,
    getAccessToken,
    initiateSignup,
    refreshToken,
    getCredentials
}