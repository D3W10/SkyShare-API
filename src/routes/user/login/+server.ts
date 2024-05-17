import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
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
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);

            return json({ ...getSuccess(), value: { username: user.getUsername(), email: user.getEmail(), photo: (user.get("photo") as Parse.File | null)?.url(), createdAt: user.createdAt } }, { status: 200 });
        }
        catch {
            return json(getError(ErrorCode.WRONG_USERPASS), { status: 400 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}