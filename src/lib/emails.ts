import keygen from "keygen";
import nodemailer from "./nodemailer";
import verifyEn from "./emails/verify/en.html?raw";
import verifyPt from "./emails/verify/pt.html?raw";
import recoveryEn from "./emails/recovery/en.html?raw";
import recoveryPt from "./emails/recovery/pt.html?raw";

const db = {
    verify: {
        en: verifyEn,
        pt: verifyPt
    },
    recovery: {
        en: recoveryEn,
        pt: recoveryPt
    }
}

export function getEmail(type: "verify" | "recovery", lang: "en" | "pt", username: string, photo: string, link: string) {
    return db[type][lang].replace(/{{username}}/g, username).replace(/{{photo}}/g, photo).replace(/{{link}}/g, link);
}

export async function sendVerificationEmail(user: Parse.Object<Parse.Attributes>,  lang: "en" | "pt") {
    const key = keygen.hex(keygen.large);

    user.set("verificationToken", key);
    await user.save(null, { useMasterKey : true });

    await nodemailer.sendMail({
        from: "SkyShare <noreply@skyshare.pt>",
        to: user.get("email"),
        subject: lang == "en" ? "Verify your email address" : "Verifique o seu endereço de email",
        html: getEmail("verify", lang, user.get("username"), (user.get("photo") as Parse.File | null)?.url() ?? "https://skyshare.vercel.app/account.png", `https://skyshare.vercel.app/signal?action=verify&token=${key}`)
    });
}