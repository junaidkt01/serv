const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3002;

app.use(express.static("uploads"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  cors({
    origin: "*",
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: null,
  database: "wisbaqjz_web_node",
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL database connected");
});

app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }
  const sql = "SELECT * FROM admin WHERE email = ?";
  db.query(sql, [email], (err, result) => {
    if (err) {
      console.log(err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

    if (result.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const insertSql =
      "INSERT INTO admin (name, email, password) VALUES (?, ?, ?)";
    db.query(insertSql, [name, email, hashedPassword], (err, result) => {
      if (err) {
        console.log(err);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }

      return res
        .status(201)
        .json({ success: true, message: "User created successfully" });
    });
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM admin WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error logging in");
    } else if (results.length === 0) {
      res.status(401).send("Invalid email or password");
    } else {
      const user = results[0];
      if (bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id }, "your_jwt_secret", {
          expiresIn: "1h",
        });

        const { name, email } = user;
        res.status(200).json({ token, name, email });
      } else {
        res.status(401).send("Invalid email or password");
      }
    }
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, "your_jwt_secret", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// BLOGS
app.get("/api/blogs", (req, res) => {
  const sql = "SELECT * FROM web_blogs";
  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error retrieving blogs");
    } else {
      res.status(200).json(results);
    }
  });
});

app.get("/api/blogs/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM web_blogs WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error retrieving blog");
    } else if (results.length === 0) {
      res.status(404).send("Blog not found");
    } else {
      res.status(200).json(results[0]);
    }
  });
});

app.post(
  "/api/blogs",
  upload.single("image"),
  authenticateToken,
  (req, res) => {
    const { title, description } = req.body;
    const imageUrl = req.file.path;
    const date_added = new Date().toISOString().slice(0, 10);
    const date_updated = new Date().toISOString().slice(0, 10);
    console.log("imageUrl", imageUrl);

    const query =
      "INSERT INTO web_blogs (title, description, image, date_added, date_updated) VALUES (?, ?, ?, ?, ?)";
    const values = [title, description, imageUrl, date_added, date_updated];

    db.query(query, values, (err, result) => {
      if (err) throw err;
      res.status(201).json({ message: "Blog added successfully" });
    });
  }
);

app.put(
  "/api/blogs/:id",
  upload.single("image"),
  authenticateToken,
  (req, res) => {
    const blogId = req.params.id;
    const { title, description } = req.body;
    const date_updated = new Date().toISOString().slice(0, 10);
    let imageUrl;

    if (req.file) {
      imageUrl = req.file.path;
    } else {
      imageUrl = req.body.imageUrl;
    }

    const query = `UPDATE web_blogs SET title=?, description=?, image=?, date_updated=? WHERE id=?`;
    const values = [title, description, imageUrl, date_updated, blogId];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update blog" });
      } else {
        res.status(200).json({ message: "Blog updated successfully" });
      }
    });
  }
);

app.delete("/api/blogs/:id", authenticateToken, (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM web_blogs WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error deleting blog");
    } else if (result.affectedRows === 0) {
      res.status(404).send("Blog not found");
    } else {
      res.status(200).send("Blog deleted successfully");
    }
  });
});

// META TAGS
app.get("/api/metatags", (req, res) => {
  const sql = "SELECT * FROM meta_tags";
  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error retrieving blogs");
    } else {
      res.status(200).json(results);
    }
  });
});

app.get("/api/metatags/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM meta_tags WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error retrieving blog");
    } else if (results.length === 0) {
      res.status(404).send("Blog not found");
    } else {
      res.status(200).json(results[0]);
    }
  });
});

app.post("/api/metatags", (req, res) => {
  const { title, description, selectedValue } = req.body;

  const sql =
    "INSERT INTO meta_tags (title, description, selected_value, date_added, date_updated) VALUES (?, ?, ?, ?, ?)";
  const values = [
    title,
    description,
    selectedValue,
    new Date().toISOString().slice(0, 10),
    new Date().toISOString().slice(0, 10),
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error inserting new meta tag");
    } else {
      res.status(200).send("New meta tag added successfully");
    }
  });
});

app.put("/api/metatags/:id", (req, res) => {
  const id = req.params.id;
  const { title, description } = req.body;
  const date_updated = new Date().toISOString().slice(0, 10);

  const sql =
    "UPDATE meta_tags SET title = ?, description = ?, date_updated = ? WHERE id = ?";
  db.query(sql, [title, description, date_updated, id], (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error updating meta tag");
    } else if (results.affectedRows === 0) {
      res.status(404).send("Meta tag not found");
    } else {
      res.status(200).json(results);
    }
  });
});

app.delete("/api/metatags/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM meta_tags WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Error deleting blog");
    } else if (result.affectedRows === 0) {
      res.status(404).send("Blog not found");
    } else {
      res.status(200).send("Blog deleted successfully");
    }
  });
});

if (process.env.NODE_ENV == "production") {
  app.use(express.static("client/build"));
}

app.listen(port, () =>
  console.log(`Blog app listening at http://localhost:${port}`)
);
