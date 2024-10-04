import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes } from "$lib/errorManager";

export async function GET() {
    try {
        let transferCode;
        const query = await db.collection("channels").get();
        const currentChannels = query.docs.map(doc => doc.id);

        do {
            transferCode = generateCode();
        }
        while (currentChannels.includes(transferCode));

        await db.collection("channels").doc(transferCode).set({
            createdAt: new Date()
        });

        return json(getRes(ErrorCode.SUCCESS, transferCode), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}

function generateCode() {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}