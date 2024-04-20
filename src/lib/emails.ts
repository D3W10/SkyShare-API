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