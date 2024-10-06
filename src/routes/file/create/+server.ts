import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes, handleError } from "$lib/errorManager";

interface IBody {
    files: {
        name: string;
        size: number;
    }[];
    offer: RTCSessionDescriptionInit;
    message: string;
    from: string;
}

export async function POST({ request }) {
    try {
        const { files, offer, message, from } = await request.json() as IBody;

        if (!files || !offer || files.length == 0 || files.some(file => !file.name || !file.size))
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });

        let transferCode;
        const query = await db.collection("channels").get();
        const currentChannels = query.docs.map(doc => doc.id);

        do {
            transferCode = generateCode();
        }
        while (currentChannels.includes(transferCode));

        await db.collection("channels").doc(transferCode).set({
            files,
            offer,
            message: message || "",
            from: from || "",
            createdAt: new Date()
        });

        return json(getRes(ErrorCode.SUCCESS, transferCode), { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}

function generateCode() {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}