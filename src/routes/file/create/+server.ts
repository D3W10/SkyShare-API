import crypto from "crypto";
import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes, handleError } from "$lib/errorManager";

interface IBody {
    offer: RTCSessionDescriptionInit;
}

export async function POST({ request }) {
    try {
        const { offer } = await request.json() as IBody;

        if (!offer)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });

        let transferCode;
        const token = crypto.randomUUID();
        const query = await db.collection("channels").get();
        const currentChannels = query.docs.map(doc => doc.id);

        do transferCode = generateCode();
        while (currentChannels.includes(transferCode));

        await db.collection("channels").doc(transferCode).set({
            offer,
            createdAt: new Date()
        });

        await db.collection("tokens").doc(transferCode).set({ token });

        return json(getRes(ErrorCode.SUCCESS, { code: transferCode, token }), { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}

function generateCode() {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}