import { Client, type Notification } from "pg";

type Peers = "sender" | "receiver";

const client = new Client({
    connectionString: process.env.DATABASE_URL
});
await client.connect();

function createTransfer(code: string, offer: RTCSessionDescriptionInit) {
    client.query("INSERT INTO transfer (code, offer, created_at) VALUES ($1, $2, NOW())", [code, offer]);
}

async function hasTransfer(code: string): Promise<boolean> {
    const query = await client.query(
        "SELECT 1 FROM transfer WHERE code = $1",
        [code]
    );

    return query.rows.length > 0;
}

async function obtainAnswer(code: string) {
    const query = await client.query<{ answer: RTCSessionDescriptionInit | null }>(
        "SELECT answer FROM transfer WHERE code = $1",
        [code]
    );

    return query.rows.length > 0 ? query.rows[0].answer : null;
}

function setAnswer(code: string, answer: RTCSessionDescriptionInit) {
    client.query("UPDATE transfer SET answer = $1 WHERE code = $2", [answer, code]);
}

function subscribe(code: string, listener: (data: { [key: string]: any }) => unknown, from: Peers) {
    const runner = (m: Notification) => {
        if (!m.payload) return;

        const { to, data } = JSON.parse(m.payload) as { to: Peers, data?: { [key: string]: any } };

        if (m.channel === code && to === from)
            listener(data ?? {});
    }
    
    client.query(`LISTEN "${code}"`);
    client.on("notification", runner);

    return () => {
        client.query(`UNLISTEN "${code}"`);
        client.off("notification", runner);
    };
}

function notify(code: string, to: Peers, data?: { [key: string]: any }) {
    client.query(`NOTIFY "${code}", '${JSON.stringify({ to, data })}'`);
}

export default {
    createTransfer,
    hasTransfer,
    obtainAnswer,
    setAnswer,
    subscribe,
    notify
}