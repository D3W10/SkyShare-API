import Parse from "$lib/parse";

export function checkUsername(username: string) {
    return username.length <= 15 && /^[a-zA-Z0-9_.-]*$/.test(username);
}

export function checkEmail(email: string) {
    return email.length <= 250 && /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
}

export function checkPassword(password: string) {
    return password.length <= 50 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(password);
}

export function checkEncodedPassword(password: string) {
    return password.length == 128;
}

export function checkPhotoSize(photo: string) {
    return (photo.length * (3 / 4)) - (/=/g.exec(photo) ?? []).length <= 3145728;
}

export function checkPhoto(type: string, extension: string) {
    return ["image/png", "image/jpg", "image/jpeg", "image/gif"].includes(type) && /^[a-zA-Z]+$/g.test(extension);
}

export async function checkAvailability(username: string) {
    const query: Parse.Query = new Parse.Query("User").equalTo("username", username);
    
    return (await query.find()).length == 0;
}