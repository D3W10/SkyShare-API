import { json } from "@sveltejs/kit";
import mime from "mime";
import Parse from "$lib/parse";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkUsername, checkEncodedPassword, checkEmail, checkPhotoSize, checkPhoto } from "$lib/constraintUtils";

interface IBody {
    username: string;
    email: string;
    password: string;
    photo: {
        data: string;
        type: string;
    } | null;
}

interface IQuery {
    password: string;
}

export async function PUT({ request, params }) {
    try {
        const { username } = params;
        const { username: newUsername, email, password, photo } = await request.json() as IBody;

        if (!username || !password)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!newUsername && !email && photo === undefined)
            return json(getError(ErrorCode.NO_PARAMETERS), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });
        else if (newUsername && !checkUsername(newUsername))
            return json(getError(ErrorCode.INVALID_NEW_USERNAME), { status: 400 });
        else if (email && !checkEmail(email))
            return json(getError(ErrorCode.INVALID_NEW_EMAIL), { status: 400 });
        else if (photo && photo.data && !checkPhotoSize(photo.data))
            return json(getError(ErrorCode.PHOTO_TOO_BIG), { status: 400 });
        else if (photo && photo.data && photo.type && !checkPhoto(photo.type))
            return json(getError(ErrorCode.INVALID_PHOTO), { status: 400 });

        let user: Parse.User;

        try {
            user = await Parse.User.logIn(username, password);
        }
        catch {
            return json(getError(ErrorCode.WRONG_USERPASS), { status: 400 });
        }

        if (newUsername)
            user.setUsername(newUsername);
        if (email)
            user.setEmail(email);
        if (photo)
            user.set("photo", new Parse.File("photo." + mime.getExtension(photo.type), { base64: photo.data }));
        if (photo == null)
            user.unset("photo");

        try {
            let response: Parse.User = await user.save();

            return json({ ...getSuccess(), value: { username: response.getUsername(), email: response.getEmail(), photo: (response.get("photo") as Parse.File | null)?.url(), createdAt: response.createdAt } }, { status: 200 });
        }
        catch {
            return json(getError(ErrorCode.UNKNOWN_EDIT), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}

export async function DELETE({ request, params }) {
    try {
        const query = {} as IQuery;
        new URL(request.url).searchParams.forEach((value, key) => query[key as keyof IQuery] = value as any);

        const { username } = params;
        const { password } = query;

        if (!username || !password)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEncodedPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });

        try {
            const user: Parse.User = await Parse.User.logIn(username, password);
            await user.destroy({ useMasterKey: true });

            return json(getSuccess(), { status: 200 });
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