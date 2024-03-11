import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword } from "$lib/constraintUtils";

interface IBody {
    username: string;
    password: string;
}

export async function GET({ request }) {
    try {
        const params = {} as IBody;
        new URL(request.url).searchParams.forEach((value, key) => params[key as keyof IBody] = value);

        const { username, password } = params;

        if (!username || !password)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);

            return json({ ...getSuccess(), value: { username: user.getUsername(), email: user.getEmail(), photo: (user.get("photo") as Parse.File | null)?.url() } }, { status: 200 });
        }
        catch {
            return json(getError(ErrorCode.UNKNOWN_SIGNUP), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}