const router = require("express").Router();
const { Connection, Request } = require("tedious");
const { TYPES } = require("tedious");
const axios = require("axios").default;
const keygen = require("keygenerator");
const { config } = require("../config");
const { BlobServiceClient, RestError } = require("@azure/storage-blob");
const getStream = require("into-stream");
const package = require("../package.json");
const mcache = require("memory-cache");

router.post("/login", (req, res, next) => {
    try {
        if (req.body.username == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 2, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 3, message: "The hashed password is not valid" });
        else {
            const connection = new Connection(config);
            connection.on("connect", (error) => {
                if (error)
                    next(error);
                else
                    queryDatabase();
            });
    
            connection.connect();
    
            function queryDatabase() {
                let hasRows = false;

                const request = new Request("SP_Login", (error) => {
                    if (error)
                        next(error);
                });

                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("Password", TYPES.VarChar, req.body.password);

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: { username: columns[0].value, email: columns[1].value, picture: "https://skyshare-api.herokuapp.com/user/picture/" + columns[0].value }});
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 4, message: "Login details not valid" });
                });
                request.on("error", (error) => {
                    console.error(error);
                    res.status(400).json({ code: 5, message: "Unknown error" });
                });
    
                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/signup", async (req, res, next) => {
    try {
        if (req.body.username == null || req.body.email == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 2, message: "The username provided is not valid" });
        else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email) || req.body.email.length > 250)
            res.status(400).json({ code: 3, message: "The email provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 4, message: "The hashed password is not valid" });
        else if (!(await (await axios.post(package.url + "user/check", { username: req.body.username })).data).value)
            res.status(400).json({ code: 5, message: "A user with this username already exists" });
        else {
            const connection = new Connection(config);
            connection.on("connect", (error) => {
                if (error)
                    next(error);
                else
                    queryDatabase();
            });
    
            connection.connect();
    
            function queryDatabase() {
                let hasRows = false;

                const request = new Request("SP_SignUp", (error) => {
                    if (error)
                        next(error);
                });

                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("Email", TYPES.VarChar, req.body.email);
                request.addParameter("Password", TYPES.VarChar, req.body.password);
                request.addParameter("RecoveryKey", TYPES.VarChar, keygen._({
                    chars: true,
                    numbers: true,
                    sticks: false,
                    specials: false,
                    forceLowercase: true,
                    length: 10
                }));
                request.addParameter("CreationDate", TYPES.DateTime, new Date());

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: { username: columns[0].value, email: columns[1].value, picture: "https://skyshare-api.herokuapp.com/user/picture/" + columns[0].value, recoveryKey: columns[2].value }});
                });
                request.on("requestCompleted", async () => {
                    connection.close();

                    if (req.files != undefined && req.files.picture != undefined) {
                        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                        const containerClient = blobServiceClient.getContainerClient("pictures");

                        const data = getStream(req.files.picture.data);
                        const blockBlobClient = containerClient.getBlockBlobClient(req.body.username);
                        await blockBlobClient.uploadStream(data, 4 * 1024 * 1024, 20, {
                            blobHTTPHeaders: {
                                blobContentType: req.files.picture.mimetype
                            }
                        });
                    }

                    if (!hasRows)
                        res.status(400).json({ code: 6, message: "Unknown error" });
                });
                request.on("error", (error) => {
                    console.error(error);
                    res.status(400).json({ code: 6, message: "Unknown error" });
                });
    
                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/check", (req, res, next) => {
    try {
        if (req.body.username == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 2, message: "The username provided is not valid" });
        else {
            const connection = new Connection(config);
            connection.on("connect", (error) => {
                if (error)
                    next(error);
                else
                    queryDatabase();
            });

            connection.connect();

            function queryDatabase() {
                let hasRows = false;

                const request = new Request("SP_UsernameCheck", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: columns[0].value == 0 });
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 3, message: "Unknown error" });
                });
                request.on("error", (error) => {
                    console.error(error);
                    res.status(400).json({ code: 3, message: "Unknown error" });
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/recovery/check", (req, res, next) => {
    try {
        if (req.body.username == null || req.body.recoveryKey == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 2, message: "The username provided is not valid" });
        else if (req.body.recoveryKey.length != 128)
            res.status(400).json({ code: 3, message: "The hashed recovery key is not valid" });
        else {
            const connection = new Connection(config);
            connection.on("connect", (error) => {
                if (error)
                    next(error);
                else
                    queryDatabase();
            });

            connection.connect();

            function queryDatabase() {
                let hasRows = false;

                const request = new Request("SP_RecoveryCheck", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("RecoveryKey", TYPES.VarChar, req.body.recoveryKey);

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: columns[0].value == 0 });
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 4, message: "Unknown error" });
                });
                request.on("error", (error) => {
                    console.error(error);
                    res.status(400).json({ code: 4, message: "Unknown error" });
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/recovery/password", (req, res, next) => {
    try {
        if (req.body.username == null || req.body.recoveryKey == null || req.body.newPassword == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 2, message: "The username provided is not valid" });
        else if (req.body.recoveryKey.length != 128)
            res.status(400).json({ code: 3, message: "The hashed recovery key is not valid" });
        else if (req.body.newPassword.length != 128)
            res.status(400).json({ code: 4, message: "The hashed new password is not valid" });
        else {
            const connection = new Connection(config);
            connection.on("connect", (error) => {
                if (error)
                    next(error);
                else
                    queryDatabase();
            });

            connection.connect();

            function queryDatabase() {
                let hasRows = false;

                const request = new Request("SP_RecoveryCheck", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("RecoveryKey", TYPES.VarChar, req.body.recoveryKey);
                request.addParameter("NewPassword", TYPES.VarChar, req.body.newPassword);
                request.addParameter("NewRecoveryKey", TYPES.VarChar, keygen._({
                    chars: true,
                    numbers: true,
                    sticks: false,
                    specials: false,
                    forceLowercase: true,
                    length: 10
                }));

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: { username: columns[0].value, email: columns[1].value, picture: "https://skyshare-api.herokuapp.com/user/picture/" + columns[0].value, recoveryKey: columns[2].value }});
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 5, message: "Unknown error" });
                });
                request.on("error", (error) => {
                    console.error(error);
                    res.status(400).json({ code: 5, message: "Unknown error" });
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.get("/picture/:username", async (req, res, next) => {
    try {
        if (req.params.username.length > 15)
            res.status(400).json({ code: 1, message: "The username provided is not valid" });
        else if (mcache.get(req.originalUrl)) {
            let cached = mcache.get(req.originalUrl);

            res.writeHead(200, {
                "Content-Type": cached.type,
                "Content-Length": cached.image.length
            });
            res.end(cached.image);
        }
        else {
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
            const containerClient = blobServiceClient.getContainerClient("pictures");
            const blockBlobClient = containerClient.getBlockBlobClient(req.params.username);
            const imageBuffer = await blockBlobClient.downloadToBuffer();

            mcache.put(req.originalUrl, { type: (await blockBlobClient.getProperties()).contentType, image: imageBuffer }, 20000);
            res.writeHead(200, {
                "Content-Type": (await blockBlobClient.getProperties()).contentType,
                "Content-Length": imageBuffer.length
            });
            res.end(imageBuffer); 
        }
    }
    catch (error) {
        if (error instanceof RestError)
            res.status(400).json({ code: 2, message: "This user doesn't have a profile picture" });
        else
            next(error);
    }
});

module.exports = router;