const express = require("express");
const fileUpload = require("express-fileupload");
const PORT = process.env.PORT || 5000;
const app = express();

app.listen(PORT, () => console.log(`Preparado em ${PORT}`));

app.use(express.json({ extended: false }));
app.use(fileUpload());

app.get("/", async (_req, res) => res.status(200).redirect("https://skyshare.pt/"));
app.use("/user", require("./api/user"));
app.use("/file", require("./api/file"));

app.use((_req, res, _next) => res.status(404).json({ code: 44, message: "Page not found" }));
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ code: 50, message: "Server error" });
});