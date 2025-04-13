import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser, handleError } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword } from "$lib/constraintUtils";

interface IQuery {
    username: string;
    password: string;
}

export async function GET({ request }) {
    try {
        const query = {} as IQuery;
        new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

        const { username, password } = query;

        if (!username || !password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);

            return json(getRes(ErrorCode.SUCCESS, getUser(user)), { status: 200 });
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }
    }
    catch (error) {
        return json(...handleError(error));
    }
}