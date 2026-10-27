import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";
import { requestLogger, errorHandler, notFoundHandler } from "./middleware";
import v1Routes from "./routes/v1";
import serviceTicketRoutes from "./routes/serviceTicketRoutes";
import shopSettingsRoutes from "./routes/shopSettingsRoutes";
import statisticsRoutes from "./routes/statisticsRoutes";
import { getPublicShelf } from "./controllers/shelfController";
import { renderReviewPage, handleInstagramRedirect } from "./controllers/reviewController";
import pkg from "../package.json";
import { Invoice } from "./models";

dotenv.config();

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Set version in locals for all views
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.version = pkg.version;
  next();
});

// Request logger
app.use(requestLogger);

// View engine setup
app.set("view engine", "ejs");
// Use absolute path for views to work in both dev and prod
app.set("views", path.join(__dirname, "views"));


// Use express-ejs-layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// API Routes (v1)
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

app.get("/products/add", (req, res) => {
  res.render("products-add", { title: "Astr - Add Product" });
});

app.get("/products/edit/:id", (req, res) => {
  res.render("products-edit", { title: "Astr - Edit Product" });
});

// Service Tickets
app.get("/service-tickets", (req: Request, res: Response) => {
  res.render("service-tickets", { title: "Astr - Service Tickets" });
});

app.get("/service-tickets/add", (req: Request, res: Response) => {
  res.render("service-tickets-add", { title: "Astr - Add Service Ticket" });
});

app.get("/service-tickets/:id", (req: Request, res: Response) => {
  res.render("service-ticket-view", { title: "Astr - View Ticket" });
});

// Contacts
app.get("/contacts", (req: Request, res: Response) => {
  res.render("contacts", { title: "Astr - Contacts" });
});

app.get("/contacts/add", (req: Request, res: Response) => {
  res.render("contacts", { title: "Astr - Add Contact" });
});

// Categories
app.get("/categories", (req: Request, res: Response) => {
  res.render("categories", { title: "Astr - Categories" });
});

app.get("/categories/add", (req: Request, res: Response) => {
  res.render("categories-add", { title: "Astr - Add Category" });
});

app.get("/categories/edit/:id", (req: Request, res: Response) => {
  res.render("categories-edit", { title: "Astr - Edit Category" });
});

// Statistics
app.get("/statistics", (req: Request, res: Response) => {
  res.render("statistics", { title: "Astr - Statistics" });
});

// Leads
app.get("/leads", (req: Request, res: Response) => {
  res.render("leads", { title: "Astr - Leads" });
});

// Accounting (Formerly Expenditures)
app.get("/accounting", (req: Request, res: Response) => {
  res.render("accounting", { title: "Astr - Accounting" });
});

// Sales, Invoices & Quotations
app.get("/invoices", (req: Request, res: Response) => {
  res.render("invoices", { title: "Astr - Sales & Invoicing" });
});

app.get("/invoices/create", (req: Request, res: Response) => {
  res.render("invoice-create", { title: "Astr - New Invoice / Quotation" });
});

app.get("/invoices/:id", (req: Request, res: Response) => {
  res.render("invoice-view", { title: "Astr - Invoice Details" });
});

app.get("/invoices/:id/edit", (req: Request, res: Response) => {
  res.render("invoice-create", { title: "Astr - Edit Document" });
});

app.get("/invoices/:id/print", async (req: Request, res: Response) => {
  let docTitle = "Print Document";
  try {
    const inv = await Invoice.findById(req.params.id);
    if (inv && inv.customerName && inv.docNumber) {
      docTitle = `${inv.customerName} - ${inv.docNumber}`;
    }
  } catch (err) {
    // fallback
  }
  res.render("invoice-print", { title: docTitle, docTitle, layout: false });
});

// AI ERP Copilot / Assistant Chat
app.get("/chat", (req: Request, res: Response) => {
  res.render("chat", { title: "Astr - AI Copilot" });
});
app.get("/assistant", (req: Request, res: Response) => {
  res.redirect("/chat");
});

app.get("/product/:productId", getPublicShelf);

// Review Generator Page
app.get("/reviews", renderReviewPage);

// Instagram Follow Redirect Pages
app.get("/instagram", handleInstagramRedirect);
app.get("/ig", handleInstagramRedirect);
app.get("/follow", handleInstagramRedirect);


// Settings
app.get("/settings", (req: Request, res: Response) => {
  res.render("settings", { title: "Astr - Settings" });
});

// About (legacy route)
app.get("/about", (req: Request, res: Response) => {
  res.render("about", { title: "Astr - About" });
});

// Team Management
app.get("/team", (req: Request, res: Response) => {
  res.render("team", { title: "Astr - Team Management" });
});

// WhatsApp Link
app.get("/whatsapp/link", (req: Request, res: Response) => {
  res.render("whatsapp-link", { title: "Astr - WhatsApp Link" });
});

// 404 handler for API routes
app.use("/api", notFoundHandler);

// 404 handler for web routes
app.use((req: Request, res: Response) => {
  res.status(404).render("404", { title: "404 - Not Found", layout: false });
});

// Error handling middleware
app.use(errorHandler);

export default app;
