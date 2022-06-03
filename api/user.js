const router = require("express").Router();
const { Connection, Request } = require("tedious");
const { config } = require("../config");

router.post("/login", async (req, res, next) => {
    try {
        if (req.body.username == null || req.body.password == null)
            res.status(400).json({ code: 400, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 400, message: "The username provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 400, message: "The hashed password is not valid" });
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
                const VarChar = require("tedious/lib/data-types/varchar");

                const request = new Request("SP_Login", (error) => {
                    if (error)
                        next(error);
                });
                request.addParameter("Username", VarChar, req.body.username);
                request.addParameter("Password", VarChar, req.body.password);

                request.on("row", (columns) => res.status(200).json({ code: 200, value: columns }));
    
                connection.callProcedure(request);
                connection.close();
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
            res.status(400).json({ code: 400, message: "One of the required parameters is missing" });
        else if (req.body.username.length > 15)
            res.status(400).json({ code: 400, message: "The username provided is not valid" });
        else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(req.body.email) || req.body.email.length > 250)
            res.status(400).json({ code: 400, message: "The email provided is not valid" });
        else if (req.body.password.length != 128)
            res.status(400).json({ code: 400, message: "The hashed password is not valid" });
        else {

        }
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;