import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";
import { requestLogger, errorHandler, notFoundHandler } from "./middleware";
import v1Routes from "./routes/v1";

dotenv.config();

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Request logger
app.use(requestLogger);

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Use express-ejs-layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// API Routes (v1)
app.use("/api/v1", v1Routes);

// ============================================
// Frontend Routes
// ============================================

// Login route (no layout)
app.get("/login", (req: Request, res: Response) => {
  res.render("login", { layout: false });
});

// Root route - redirect to dashboard
app.get("/", (req: Request, res: Response) => {
  res.redirect("/dashboard");
});

// Dashboard
app.get("/dashboard", (req: Request, res: Response) => {
  res.render("dashboard", { title: "Astr - Dashboard" });
});

// Products
app.get("/products", (req: Request, res: Response) => {
  res.render("products", { title: "Astr - Products" });
});

// Service Tickets
app.get("/service-tickets", (req: Request, res: Response) => {
  res.render("service-tickets", { title: "Astr - Service Tickets" });
});

// Contacts
app.get("/contacts", (req: Request, res: Response) => {
  res.render("contacts", { title: "Astr - Contacts" });
});

// Categories
app.get("/categories", (req: Request, res: Response) => {
  res.render("categories", { title: "Astr - Categories" });
});

// Settings
app.get("/settings", (req: Request, res: Response) => {
  res.render("settings", { title: "Astr - Settings" });
});

// About (legacy route)
app.get("/about", (req: Request, res: Response) => {
  res.render("about", { title: "Astr - About" });
});

// 404 handler for API routes
// app.use("/api/*", notFoundHandler);

// 404 handler for web routes
app.use((req: Request, res: Response) => {
  res.status(404).render("404", { title: "404 - Not Found", layout: false });
});

// Error handling middleware
app.use(errorHandler);

export default app;
