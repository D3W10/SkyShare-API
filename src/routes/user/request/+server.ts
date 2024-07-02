import { json } from "@sveltejs/kit";
import keygen from "keygen";
import Parse from "$lib/parse";
import nodemailer from "$lib/nodemailer";
import { ErrorCode, getRes } from "$lib/errorManager";
import { checkEmail } from "$lib/constraintUtils";
import { getEmail, sendVerificationEmail } from "$lib/emails";

interface IBody {
    type: "verify" | "recovery";
    email: string;
    language?: "en" | "pt";
}

export async function POST({ request }) {
    try {
        const { type, email, language } = await request.json() as IBody;

        if (!type || !email)
            return json(getRes(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!["verify", "recovery"].includes(type))
            return json(getRes(ErrorCode.INVALID_REQUEST_TYPE), { status: 400 });
        else if (!checkEmail(email))
            return json(getRes(ErrorCode.INVALID_EMAIL), { status: 400 });

        const query = new Parse.Query("User"), lang = language && ["en", "pt"].includes(language) ? language : "en";
        query.equalTo("email", email);

        const user = await query.first({ useMasterKey: true });
        if (!user)
            return json(getRes(ErrorCode.SUCCESS), { status: 200 });

        if (type == "verify")
            await sendVerificationEmail(user, lang);
        else if (type == "recovery") {
            user.set("recoveryToken", keygen.hex(keygen.large));
            await user.save(null, { useMasterKey : true });

            await nodemailer.sendMail({
                from: "SkyShare <noreply@skyshare.pt>",
                to: email,
                subject: lang == "en" ? "Reset your account password" : "Redefinir a sua palavra-passe",
                html: getEmail("recovery", lang, user.get("username"), (user.get("photo") as Parse.File | null)?.url() ?? "https://skyshare.vercel.app/account.png", `https://skyshare.vercel.app/signal?action=recovery&token=${user.get("recoveryToken")}`)
            });
        }

        return json(getRes(ErrorCode.SUCCESS), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getRes(ErrorCode.SERVER_ERROR), { status: 500 });
    }
}