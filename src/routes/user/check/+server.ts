import { json } from "@sveltejs/kit";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkUsername, checkAvailability } from "$lib/constraintUtils";

interface IParams {
    username: string;
}

export async function GET({ request }) {
    try {
        const params = {} as IParams;
        new URL(request.url).searchParams.forEach((value, key) => params[key as keyof IParams] = value as any);

        const { username } = params;

        if (!username)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });

        return json({ ...getSuccess(), value: await checkAvailability(username) }, { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}