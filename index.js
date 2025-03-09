require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const compression = require("compression");

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(compression());

// Database Connection
mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Failed:", err));

// Root API
app.get("/", (req, res) => {
  res.send("Express app is running...");
});

// Image Storage Configuration
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

app.use("/images", express.static("upload/images"));

// Image Upload API
app.post("/upload", upload.single("products"), (req, res) => {
  res.json({
    success: true,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
  });
});

// Product Schema
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true },
});

// User Schema
const User = mongoose.model("User", {
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  cartData: { type: Object, default: {} },
  date: { type: Date, default: Date.now },
});

// Authentication Middleware
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ error: "Access Denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified.user;
    next();
  } catch {
    res.status(401).send({ error: "Invalid Token" });
  }
};

// User Signup
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (await User.findOne({ email })) {
    return res.status(400).json({ success: false, error: "User already exists" });
  }

  const cart = {};
  for (let i = 0; i < 300; i++) cart[i] = 0;

  const user = new User({ name: username, email, password, cartData: cart });
  await user.save();

  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ success: true, token });
});

// User Login
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user || req.body.password !== user.password) {
    return res.status(400).json({ success: false, error: "Invalid Credentials" });
  }

  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ success: true, token });
});

// Get New Collections
app.get("/newCollections", async (req, res) => {
  const products = await Product.find().sort({ date: -1 }).limit(8);
  res.json(products);
});

// Add Product to Cart
app.post("/addToCart", fetchUser, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.cartData[req.body.itemId] = (user.cartData[req.body.itemId] || 0) + 1;

  await User.findByIdAndUpdate(req.user.id, { cartData: user.cartData });
  res.send("Added to cart");
});

// Add New Product
app.post("/addproduct", async (req, res) => {
  const lastProduct = await Product.findOne().sort({ id: -1 });
  const id = lastProduct ? lastProduct.id + 1 : 1;

  const product = new Product({ id, ...req.body });
  await product.save();

  res.json({ success: true, name: req.body.name });
});

// Get All Products
app.get("/getallproducts", async (req, res) => {
  const products = await Product.find().select("-__v");
  res.json(products);
});

// Remove Product
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({ success: true });
});

// Server Start
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
