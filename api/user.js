const router = require("express").Router();
const { config } = require("../config");
const { Connection, Request } = require("tedious");
const { TYPES } = require("tedious");
const axios = require("axios").default;
const crypto = require("crypto");
const keygen = require("keygenerator");
const { BlobServiceClient, RestError } = require("@azure/storage-blob");
const getStream = require("into-stream");
const package = require("../package.json");
const mcache = require("memory-cache");
var pictureUrlTemplate = package.url + "user/{0}/picture/";

router.post("/login", (req, res, next) => {
    try {
        if (req.body.username == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_Login", (error) => {
                    if (error)
                        next(error);
                });

                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("Password", TYPES.VarChar, req.body.password);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", async () => {
                    connection.close();

                    if (hasRows) {
                        let pictureUrl = pictureUrlTemplate.replace("{0}", dataRow[0].value);
                        res.status(200).json({ code: 0, value: { username: dataRow[0].value, email: dataRow[1].value, picture: (await axios.get(pictureUrl, { validateStatus: () => true })).status == 200 ? pictureUrl : null } });
                    }
                    else
                        res.status(400).json({ code: 7, message: "Wrong username or password" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
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
        let apiResult = { code: 0, value: false };
        if (req.body.username != null)
            apiResult = await (await axios.post(package.url + "user/check", { username: req.body.username }, { validateStatus: () => true })).data;

        if (req.body.username == null || req.body.email == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.email.length > 250 || !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email))
            res.status(400).json({ code: 4, message: "The email provided is not valid" });
        else if (req.body.password.length > 50 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(req.body.password))
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
        else if (req.files != undefined && req.files.picture != undefined && req.files.picture.size > 3145728)
            res.status(400).json({ code: 20, message: "The image size cannot be over 3 MB" });
        else if (req.files != undefined && req.files.picture != undefined && !["image/png", "image/jpeg"].includes(req.files.picture.mimetype))
            res.status(400).json({ code: 21, message: "The image was not in the correct type" });
        else if (apiResult.code != 0 || (apiResult.code == 0 && !apiResult.value))
            res.status(400).json({ code: 7, message: "A user with this username already exists" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_SignUp", (error) => {
                    if (error)
                        next(error);
                }), recoveryKey = keygen._({
                    chars: true,
                    numbers: true,
                    sticks: false,
                    specials: false,
                    forceLowercase: true,
                    length: 10
                });

                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("Email", TYPES.VarChar, req.body.email);
                request.addParameter("Password", TYPES.VarChar, crypto.createHash("sha512").update(req.body.password).digest("hex"));
                request.addParameter("RecoveryKey", TYPES.VarChar, crypto.createHash("sha512").update(recoveryKey).digest("hex"));
                request.addParameter("CreationDate", TYPES.DateTime, new Date());

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
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

                    if (hasRows) {
                        let pictureUrl = pictureUrlTemplate.replace("{0}", dataRow[0].value);
                        res.status(200).json({ code: 0, value: { username: dataRow[0].value, email: dataRow[1].value, picture: (await axios.get(pictureUrl, { validateStatus: () => true })).status == 200 ? pictureUrl : null, recoveryKey: recoveryKey } });
                    }
                    else
                        res.status(500).json({ code: 9, message: "There was an error while trying to create the account" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
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
        else if (req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_UsernameCheck", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (hasRows)
                        res.status(200).json({ code: 0, value: dataRow[0].value == 0 });
                    else
                        res.status(500).json({ code: 10, message: "There was an error while checking the username" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
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
        else if (req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.recoveryKey.length != 128)
            res.status(400).json({ code: 14, message: "The recovery key provided is not valid" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_RecoveryCheck", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("RecoveryKey", TYPES.VarChar, req.body.recoveryKey);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (hasRows)
                        res.status(200).json({ code: 0, value: dataRow[0].value != 0 });
                    else
                        res.status(400).json({ code: 15, message: "Wrong username or recovery key" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/recovery/password", async (req, res, next) => {
    try {
        let apiResult = { code: 0, value: false }, loggedOn = -1;
        if (req.body.username != null && req.body.recoveryKey != null)
            apiResult = await (await axios.post(package.url + "user/recovery/check", { username: req.body.username, recoveryKey: req.body.recoveryKey }, { validateStatus: () => true })).data;
        if (req.body.username != null && req.body.newPassword != null)
            loggedOn = await (await axios.post(package.url + "user/login", { username: req.body.username, password: crypto.createHash("sha512").update(req.body.newPassword).digest("hex") }, { validateStatus: () => true })).data.code;

        if (req.body.username == null || req.body.recoveryKey == null || req.body.newPassword == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.recoveryKey.length != 128)
            res.status(400).json({ code: 14, message: "The recovery key provided is not valid" });
        else if (req.body.newPassword.length > 50 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(req.body.newPassword))
            res.status(400).json({ code: 6, message: "The new password is not valid" });
        else if (apiResult.code != 0 || (apiResult.code == 0 && !apiResult.value))
            res.status(400).json({ code: 15, message: "Wrong username or recovery key" });
        else if (loggedOn == 0)
            res.status(400).json({ code: 17, message: "Both passwords are the same" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_PasswordRecovery", (error) => {
                    if (error)
                        next(error);
                }), recoveryKey = keygen._({
                    chars: true,
                    numbers: true,
                    sticks: false,
                    specials: false,
                    forceLowercase: true,
                    length: 10
                });
                
                request.addParameter("Username", TYPES.VarChar, req.body.username);
                request.addParameter("RecoveryKey", TYPES.VarChar, req.body.recoveryKey);
                request.addParameter("NewPassword", TYPES.VarChar, crypto.createHash("sha512").update(req.body.newPassword).digest("hex"));
                request.addParameter("NewRecoveryKey", TYPES.VarChar, crypto.createHash("sha512").update(recoveryKey).digest("hex"));

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", async () => {
                    connection.close();

                    if (hasRows) {
                        let pictureUrl = pictureUrlTemplate.replace("{0}", dataRow[0].value);
                        res.status(200).json({ code: 0, value: { username: dataRow[0].value, email: dataRow[1].value, picture: (await axios.get(pictureUrl, { validateStatus: () => true })).status == 200 ? pictureUrl : null, recoveryKey: recoveryKey } });
                    }
                    else
                        res.status(400).json({ code: 15, message: "Wrong username or recovery key" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.put("/:username/edit/info", async (req, res, next) => {
    try {
        let apiResult = { code: 0, value: false };
        if (req.body.newUsername != null)
            apiResult = await (await axios.post(package.url + "user/check", { username: req.body.newUsername }, { validateStatus: () => true })).data;

        if (req.params.username == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.body.newUsername == null && req.body.email == null && req.files == undefined && req.body.removePicture == null)
            res.status(400).json({ code: 2, message: "None of the parameters to modify were provided" });
        else if (req.params.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.params.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
        else if (req.body.newUsername != null && (req.body.newUsername.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.newUsername)))
            res.status(400).json({ code: 18, message: "The new username is not valid" });
        else if (req.body.email != null && (req.body.email.length > 250 || !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email)))
            res.status(400).json({ code: 19, message: "The new email is not valid" });
        else if (req.body.newUsername == null && req.body.email == null && req.body.removePicture == null && req.files.picture == undefined)
            res.status(400).json({ code: 12, message: "No picture was provided" });
        else if (req.files != undefined && req.files.picture != undefined && req.files.picture.size > 3145728)
            res.status(400).json({ code: 20, message: "The image size cannot be over 3 MB" });
        else if (req.files != undefined && req.files.picture != undefined && !["image/png", "image/jpeg"].includes(req.files.picture.mimetype))
            res.status(400).json({ code: 21, message: "The image was not in the correct type" });
        else if (req.body.newUsername != null && (apiResult.code != 0 || (apiResult.code == 0 && !apiResult.value)))
            res.status(400).json({ code: 8, message: "A user with this username already exists" });
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
                let request, hasRows = false, dataRow = null;

                if (req.body.newUsername != null || req.body.email != null) {
                    request = new Request("SP_EditUser", (error) => {
                        if (error)
                            next(error);
                    });

                    request.addParameter("Username", TYPES.VarChar, req.params.username);
                    request.addParameter("Password", TYPES.VarChar, req.body.password);
                    request.addParameter("NewUsername", TYPES.VarChar, req.body.newUsername);
                    request.addParameter("Email", TYPES.VarChar, req.body.email);
                }
                else {
                    request = new Request("SP_GetBasicUserData", (error) => {
                        if (error)
                            next(error);
                    });

                    request.addParameter("Username", TYPES.VarChar, req.params.username);
                    request.addParameter("Password", TYPES.VarChar, req.body.password);
                }

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", async () => {
                    connection.close();
                    if (hasRows) {
                        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                        const containerClient = blobServiceClient.getContainerClient("pictures");

                        if (req.body.removePicture == "true") {
                            let blockBlobClient = containerClient.getBlockBlobClient(req.params.username);
                            await blockBlobClient.deleteIfExists({ deleteSnapshots: "include" });
                        }

                        if (req.body.newUsername != null) {
                            let oldBlockBlobClient = containerClient.getBlockBlobClient(req.params.username);
                            let newBlockBlobClient = containerClient.getBlockBlobClient(req.body.newUsername);

                            if (await oldBlockBlobClient.exists()) {
                                await (await newBlockBlobClient.beginCopyFromURL(oldBlockBlobClient.url)).pollUntilDone();
                                await oldBlockBlobClient.delete({ deleteSnapshots: "include" });
                            }
                        }
                        
                        if (req.files != undefined && req.files.picture != undefined) {
                            const data = getStream(req.files.picture.data);
                            const blockBlobClient = containerClient.getBlockBlobClient(dataRow[0].value);

                            if (await blockBlobClient.exists())
                                await blockBlobClient.delete({ deleteSnapshots: "include" });
                            await blockBlobClient.uploadStream(data, 4 * 1024 * 1024, 20, {
                                blobHTTPHeaders: {
                                    blobContentType: req.files.picture.mimetype
                                }
                            });
                        }
            
                        let pictureUrl = pictureUrlTemplate.replace("{0}", dataRow[0].value);
                        res.status(200).json({ code: 0, value: { username: dataRow[0].value, email: dataRow[1].value, picture: (await axios.get(pictureUrl, { validateStatus: () => true })).status == 200 ? pictureUrl : null } });
                    }
                    else
                        res.status(500).json({ code: 11, message: "There was an error while editing your profile" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.put("/:username/edit/password", (req, res, next) => {
    try {
        if (req.params.username == null || req.body.password == null || req.body.newPassword == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.params.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.params.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
        else if (req.body.newPassword.length > 50 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(req.body.newPassword))
            res.status(400).json({ code: 6, message: "The new password is not valid" });
        else if (req.body.password == crypto.createHash("sha512").update(req.body.newPassword).digest("hex"))
            res.status(400).json({ code: 17, message: "Both passwords are the same" });
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
                
                request.addParameter("Username", TYPES.VarChar, req.params.username);
                request.addParameter("Password", TYPES.VarChar, req.body.password);

                request.on("row", () => hasRows = true);
                request.on("requestCompleted", () => {
                    if (hasRows) {
                        let hasRows = false, dataRow = null;

                        const request = new Request("SP_PasswordChange", (error) => {
                            if (error)
                                next(error);
                        });
                        
                        request.addParameter("Username", TYPES.VarChar, req.params.username);
                        request.addParameter("Password", TYPES.VarChar, crypto.createHash("sha512").update(req.body.newPassword).digest("hex"));

                        request.on("row", (columns) => {
                            hasRows = true;
                            dataRow = columns;
                        });
                        request.on("requestCompleted", async () => {
                            connection.close();

                            if (hasRows) {
                                let pictureUrl = pictureUrlTemplate.replace("{0}", dataRow[0].value);
                                res.status(200).json({ code: 0, value: { username: dataRow[0].value, email: dataRow[1].value, picture: (await axios.get(pictureUrl, { validateStatus: () => true })).status == 200 ? pictureUrl : null } });
                            }
                            else
                                res.status(500).json({ code: 13, message: "There was an error while changing your password" });
                        });
                        request.on("error", (error) => {
                            connection.close();
                            console.error(error);
                            next(error);
                        });

                        connection.callProcedure(request);
                    }
                    else {
                        connection.close();
                        res.status(400).json({ code: 7, message: "Wrong username or password" });
                    }
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/:username/history", (req, res, next) => {
    try {
        if (req.params.username == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.params.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.params.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
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
                let hasRows = false, dataRow = null;

                const request = new Request("SP_GetUserID", (error) => {
                    if (error)
                        next(error);
                });
                
                request.addParameter("Username", TYPES.VarChar, req.params.username);
                request.addParameter("Password", TYPES.VarChar, req.body.password);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", () => {
                    if (hasRows) {
                        let weekAgo = new Date(), historyData = [];
                        weekAgo.setDate(weekAgo.getDate() - 7);

                        const request = new Request("SP_GetEntriesFromUser", (error) => {
                            if (error)
                                next(error);
                        });

                        request.addParameter("IDUsername", TYPES.Int, dataRow[0].value);
                        request.addParameter("WeekAgo", TYPES.Date, weekAgo);

                        request.on("row", (columns) => {
                            historyData.push({
                                code: columns[0].value,
                                type: columns[1].value,
                                date: columns[2].value
                            });
                        });
                        request.on("requestCompleted", () => {
                            connection.close();
                            res.status(200).json({ code: 0, value: historyData });
                        });
                        request.on("error", (error) => {
                            connection.close();
                            console.error(error);
                            next(error);
                        });

                        connection.callProcedure(request);
                    }
                    else
                        res.status(400).json({ code: 7, message: "Wrong username or password" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.post("/:username/delete", (req, res, next) => {
    try {
        if (req.params.username == null || req.body.password == null)
            res.status(400).json({ code: 1, message: "One of the required parameters is missing" });
        else if (req.params.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.params.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 5, message: "The password provided is not valid" });
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

                request.addParameter("Username", TYPES.VarChar, req.params.username);
                request.addParameter("Password", TYPES.VarChar, req.body.password);

                request.on("row", () => hasRows = true);
                request.on("requestCompleted", () => {
                    if (hasRows) {
                        const request = new Request("SP_DeleteAccount", (error) => {
                            if (error)
                                next(error);
                        });
    
                        request.addParameter("Username", TYPES.VarChar, req.params.username);
                        request.addParameter("Password", TYPES.VarChar, req.body.password);
    
                        request.on("requestCompleted", async () => {
                            connection.close();

                            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                            const containerClient = blobServiceClient.getContainerClient("pictures");
                            const blockBlobClient = containerClient.getBlockBlobClient(req.params.username);

                            if (await blockBlobClient.exists())
                                await blockBlobClient.delete({ deleteSnapshots: "include" });
    
                            res.status(200).json({ code: 0, message: "The account was successfully deleted" });
                        });
                        request.on("error", (error) => {
                            connection.close();
                            console.error(error);
                            next(error);
                        });
    
                        connection.callProcedure(request);
                    }
                    else
                        res.status(400).json({ code: 7, message: "Wrong username or password" });
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    next(error);
                });
    
                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.get("/:username/picture", async (req, res, next) => {
    try {
        if (req.params.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.params.username))
            res.status(400).json({ code: 3, message: "The username provided is not valid" });
        else if (mcache.get(req.originalUrl)) {
            let cached = mcache.get(req.originalUrl);

            res.writeHead(200, { "Content-Type": cached.type, "Content-Length": cached.image.length });
            res.end(cached.image);
        }
        else {
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
            const containerClient = blobServiceClient.getContainerClient("pictures");
            const blockBlobClient = containerClient.getBlockBlobClient(req.params.username);
            const imageBuffer = await blockBlobClient.downloadToBuffer();

            mcache.put(req.originalUrl, { type: (await blockBlobClient.getProperties()).contentType, image: imageBuffer }, 2000);
            res.writeHead(200, { "Content-Type": (await blockBlobClient.getProperties()).contentType, "Content-Length": imageBuffer.length });
            res.end(imageBuffer); 
        }
    }
    catch (error) {
        if (error instanceof RestError)
            res.status(400).json({ code: 16, message: "This user doesn't have a profile picture" });
        else
            next(error);
    }
});

module.exports = router;