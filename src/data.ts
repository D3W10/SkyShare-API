import { Client, type Notification } from "pg";
import type { File } from "./models/File.interface";

type Peers = "sender" | "receiver";

const client = new Client({
    connectionString: process.env.DATABASE_URL
});
await client.connect();

function createTransfer(code: string, offer: RTCSessionDescriptionInit) {
    client.query("INSERT INTO transfer (code, offer, timeout_start, created_at) VALUES ($1, $2, NOW(), NOW())", [code, offer]);
}

async function hasTransfer(code: string): Promise<boolean> {
    const query = await client.query(
        "SELECT 1 FROM transfer WHERE code = $1",
        [code]
    );

    return query.rows.length > 0;
}

async function getAnswer(code: string) {
    const query = await client.query<{ answer: RTCSessionDescriptionInit | null }>(
        "SELECT answer FROM transfer WHERE code = $1",
        [code]
    );

    return query.rows.length > 0 ? query.rows[0].answer : null;
}

async function getOffer(code: string) {
    const query = await client.query<{ offer: RTCSessionDescriptionInit | null }>(
        "SELECT offer FROM transfer WHERE code = $1",
        [code]
    );

    return query.rows.length > 0 ? query.rows[0].offer : null;
}

function setAnswer(code: string, answer: RTCSessionDescriptionInit) {
    client.query("UPDATE transfer SET answer = $1 WHERE code = $2", [answer, code]);
}

function removeAnswer(code: string) {
    client.query("UPDATE transfer SET answer = NULL, timeout_start = NOW() WHERE code = $1", [code]);
}

function setOffer(code: string, offer: RTCSessionDescriptionInit) {
    client.query("UPDATE transfer SET offer = $1 WHERE code = $2", [offer, code]);
}

function removeTransfer(code: string) {
    client.query("DELETE FROM transfer WHERE code = $1", [code]);
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
        if (from === "sender")
            client.query(`UNLISTEN "${code}"`);

        client.off("notification", runner);
    };
}

function notify(code: string, to: Peers, data?: { [key: string]: any }) {
    client.query(`NOTIFY "${code}", '${JSON.stringify({ to, data })}'`);
}

function getBasicUserInfo(userId: string) {
    return client.query<{ name: string, avatar: string }>(
        "SELECT name, avatar FROM \"user\" WHERE id = $1",
        [userId]
    );
}

async function getHistory(user: string, since: number) {
    const query = await client.query(
        `SELECT *, CASE WHEN sender = $1 THEN 'sender' WHEN receiver = $1 THEN 'receiver' END AS type
        FROM history WHERE created_at > $2 AND (sender = $1 OR receiver = $1);`,
        [user, new Date(since)]
    );

    return query.rows;
}

function pushHistory(files: File[], message: string | null, sender: string | null, receiver: string | null) {
    client.query(
        "INSERT INTO history (files, message, sender, receiver, created_at) VALUES ($1, $2, $3, $4, NOW())",
        [JSON.stringify(files), message || null, sender || null, receiver || null]
    );
}

export default {
    createTransfer,
    hasTransfer,
    getAnswer,
    getOffer,
    setAnswer,
    removeAnswer,
    setOffer,
    removeTransfer,
    subscribe,
    notify,
    getBasicUserInfo,
    getHistory,
    pushHistory
}