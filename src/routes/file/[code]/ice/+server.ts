import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { ErrorCode, getRes, handleError } from "$lib/errorManager";

interface IBody {
    token: string;
    candidate: RTCIceCandidateInit;
}

export async function POST({ request, params }) {
    try {
        const { code } = params;
        const { candidate, token } = await request.json() as IBody;

        if (!code || !candidate || !token)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!/^\d{6}$/.test(code))
            return json(getRes(ErrorCode.INVALID_CODE), { status: 400 });
        else if (!candidate.candidate || !candidate.sdpMid || !candidate.sdpMLineIndex)
            return json(getRes(ErrorCode.INVALID_ICE), { status: 400 });

        const transferDoc = await db.collection("channels").doc(code).get();
        if (!transferDoc.exists)
            return json(getRes(ErrorCode.UNEXISTENT_CODE), { status: 400 });

        const tokenDoc = await db.collection("tokens").doc(token).get();
        if (!tokenDoc.exists || tokenDoc.data()?.token !== token)
            return json(getRes(ErrorCode.FORBIDDEN), { status: 403 });

        const iceCandidatesCol = db.collection(`channels/${code}/iceCandidates`);

        await iceCandidatesCol.add({ candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
        }});

        return json(getRes(ErrorCode.SUCCESS), { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}