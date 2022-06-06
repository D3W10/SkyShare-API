const router = require("express").Router();
const { Connection, Request } = require("tedious");
const keygen = require("keygenerator");
const { config } = require("../config");

//https://www.npmjs.com/package/keygenerator

router.post("/login", async (req, res, next) => {
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
                const VarChar = require("tedious/lib/data-types/varchar");

                const request = new Request("SP_Login", (error) => {
                    if (error)
                        next(error);
                });
                request.addParameter("Username", VarChar, req.body.username);
                request.addParameter("Password", VarChar, req.body.password);

                request.on("row", (columns) => {
                    hasRows = true;
                    res.status(200).json({ code: 0, value: { username: columns[0].value, email: columns[1].value, picture: "https://skyshare-api.herokuapp.com/user/picture/" + columns[0].value }});
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 4, message: "Login details not valid" })
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
        else {

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
                const VarChar = require("tedious/lib/data-types/varchar");

                const request = new Request("SP_GetPicture", (error) => {
                    if (error)
                        next(error);
                });
                request.addParameter("Username", VarChar, req.params.username);

                request.on("row", (columns) => {
                    hasRows = true;
                    let originalBase64ImageStr = new Buffer(columns[0].value).toString("utf8");
                    let decodedImage = new Buffer(originalBase64ImageStr , "base64");

                    res.status(200).end(decodedImage); 

                    //res.status(200).json({ code: 0, value: { columns[0].value } })
                });
                request.on("requestCompleted", () => {
                    connection.close();
                    if (!hasRows)
                        res.status(400).json({ code: 2, message: "The username provided does not exist" })
                });

                connection.callProcedure(request);
            }
        }
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;