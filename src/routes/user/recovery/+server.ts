import crypto from "crypto";
import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkEmail, checkPassword } from "$lib/constraintUtils";

interface IBody {
    email: string;
    password: string;
    recoveryToken: string;
}

export async function POST({ request }) {
    try {
        const { email, password, recoveryToken } = await request.json() as IBody;

        if (!email || !password || !recoveryToken)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkEmail(email))
            return json(getError(ErrorCode.INVALID_EMAIL), { status: 400 });
        else if (!checkPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });

        const query = new Parse.Query("User");
        query.equalTo("email", email).equalTo("recoveryToken", recoveryToken);

        const user = await query.first();
        if (!user)
            return json(getError(ErrorCode.INVALID_RECOVERY_TOKEN), { status: 400 });

        user.set("password", crypto.createHash("sha512").update(password).digest("hex"));
        user.unset("recoveryToken");
        await user.save(null, { useMasterKey : true });

        return json(getSuccess(), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}