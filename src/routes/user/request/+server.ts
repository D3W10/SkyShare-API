import { json } from "@sveltejs/kit";
import keygen from "keygen";
import Parse from "$lib/parse";
import nodemailer from "$lib/nodemailer";
import { ErrorCode, getError, getSuccess, getServerError } from "$lib/errorManager";
import { checkEmail } from "$lib/constraintUtils";
import { getEmail } from "$lib/emails";
import type Mail from "nodemailer/lib/mailer";

interface IBody {
    type: "verify" | "recovery";
    email: string;
    language?: "en" | "pt";
}

export async function POST({ request }) {
    try {
        const { type, email, language } = await request.json() as IBody;

        if (!type || !email)
            return json(getError(ErrorCode.MISSING_PARAMETER), { status: 400 });
        else if (!["verify", "recovery"].includes(type))
            return json(getError(ErrorCode.INVALID_REQUEST_TYPE), { status: 400 });
        else if (!checkEmail(email))
            return json(getError(ErrorCode.INVALID_EMAIL), { status: 400 });

        const query = new Parse.Query("User"), lang = language && ["en", "pt"].includes(language) ? language : "en";
        query.equalTo("email", email);

        const user = await query.first({ useMasterKey: true });
        if (!user)
            return json(getSuccess(), { status: 200 });

        let emailConfig: Mail.Options = {};
        if (type == "verify") {
            user.set("verificationToken", keygen.hex(keygen.large));
            await user.save(null, { useMasterKey : true });

            emailConfig = {
                from: "SkyShare <noreply@skyshare.pt>",
                to: email,
                subject: lang == "en" ? "Verify your email address" : "Verifique o seu endereço de email",
                html: getEmail("verify", lang, user.get("username"), (user.get("photo") as Parse.File | null)?.url() ?? "https://skyshare.vercel.app/account.png", `https://skyshare.vercel.app/signal?action=verify&token=${user.get("verificationToken")}`)
            };
        }
        else if (type == "recovery") {
            user.set("recoveryToken", keygen.hex(keygen.large));
            await user.save(null, { useMasterKey : true });

            emailConfig = {
                from: "SkyShare <noreply@skyshare.pt>",
                to: email,
                subject: lang == "en" ? "Reset your account password" : "Redefinir a sua palavra-passe",
                html: getEmail("recovery", lang, user.get("username"), (user.get("photo") as Parse.File | null)?.url() ?? "https://skyshare.vercel.app/account.png", `https://skyshare.vercel.app/signal?action=recovery&token=${user.get("recoveryToken")}`)
            };
        }

        await nodemailer.sendMail(emailConfig);

        return json(getSuccess(), { status: 200 });
    }
    catch (error) {
        console.error(error);

        return json(getServerError(), { status: 500 });
    }
}