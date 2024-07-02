import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getRes } from "$lib/errorManager";
import { checkEmail } from "$lib/constraintUtils";

interface IBody {
    email: string;
    verificationToken: string;
}

export async function POST({ request }) {
    try {
        const { email, verificationToken } = await request.json() as IBody;

        if (!email || !verificationToken)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkEmail(email))
            return json(getRes(ErrorCode.INVALID_EMAIL), { status: 400 });

        const query = new Parse.Query("User");
        query.equalTo("email", email).equalTo("verificationToken", verificationToken);

        const user = await query.first();
        if (!user)
            return json(getRes(ErrorCode.INVALID_VERIFICATION_TOKEN), { status: 400 });

        user.set("emailVerified", true);
        user.unset("verificationToken");
        await user.save(null, { useMasterKey : true });

        return json(getRes(ErrorCode.SUCCESS), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}