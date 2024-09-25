import crypto from "crypto";
import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword, checkPassword } from "$lib/constraintUtils";

interface IBody {
    password: string;
    newPassword: string;
}

export async function PUT({ request, params }) {
    try {
        const { username } = params;
        const { password, newPassword } = await request.json() as IBody;

        if (!username || !password || !newPassword)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });
        else if (!checkPassword(newPassword))
            return json(getRes(ErrorCode.INVALID_NEW_PASSWORD), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        user.setPassword(crypto.createHash("sha512").update(newPassword).digest("hex"));

        try {
            let response: Parse.User = await user.save(null, { useMasterKey: true });

            return json(getRes(ErrorCode.SUCCESS, getUser(response)), { status: 200 });
        }
        catch (error) {
            console.error(error);

            return json(getRes(ErrorCode.UNKNOWN_PASSWORD), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}