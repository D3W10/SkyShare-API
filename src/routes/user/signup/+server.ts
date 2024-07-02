import crypto from "crypto";
import { json } from "@sveltejs/kit";
import mime from "mime";
import Parse from "$lib/parse";
import { ErrorCode, getRes, getUser } from "$lib/errorManager";
import { checkUsername, checkEmail, checkPassword, checkPhotoSize, checkPhoto, checkAvailability } from "$lib/constraintUtils";
import { sendVerificationEmail } from "$lib/emails.js";

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

export async function POST({ request }) {
    try {
        const { username, email, password, photo, language } = await request.json() as IBody;

        if (!username || !email || !password)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!checkUsername(username))
            return json(getRes(ErrorCode.INVALID_USERNAME), { status: 400 });
        else if (!checkEmail(email))
            return json(getRes(ErrorCode.INVALID_EMAIL), { status: 400 });
        else if (!checkPassword(password))
            return json(getRes(ErrorCode.INVALID_PASSWORD), { status: 400 });
        else if (photo && photo.data && !checkPhotoSize(photo.data))
            return json(getRes(ErrorCode.PHOTO_TOO_BIG), { status: 400 });
        else if (photo && photo.data && photo.type && !checkPhoto(photo.type))
            return json(getRes(ErrorCode.INVALID_PHOTO), { status: 400 });
        else if (!await checkAvailability("username", username))
            return json(getRes(ErrorCode.USERNAME_UNAVAILABLE), { status: 400 });
        else if (!await checkAvailability("email", email))
            return json(getRes(ErrorCode.EMAIL_UNAVAILABLE), { status: 400 });

        const user: Parse.User = new Parse.User();

        user.set("username", username);
        user.set("email", email);
        user.set("password", crypto.createHash("sha512").update(password).digest("hex"));

        if (photo)
            user.set("photo", new Parse.File("photo." + mime.getExtension(photo.type), { base64: photo.data }));

        try {
            const newUser = await user.signUp();

            await sendVerificationEmail(newUser, language || "en");

            return json(getRes(ErrorCode.SUCCESS, getUser(newUser)), { status: 200 });
        }
        catch (error) {
            console.error(error);

            return json(getRes(ErrorCode.UNKNOWN_SIGNUP), { status: 500 });
        }
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}