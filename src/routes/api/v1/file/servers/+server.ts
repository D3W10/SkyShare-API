import { json } from "@sveltejs/kit";
import { handleError } from "$lib/errorManager";

export async function GET() {
    try {
        const servers: RTCConfiguration = {
            iceServers: [
                {
                    urls: "stun:20.86.131.181:19302"
                },
                {
                    urls: "stun:freestun.net:3479"
                },
                {
                    urls: "turn:freestun.net:3479",
                    username: "free",
                    credential: "free",
                }
            ]
        };

        return json(servers, { status: 200 });
    }
    catch (error) {
        return json(...handleError(error));
    }
}