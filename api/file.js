const router = require("express").Router();
const keygen = require("keygenerator");
const { BlobServiceClient } = require("@azure/storage-blob");
const getStream = require("into-stream");
const package = require("../package.json");
var progresses = {};

router.post("/upload", async (req, res, next) => {
    try {
        if (req.files == undefined)
            res.status(400).json({ code: 1, message: "No files were sent on the request" });
        else {
            let fileCode = keygen._({
                chars: false,
                numbers: true,
                sticks: false,
                specials: false,
                length: 6
            });

            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
            const containerClient = blobServiceClient.getContainerClient(fileCode);
            await containerClient.create();

            const data = getStream(req.files.file.data);
            const blockBlobClient = containerClient.getBlockBlobClient(req.files.file.name);
            blockBlobClient.uploadStream(data, 4 * 1024 * 1024, 20, {
                blobHTTPHeaders: {
                    blobContentType: req.files.file.mimetype
                },
                onProgress: (progress) => {
                    progresses[fileCode] = {
                        percentage: Math.round(((progress.loadedBytes * 100) / req.files.file.size) * 100) / 100
                    };
                }
            });

            res.status(200).json({ code: 0, progressUrl: package.url + "file/" + fileCode + "/progress" });
        }
    }
    catch (error) {
        next(error);
    }
});

router.get("/:code", async (req, res, next) => {
    try {
        res.status(200).json({ code: 0, message: "" });
    }
    catch (error) {
        next(error);
    }
});

router.get("/:code/progress", async (req, res, next) => {
    try {
        let progress = progresses[req.params.code];
        if (progress == undefined)
            res.status(400).json({ code: 1, message: "The code provided is not from a transfer in progress" });
        else {
            if (progress.percentage == 100)
                delete progresses[req.params.code];
            
            res.status(200).json({
                code: 0,
                ...progress
            });
        }
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;