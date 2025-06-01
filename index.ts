import Fastify from "fastify";
import fyWebSocket from "@fastify/websocket";
import services from "./src/services";

const fastify = Fastify();

fastify.register(fyWebSocket);

fastify.register(async fastify => {
    fastify.get("/transfer/create", { websocket: true }, services.createTransfer);
    fastify.get("/transfer/:code/check", services.checkTransfer);
    fastify.get("/transfer/:code", { websocket: true }, services.answerTransfer);
    fastify.get("/credentials", services.getCredentials);
});

fastify.listen({ port: 8020, host: "0.0.0.0" }, err => {
    if (err)
        fastify.log.error(err);
});