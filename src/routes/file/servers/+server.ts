import { json } from "@sveltejs/kit";
import { handleError } from "$lib/errorManager";

export async function GET() {
    try {
        const servers: RTCConfiguration = {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                },
                {
                    urls: "turn:turn.anyfirewall.com:443?transport=tcp",
                    username: "webrtc",
                    credential: "webrtc",
                },
            ]
        };

        return json(servers, { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}