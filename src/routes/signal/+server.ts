import { redirect } from "@sveltejs/kit";

interface IQuery {
    action: "verify" | "recovery";
    token: string;
}

export async function GET({ request }) {
    const query = {} as IQuery;
    new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

    const { action, token } = query;
    return redirect(303, ["verify", "recovery"].includes(action) && token ? `skyshare://${action}/${token}` : "skyshare://");
}