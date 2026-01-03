// -------------------------
// server.js
// -------------------------
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

// -------------------------
// Global Error Handlers
// -------------------------
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

// -------------------------
// CORS
// -------------------------
app.use(cors({
  origin: ["http://localhost:5173", "https://amnish.yimson.pro"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());

// -------------------------
// Data & Images
// -------------------------
const DATA_FILE = path.join(process.cwd(), "data/products.json");
const IMAGES_DIR = path.join(process.cwd(), "server/images");

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

app.use("/images", express.static(IMAGES_DIR));

// -------------------------
// Helpers
// -------------------------
const readProducts = () =>
  fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
    : [];

const writeProducts = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

const deleteImageFile = (url) => {
  if (!url) return;
  const filename = url.split("/images/")[1];
  const filePath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// -------------------------
// Multer Setup
// -------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, IMAGES_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// -------------------------
// Auth Middleware
// -------------------------
const protectDashboard = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.sendStatus(401);
  const token = auth.split(" ")[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
};

// -------------------------
// Routes
// -------------------------

// Health Check
app.get("/", (_, res) => res.send("🚀 Backend is running"));

// Unlock Dashboard
app.post("/api/unlock", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: "PIN required" });
    const isValid = await bcrypt.compare(pin, process.env.DASHBOARD_PIN_HASH);
    if (!isValid) return res.status(401).json({ message: "Invalid PIN" });
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Upload Image
app.post("/api/upload", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) return res.status(400).json({ message: "No image received" });

    res.status(200).json({
      message: "Upload successful",
      url: `${BASE_URL}/images/${req.file.filename}`,
    });
  });
});

// Get Products
app.get("/api/products", (_, res) => {
  try {
    res.json(readProducts());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add Product
app.post("/api/products", (req, res) => {
  try {
    const products = readProducts();
    const product = { ...req.body, id: Date.now(), discover: req.body.discover ?? false };
    products.push(product);
    writeProducts(products);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update Product
app.put("/api/products/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return res.sendStatus(404);

    if (products[index].image !== req.body.image) deleteImageFile(products[index].image);

    products[index] = { ...req.body, id, discover: req.body.discover ?? false };
    writeProducts(products);
    res.json(products[index]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Product
app.delete("/api/products/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const products = readProducts();
    const product = products.find((p) => p.id === id);
    if (!product) return res.sendStatus(404);

    deleteImageFile(product.image);
    writeProducts(products.filter((p) => p.id !== id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Protected Dashboard
app.get("/api/dashboard", protectDashboard, (_, res) => {
  res.json({ message: "Welcome to the dashboard" });
});

// -------------------------
// Start Server
// -------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
