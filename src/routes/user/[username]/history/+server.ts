import { json } from "@sveltejs/kit";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword, checkPassword } from "$lib/constraintUtils";

interface IQuery {
    password: string;
}

interface IBody {
    password: string;
    type: number;
    address: string;
    message: string;
    date: number;
}

interface IHistoryEntry {
    type: 0 | 1;
    address: string;
    message: string;
    date: number;
}

export async function GET({ request, params }) {
    try {
        const { username } = params;
        const query = {} as IQuery;
        new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

        const { password } = query;

        if (!username || !password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);
            const filtered = cleanHistory(user.get("history"));

            user.set("history", filtered);

            try {
                await user.save(null, { useMasterKey: true });

                return json(getRes(ErrorCode.SUCCESS, user.get("history")), { status: 200 });
            }
            catch (error) {
                console.error(error);
    
                return json(getRes(ErrorCode.UNKNOWN_HISTORY), { status: 500 });
            }
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}

export async function PUT({ request, params }) {
    try {
        const { username } = params;
        const { password, type, address, message, date } = await request.json() as IBody;

        if (!username || !password || !type || ![0, 1].includes(type) || !address || !message || !date)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        const filtered = cleanHistory(user.get("history"));
        filtered.push({ type: type as 0 | 1, address, message, date });
        user.set("history", filtered);

        try {
            await user.save(null, { useMasterKey: true });

            return json(getRes(ErrorCode.SUCCESS), { status: 200 });
        }
        catch (error) {
            console.error(error);

            return json(getRes(ErrorCode.UNKNOWN_HISTORY), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}

export async function DELETE({ request, params }) {
    try {
        const query = {} as IQuery;
        new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

        const { username } = params;
        const { password } = query;

        if (!username || !password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        user.set("history", []);

        try {
            let newUser: Parse.User = await user.save(null, { useMasterKey: true });

            return json(getRes(ErrorCode.SUCCESS, getUser(newUser)), { status: 200 });
        }
        catch (error) {
            console.error(error);

            return json(getRes(ErrorCode.UNKNOWN_HISTORY), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}

function cleanHistory(entries: IHistoryEntry[]) {
    return entries.filter(v => Date.now() - v.date < 7 * 24 * 60 * 60 * 1000);
}