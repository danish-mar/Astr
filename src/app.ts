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

// Frontend Routes
app.get("/", (req: Request, res: Response) => {
  res.render("index", { title: "Astr - Home" });
});

app.get("/about", (req: Request, res: Response) => {
  res.render("about", { title: "Astr - About" });
});

// ejs routes :
// Add after existing routes
app.get("/dashboard", (req: Request, res: Response) => {
  res.render("dashboard", { title: "Astr - Dashboard" });
});

// Update home route to redirect to dashboard
app.get("/", (req: Request, res: Response) => {
  res.redirect("/dashboard");
});

// Add after dashboard route
app.get("/products", (req: Request, res: Response) => {
  res.render("products", { title: "Astr - Products" });
});

// Error handling middleware
app.use(errorHandler);

export default app;
