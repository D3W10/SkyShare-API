import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
    host: import.meta.env.VITE_NODEMAILER_HOST,
    port: import.meta.env.VITE_NODEMAILER_PORT,
    auth: {
        user: import.meta.env.VITE_NODEMAILER_USER,
        pass: import.meta.env.VITE_NODEMAILER_PASS
    }
});

export default transport;