exports.config = {
    authentication: {
        options: {
            userName: process.env.login,
            password: process.env.password
        },
        type: "default"
    },
    server: process.env.server,
    options: {
        database: process.env.database,
        encrypt: true,
        trustServerCertificate: true
    }
};