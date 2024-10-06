import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes, handleError } from "$lib/errorManager";

export async function GET({ params }) {
    try {
        const { code } = params;

        if (!code)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!/^\d{6}$/.test(code))
            return json(getRes(ErrorCode.INVALID_CODE), { status: 400 });

        const transferDoc = await db.collection("channels").doc(code).get();
        if (!transferDoc.exists)
            return json(getRes(ErrorCode.UNEXISTENT_CODE), { status: 400 });

        return json(getRes(ErrorCode.SUCCESS, transferDoc.data()), { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}