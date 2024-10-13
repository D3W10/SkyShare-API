import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes, handleError } from "$lib/errorManager";

interface IBody {
    answer: RTCSessionDescriptionInit;
}

export async function POST({ request, params }) {
    try {
        const { code } = params;
        const { answer } = await request.json() as IBody;

        if (!code || !answer)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!/^\d{6}$/.test(code))
            return json(getRes(ErrorCode.INVALID_CODE), { status: 400 });

        const transferDoc = await db.collection("channels").doc(code).get();
        if (!transferDoc.exists)
            return json(getRes(ErrorCode.UNEXISTENT_CODE), { status: 400 });

        transferDoc.ref.set({ answer }, { merge: true });

        return json(getRes(ErrorCode.SUCCESS), { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}