import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_KEY,
    authDomain: "skyshare-37.firebaseapp.com",
    projectId: "skyshare-37",
    storageBucket: "skyshare-37.appspot.com",
    messagingSenderId: "280279099940",
    appId: "1:280279099940:web:db1f9105f3ebc51b57c6b1",
    credential: cert(JSON.parse(import.meta.env.VITE_FIREBASE_CRED))
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);