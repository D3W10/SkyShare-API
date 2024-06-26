import { json } from "@sveltejs/kit";
import { ErrorCode, getRes } from "$lib/errorManager";
import { checkUsername, checkEmail, checkAvailability } from "$lib/constraintUtils";

interface IQuery {
    username: string;
    email: string;
}

export async function GET({ request }) {
    try {
        const query = {} as IQuery;
        new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

        const { username, email } = query;

        if (!username || !email)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEmail(email))
            return json(getRes(ErrorCode.INVALID_EMAIL), { status: 400 });

        return json(getRes(ErrorCode.SUCCESS, { username: await checkAvailability("username", username), email: await checkAvailability("email", email) }), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}