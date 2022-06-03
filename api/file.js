const router = require("express").Router();
const { BlockBlobClient, BlobServiceClient } = require("@azure/storage-blob");
const getStream = require("into-stream");
const { config } = require("../config");

router.post("/upload", async (req, res, next) => {
    try {
        let blobName = "123456";



        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.connection);
        const containerClient = blobServiceClient.getContainerClient(blobName);
        await containerClient.create();





        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(getStream(req.files.file.data), req.files.file.data.length);



        const downloadBlockBlobResponse = await blockBlobClient.download(0);


        // https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs?tabs=environment-variable-windows


        res.end();

        /*function queryDatabase() {
            console.log("Reading rows from the Table...");

            // Read all rows from table
            const request = new Request(
                `SELECT TOP 20 pc.Name as CategoryName,
                   p.name as ProductName
     FROM [SalesLT].[ProductCategory] pc
     JOIN [SalesLT].[Product] p ON pc.productcategoryid = p.productcategoryid`,
                (err, rowCount) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        console.log(`${rowCount} row(s) returned`);
                    }
                }
            );

            request.on("row", columns => {
                columns.forEach(column => {
                    console.log("%s\t%s", column.metadata.colName, column.value);
                });
            });

            connection.execSql(request);
        }*/
    }
    catch (error) {
        next(error);
    }
});

router.get("/:code", async (req, res, next) => {
    try {
        
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;