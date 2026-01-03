import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ----------------- CORS -----------------
app.use(cors({
  origin: ["http://localhost:5173", "https://amnish.yimson.pro"],
  credentials: true,
}));

app.use(express.json());

// ----------------- Health Check -----------------
app.get("/", (_, res) => res.send("🚀 Backend is running"));

// ----------------- Images -----------------
const IMAGES_DIR = path.join(process.cwd(), "server/images");
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
app.use("/images", express.static(IMAGES_DIR));

// ----------------- Multer -----------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, IMAGES_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// ----------------- Upload Route -----------------
app.post("/api/upload", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No image received" });
    res.json({ url: `${BASE_URL}/images/${req.file.filename}` });
  });
});

// ----------------- Products -----------------
const DATA_FILE = path.join(process.cwd(), "data/products.json");

const readProducts = () =>
  fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) : [];
const writeProducts = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.get("/api/products", (_, res) => res.json(readProducts()));

app.post("/api/products", (req, res) => {
  const products = readProducts();
  const product = { ...req.body, id: Date.now(), discover: req.body.discover ?? false };
  products.push(product);
  writeProducts(products);
  res.json(product);
});

// ----------------- Start Server -----------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
