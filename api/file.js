const router = require("express").Router();
const { config } = require("../config");
const { Connection, Request } = require("tedious");
const { TYPES } = require("tedious");
const keygen = require("keygenerator");
const { BlobServiceClient } = require("@azure/storage-blob");
const progress = require("progress-stream");
const getStream = require("into-stream");
const AdmZip = require("adm-zip");
const package = require("../package.json");
var progresses = {};

router.post("/upload", (req, res, next) => {
    try {
        if (req.files == undefined)
            res.status(400).json({ code: 22, message: "No files were sent on the request" });
        else if (req.body.message && req.body.message.length > 255)
            res.status(400).json({ code: 23, message: "The message provided is too big" });
        else {
            if (!(req.files.file instanceof Array)) {
                let fileHolder = req.files.file;
                req.files.file = new Array();
                req.files.file.push(fileHolder);
            }

            if (req.files.file.length > 50) {
                res.status(400).json({ code: 24, message: "Cannot send over 50 files" });
                return;
            }

            let totalFilesSize = 0;
            req.files.file.forEach((value) => totalFilesSize += value.size);
            if (totalFilesSize > 1073741824)
                res.status(400).json({ code: 25, message: "File size limit exceded, maximum file size is 1 GB" });
            else {
                const connection = new Connection(config);
                connection.on("connect", (error) => {
                    if (error)
                        next(error);
                    else
                        queryDatabase();
                });

                connection.connect();

                async function queryDatabase() {
                    let fileCode = null, sentBy = null, creationDate = new Date(), expireDate = new Date(), pgrSplit = 100 / req.files.file.length;
                    expireDate.setDate(expireDate.getDate() + 8);

                    for (let i = 0; i < 50; i++) {
                        let promiseResult = await new Promise((resolve, reject) => {
                            let hasRows = false, dataRow = null;
                            let randomCode = keygen._({
                                chars: false,
                                numbers: true,
                                sticks: false,
                                specials: false,
                                length: 6
                            });

                            const request = new Request("SP_VerifyTransferCode", (error) => {
                                if (error)
                                    next(error);
                            });

                            request.addParameter("Code", TYPES.VarChar, randomCode);

                            request.on("row", (columns) => {
                                hasRows = true;
                                dataRow = columns;
                            });
                            request.on("requestCompleted", () => resolve({
                                success: hasRows && dataRow[0].value == 0,
                                code: randomCode
                            }));
                            request.on("error", (error) => {
                                console.error(error);
                                reject();
                            });

                            connection.callProcedure(request);
                        });

                        if (promiseResult.success) {
                            fileCode = promiseResult.code;
                            break;
                        }
                    }

                    if (fileCode == null) {
                        connection.close();
                        res.status(500).json({ code: 26, message: "A transfer code couldn't be generated" });
                        return;
                    }

                    progresses[fileCode] = {
                        percentage: 0
                    }

                    if (req.body.username != null && req.body.password != null && req.body.username.length > 15 || !/^[a-zA-Z0-9_.-]*$/.test(req.body.username) && req.body.password.length != 128) {
                        sentBy = await new Promise((resolve) => {
                            let hasRows = false, dataRow = null;

                            const request = new Request("SP_GetUserID", (error) => {
                                if (error)
                                    next(error);
                            });

                            request.addParameter("Username", TYPES.VarChar, req.body.username);
                            request.addParameter("Password", TYPES.VarChar, req.body.password);

                            request.on("row", (columns) => {
                                hasRows = true;
                                dataRow = columns;
                            });
                            request.on("requestCompleted", () => {
                                if (hasRows)
                                    resolve(dataRow[0].value);
                                else
                                    resolve(null);
                            });
                            request.on("error", (error) => {
                                console.error(error);
                                resolve(null);
                            });

                            connection.callProcedure(request);
                        });
                    }

                    let hasRows = false, dataRow = null;

                    const request = new Request("SP_SendFile", (error) => {
                        if (error)
                            next(error);
                    });

                    request.addParameter("TransferCode", TYPES.VarChar, fileCode);
                    request.addParameter("Message", TYPES.VarChar, req.body.message ? req.body.message : null);
                    request.addParameter("SentBy", TYPES.Int, sentBy);
                    request.addParameter("CreationDate", TYPES.Date, creationDate);
                    request.addParameter("ExpireDate", TYPES.Date, expireDate);

                    request.on("row", (columns) => {
                        hasRows = true;
                        dataRow = columns;
                    });
                    request.on("requestCompleted", async () => {
                        if (hasRows) {
                            let saveEntry = req.body.save == undefined ? true : req.body.save == "true";
                            if (sentBy != null && saveEntry) {
                                await new Promise((resolve) => {
                                    const request = new Request("SP_SaveEntry", (error) => {
                                        if (error)
                                            next(error);
                                    });

                                    request.addParameter("BelongsTo", TYPES.Int, sentBy);
                                    request.addParameter("Type", TYPES.Int, 0);
                                    request.addParameter("Transfer", TYPES.Int, dataRow[0].value);
                                    request.addParameter("CreationDate", TYPES.Date, creationDate);

                                    request.on("requestCompleted", () => resolve());
                                    request.on("error", (error) => {
                                        console.error(error);
                                        resolve();
                                    });

                                    connection.callProcedure(request);
                                });
                            }

                            connection.close();

                            res.status(200).json({ code: 0, progressUrl: package.url + "file/progress/" + fileCode });

                            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                            const containerClient = blobServiceClient.getContainerClient(fileCode);
                            await containerClient.create();

                            for (let i = 0; i < req.files.file.length; i++) {
                                let streamProgress = progress({ length: req.files.file[i].size, time: 1000 });
                                streamProgress.on("progress", async (progress) => {
                                    if (progresses[fileCode] != undefined) {
                                        progresses[fileCode].percentage = Math.round(progress.percentage * pgrSplit / 100 + pgrSplit * i);
                                        progresses[fileCode].speed = Math.round((progress.speed / 1024 / 1024) * 100) / 100 + " MB/s";
                                        progresses[fileCode].eta = await new Promise((resolve) => {
                                            if (progress.eta >= 60) {
                                                let tempEta = progress.eta, minutes = 0;
                                                while (tempEta >= 60) {
                                                    tempEta - 60;
                                                    minutes++;
                                                }
                                                resolve(minutes + (minutes == 1 ? " minuto" : " minutos"));
                                            }
                                            else
                                                resolve(progress.eta + " segundos");
                                        });

                                        if (progresses[fileCode].percentage == 100) {
                                            progresses[fileCode].transfer = {
                                                code: fileCode,
                                                creation: creationDate,
                                                expire: expireDate
                                            }
                                        }
                                    }
                                });

                                const data = getStream(req.files.file[i].data);
                                const blockBlobClient = containerClient.getBlockBlobClient(req.files.file[i].name);
                                await blockBlobClient.uploadStream(data.pipe(streamProgress), 4 * 1024 * 1024, 20, {
                                    blobHTTPHeaders: {
                                        blobContentType: req.files.file[i].mimetype
                                    }
                                });
                            }
                        }
                        else
                            res.status(500).json({ code: 4, message: "Erro" });
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
    }
    catch (error) {
        next(error);
    }
});

router.get("/:code", async (req, res, next) => {
    try {
        if (req.params.code.length != 6 && !/^\d{6}$/g.test(req.params.code))
            res.status(400).json({ code: 27, message: "Not a valid transfer code" });
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

                const request = new Request("SP_VerifyTransferCode", (error) => {
                    if (error)
                        next(error);
                });

                request.addParameter("Code", TYPES.VarChar, req.params.code);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", async () => {
                    connection.close();

                    if (hasRows && dataRow[0].value == 0) {
                        res.status(400).json({ code: 28, message: "A transfer does not exist with that code" });
                        return;
                    }

                    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                    const containerClient = blobServiceClient.getContainerClient(req.params.code);
                    const blobList = (await containerClient.listBlobsFlat().byPage({ maxPageSize: 50 }).next()).value;
            
                    if (blobList.segment.blobItems.length == 1) {
                        res.setHeader("Content-Disposition", `attachment; filename="${blobList.segment.blobItems[0].name}"`);
                        res.status(200).end(await containerClient.getBlobClient(blobList.segment.blobItems[0].name).downloadToBuffer());
                    }
                    else {
                        var transferZip = new AdmZip();
            
                        for (const blob of blobList.segment.blobItems) {
                            let blobclient = containerClient.getBlobClient(blob.name);
                            transferZip.addFile(blob.name, await blobclient.downloadToBuffer());
                        }
            
                        res.setHeader("Content-Disposition", `attachment; filename="${req.params.code}.zip"`);
                        res.status(200).end(await transferZip.toBufferPromise());
                    }
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    res.status(500).json({ code: 29, message: "The code could not be verified" });
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.get("/:code/info", async (req, res, next) => {
    try {
        if (req.params.code.length != 6 && !/^\d{6}$/g.test(req.params.code))
            res.status(400).json({ code: 27, message: "Not a valid transfer code" });
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

                const request = new Request("SP_VerifyTransferCode", (error) => {
                    if (error)
                        next(error);
                });

                request.addParameter("Code", TYPES.VarChar, req.params.code);

                request.on("row", (columns) => {
                    hasRows = true;
                    dataRow = columns;
                });
                request.on("requestCompleted", async () => {
                    if (hasRows && dataRow[0].value == 0) {
                        res.status(400).json({ code: 28, message: "A transfer does not exist with that code" });
                        return;
                    }
                    hasRows = false;
                    dataRow = null;

                    const request = new Request("SP_GetTransferData", (error) => {
                        if (error)
                            next(error);
                    });

                    request.addParameter("Code", TYPES.VarChar, req.params.code);

                    request.on("row", (columns) => {
                        hasRows = true;
                        dataRow = columns;
                    });
                    request.on("requestCompleted", async () => {
                        connection.close();

                        if (hasRows) {
                            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
                            const containerClient = blobServiceClient.getContainerClient(req.params.code);
                            const blobList = (await containerClient.listBlobsFlat().byPage({ maxPageSize: 50 }).next()).value;

                            let fileName;
                            if (blobList.segment.blobItems.length == 1)
                                fileName = blobList.segment.blobItems[0].name;
                            else
                                fileName = req.params.code + ".zip";

                            res.status(200).json({ code: 0, value: { message: dataRow[0].value, sentBy: dataRow[1].value, creationDate: dataRow[2].value, expireDate: dataRow[3].value, fileName: fileName } });
                        }
                        else
                            res.status(500).json({ code: 30, message: "The transfer data couldn't be fetched" });
                    });
                    request.on("error", (error) => {
                        connection.close();
                        console.error(error);
                        res.status(500).json({ code: 30, message: "The transfer data couldn't be fetched" });
                    });
        
                    connection.callProcedure(request);
                });
                request.on("error", (error) => {
                    connection.close();
                    console.error(error);
                    res.status(500).json({ code: 29, message: "The code could not be verified" });
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

router.get("/progress/:code", async (req, res, next) => {
    try {
        if (req.params.code.length != 6 && !/^\d{6}$/g.test(req.params.code))
            res.status(400).json({ code: 27, message: "Not a valid transfer code" });
        else {
            let progress = progresses[req.params.code];
            if (progress == undefined)
                res.status(400).json({ code: 31, message: "The code provided is not from a transfer in progress" });
            else {
                if (progress.percentage == 100)
                    delete progresses[req.params.code];
                
                res.status(200).json({
                    code: 0,
                    value: progress
                });
            }
        }
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;