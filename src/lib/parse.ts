import Parse from "parse/node";

Parse.serverURL = "https://parseapi.back4app.com";
Parse.initialize(import.meta.env.VITE_APPLICATION_ID, import.meta.env.VITE_JAVASCRIPT_KEY, import.meta.env.VITE_MASTER_KEY);

export default Parse;