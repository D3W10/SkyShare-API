import { redirect } from "@sveltejs/kit";

interface IParams {
    action: "verify" | "recovery";
    token: string;
}

export async function GET({ request }) {
    const params = {} as IParams;
    new URL(request.url).searchParams.forEach((value, key) => params[key as keyof IParams] = value as any);

    const { action, token } = params;
    return redirect(303, ["verify", "recovery"].includes(action) && token ? `skyshare://${action}/${token}` : "skyshare://");
}