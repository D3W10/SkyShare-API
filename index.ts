import Fastify from "fastify";
import fyWebSocket from "@fastify/websocket";
import services from "./src/services";

const BASE_ROUTE = "/api/v1";
const fastify = Fastify();

fastify.register(fyWebSocket);

fastify.register(async fastify => {
    fastify.get(BASE_ROUTE + "/transfer/create", { websocket: true }, services.createTransfer);
    fastify.get(BASE_ROUTE + "/transfer/:code/check", services.checkTransfer);
    fastify.get(BASE_ROUTE + "/transfer/:code", { websocket: true }, services.answerTransfer);
    fastify.get(BASE_ROUTE + "/credentials", services.getCredentials);
});

fastify.listen({ port: 8020, host: "0.0.0.0" }, err => {
    if (err)
        fastify.log.error(err);
});