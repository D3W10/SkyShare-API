import { json } from "@sveltejs/kit";
import mime from "mime";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser, handleError } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword, checkEmail, checkPhotoSize, checkPhoto } from "$lib/constraintUtils";
import { sendVerificationEmail } from "$lib/emails";

interface IBody {
    username: string;
    email: string;
    password: string;
    photo: {
        data: string;
        type: string;
    } | null;
    language?: "en" | "pt";
}

interface IQuery {
    password: string;
}

export async function PUT({ request, params }) {
    try {
        const { username } = params;
        const { username: newUsername, email, password, photo, language } = await request.json() as IBody;

        if (!username || !password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!newUsername && !email && photo === undefined)
            return json(getRes(ErrorCode.NO_PARAMETERS), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });
        else if (newUsername && !checkUsername(newUsername))
            return json(getRes(ErrorCode.INVALID_NEW_USERNAME), { status: 400 });
        else if (email && !checkEmail(email))
            return json(getRes(ErrorCode.INVALID_NEW_EMAIL), { status: 400 });
        else if (photo && photo.data && !checkPhotoSize(photo.data))
            return json(getRes(ErrorCode.PHOTO_TOO_BIG), { status: 400 });
        else if (photo && photo.data && photo.type && !checkPhoto(photo.type))
            return json(getRes(ErrorCode.INVALID_PHOTO), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        if (newUsername)
            user.setUsername(newUsername);
        if (email) {
            user.setEmail(email);
            user.set("emailVerified", false);
        }
        if (photo)
            user.set("photo", new Parse.File("photo." + mime.getExtension(photo.type), { base64: photo.data }));
        if (photo === null)
            user.unset("photo");

        try {
            let newUser: Parse.User = await user.save(null, { useMasterKey: true });

            if (email)
                await sendVerificationEmail(newUser, language || "en");

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

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);
            await user.destroy({ useMasterKey: true });

            return json(getRes(ErrorCode.SUCCESS), { status: 200 });
        }
        catch {
            return json(getRes(ErrorCode.WRONG_USERPASS), { status: 400 });
        }
    }
    catch (error) {
        return json(...handleError(error));
    }
}