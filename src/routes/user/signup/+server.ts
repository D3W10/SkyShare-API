import crypto from "crypto";
import { json } from "@sveltejs/kit";
import mime from "mime";
import Parse from "$lib/parse";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkUsername, checkEmail, checkPassword, checkPhotoSize, checkPhoto, checkAvailability } from "$lib/constraintUtils";

interface IBody {
    username: string;
    email: string;
    password: string;
    photo: {
        data: string;
        type: string;
    } | null;
}

export async function POST({ request }) {
    try {
        const { username, email, password, photo } = await request.json() as IBody;

        if (!username || !email || !password)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getError(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEmail(email))
            return json(getError(ErrorCode.INVALID_EMAIL), { status: 400 });
        else if (!checkPassword(password))
            return json(getError(ErrorCode.INVALID_PASSWORD), { status: 400 });
        else if (photo && photo.data && !checkPhotoSize(photo.data))
            return json(getError(ErrorCode.PHOTO_TOO_BIG), { status: 400 });
        else if (photo && photo.data && photo.type && !checkPhoto(photo.type))
            return json(getError(ErrorCode.INVALID_PHOTO), { status: 400 });
        else if (!await checkAvailability(username))
            return json(getError(ErrorCode.USERNAME_UNAVAILABLE), { status: 400 });

        const user: Parse.User = new Parse.User();

        user.set("username", username);
        user.set("email", email);
        user.set("password", crypto.createHash("sha512").update(password).digest("hex"));

        if (photo)
            user.set("photo", new Parse.File("photo." + mime.getExtension(photo.type), { base64: photo.data }));

        try {
            let userInfo = await user.signUp();

            return json({ ...getSuccess(), value: { username: userInfo.getUsername(), email: userInfo.getEmail(), photo: (userInfo.get("photo") as Parse.File | null)?.url() } }, { status: 200 });
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