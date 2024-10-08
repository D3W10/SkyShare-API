import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser, handleError } from "$lib/errorManager";
import { checkUsername } from "$lib/constraintUtils";

interface IBody {
    password: string;
    historyEnabled?: boolean;
    showInfo?: boolean;
}

export async function PUT({ request, params }) {
    try {
        const { username } = params;
        const { password, historyEnabled, showInfo } = await request.json() as IBody;

        if (!password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (historyEnabled === undefined && showInfo === undefined)
            return json(getRes(ErrorCode.NO_PARAMETERS), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        if (historyEnabled !== undefined) {
            user.set("historyEnabled", historyEnabled);
            user.set("history", []);
        }
        if (showInfo !== undefined)
            user.set("showInfo", showInfo);

        try {
            let newUser: Parse.User = await user.save(null, { useMasterKey: true });

            return json(getRes(ErrorCode.SUCCESS, getUser(newUser)), { status: 200 });
        }
        catch (error) {
            console.error(error);

            return json(getRes(ErrorCode.UNKNOWN_EDIT), { status: 500 });
        }
    }
    catch (error) {
        return json(...handleError(error));
    }
}