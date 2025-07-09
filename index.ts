import Fastify from "fastify";
import { fastifyWebsocket } from "@fastify/websocket";
import { fastifyCors } from "@fastify/cors";
import { fastifyCookie } from "@fastify/cookie";
import { fastifySession } from "@fastify/session";
import services from "./src/services";

const BASE_ROUTE = "/api/v1";
const fastify = Fastify({ trustProxy: true });

fastify.register(fastifyWebsocket);
fastify.register(fastifyCors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
});
fastify.register(fastifyCookie);
fastify.register(fastifySession as any, {
    secret: process.env.SESSION_SECRET,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 5,
        sameSite: "Lax"
    }
});

fastify.register(async fastify => {
    fastify.get(BASE_ROUTE + "/transfer/create", { websocket: true }, services.createTransfer);
    fastify.get(BASE_ROUTE + "/transfer/:code/check", services.checkTransfer);
    fastify.get(BASE_ROUTE + "/transfer/:code", { websocket: true }, services.answerTransfer);
    fastify.get(BASE_ROUTE + "/login", services.initiateLogin);
    fastify.get(BASE_ROUTE + "/login/finalize", services.getAccessToken);
    fastify.get(BASE_ROUTE + "/signup", services.initiateSignup);
    fastify.get(BASE_ROUTE + "/refresh", services.refreshToken);
    fastify.get(BASE_ROUTE + "/credentials", services.getCredentials);
    fastify.get(BASE_ROUTE + "/user/info", services.getBasicUserInfo);
    fastify.put(BASE_ROUTE + "/user/info", services.updateUserInfo);
    fastify.get(BASE_ROUTE + "/history", services.getHistory);
    fastify.post(BASE_ROUTE + "/history", services.pushHistory);
});

fastify.listen({ port: 8020, host: "0.0.0.0" }, err => {
    if (err)
        fastify.log.error(err);
});

declare module "fastify" {
    interface Session {
        oauthState?: string;
        oauthRedirectUri?: string;
        oauthDisplay?: boolean;
    }
}