import mongoose from "mongoose";
import { Product, ServiceTicket, Contact, Invoice, ShopSettings, Category } from "../models";
import { calculateGstTotals } from "../controllers/invoiceController";
import aiService from "./aiService";

export interface IAssistantResponse {
    reply: string;
    cardType: "text" | "products" | "ticket" | "invoice" | "kpis";
    cardData?: any;
    actionTaken?: string;
}

class AssistantService {
    private static instance: AssistantService;

    private constructor() { }

    static getInstance(): AssistantService {
        if (!AssistantService.instance) {
            AssistantService.instance = new AssistantService();
        }
        return AssistantService.instance;
    }

    /**
     * Helper to find or create customer contact by name/phone
     */
    private async findOrCreateCustomer(name: string, phone?: string, address?: string, gstin?: string, state?: string) {
        let cleanName = (name || "Walk-in Customer").trim();
        let cleanPhone = (phone || "").trim();

        let contact = null;
        if (cleanPhone && cleanPhone !== "9999999999") {
            contact = await Contact.findOne({ phone: cleanPhone });
        }
        if (!contact && cleanName && cleanName !== "Walk-in Customer") {
            contact = await Contact.findOne({ name: { $regex: `^${cleanName}$`, $options: "i" } });
        }

        if (!contact) {
            contact = new Contact({
                name: cleanName,
                phone: cleanPhone || "9999999999",
                address: address || "",
                gstin: gstin || "",
                state: state || "",
                contactType: "Customer",
            });
            await contact.save();
        } else {
            // Update fields if provided
            let modified = false;
            if (gstin && !contact.gstin) { contact.gstin = gstin; modified = true; }
            if (state && !contact.state) { contact.state = state; modified = true; }
            if (address && !contact.address) { contact.address = address; modified = true; }
            if (modified) await contact.save();
        }

        return contact;
    }

    /**
     * Action: Search Products
     */
    async searchProducts(params: { query?: string; category?: string; maxPrice?: number; minPrice?: number; inStockOnly?: boolean }) {
        const filter: any = {};

        if (params.inStockOnly !== false) {
            filter.isSold = false;
        }

        if (params.maxPrice || params.minPrice) {
            filter.price = {};
            if (params.maxPrice) filter.price.$lte = Number(params.maxPrice);
            if (params.minPrice) filter.price.$gte = Number(params.minPrice);
        }

        if (params.query) {
            const q = params.query.trim();
            filter.$or = [
                { name: { $regex: q, $options: "i" } },
                { tags: { $in: [new RegExp(q, "i")] } },
                { productID: { $regex: q, $options: "i" } },
            ];
        }

        if (params.category) {
            const cat = await Category.findOne({ name: { $regex: params.category, $options: "i" } });
            if (cat) filter.category = cat._id;
        }

        const products = await Product.find(filter)
            .populate("category", "name")
            .sort({ price: 1 })
            .limit(8);

        return products.map(p => ({
            id: p._id,
            productID: p.productID,
            name: p.name,
            category: (p.category as any)?.name || "General",
            price: p.price,
            specifications: p.specifications ? Object.fromEntries(p.specifications) : {},
            tags: p.tags || [],
            images: p.images || [],
            isSold: p.isSold,
        }));
    }

    /**
     * Action: Create Service Ticket
     */
    async createServiceTicket(params: {
        customerName: string;
        customerPhone?: string;
        deviceDetails: string;
        serviceCharge?: number;
        notes?: string;
        assignedTechnician?: string;
    }) {
        if (!params.customerName || !params.deviceDetails) {
            throw new Error("Customer name and device details are required to create a ticket.");
        }

        const customer = await this.findOrCreateCustomer(params.customerName, params.customerPhone);

        // Generate unique 6-digit ticket number
        let ticketNumber = Math.floor(100000 + Math.random() * 900000).toString();
        let exists = await ServiceTicket.findOne({ ticketNumber });
        while (exists) {
            ticketNumber = Math.floor(100000 + Math.random() * 900000).toString();
            exists = await ServiceTicket.findOne({ ticketNumber });
        }

        const charge = Number(params.serviceCharge) || 0;

        const ticket = new ServiceTicket({
            ticketNumber,
            customer: customer._id,
            deviceDetails: params.deviceDetails.trim(),
            status: "Pending",
            assignedTechnician: params.assignedTechnician || undefined,
            serviceCharge: charge,
            notes: params.notes || undefined,
            logs: [
                {
                    status: "Pending",
                    label: "Ticket created by AI ERP Assistant",
                    timestamp: new Date(),
                },
            ],
        });

        await ticket.save();

        return {
            id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            customerName: customer.name,
            customerPhone: customer.phone,
            deviceDetails: ticket.deviceDetails,
            status: ticket.status,
            serviceCharge: ticket.serviceCharge || 0,
            assignedTechnician: ticket.assignedTechnician || "Unassigned",
        };
    }

    /**
     * Action: Create Quotation or Invoice
     */
    async createInvoiceOrQuotation(params: {
        docType: "Invoice" | "Quotation";
        customerName: string;
        customerPhone?: string;
        customerAddress?: string;
        customerGstin?: string;
        customerState?: string;
        items: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            gstRate?: number;
            hsnSac?: string;
        }>;
        notes?: string;
        terms?: string;
    }) {
        if (!params.customerName) {
            throw new Error("Customer name is required.");
        }
        if (!params.items || params.items.length === 0) {
            throw new Error("At least one line item is required.");
        }

        const settings = await ShopSettings.getSettings();
        const customer = await this.findOrCreateCustomer(
            params.customerName,
            params.customerPhone,
            params.customerAddress,
            params.customerGstin,
            params.customerState
        );

        const isQuotation = params.docType === "Quotation";

        // Generate sequence document number
        let prefix = isQuotation ? (settings.quotationPrefix || "QTN-") : (settings.invoicePrefix || "INV-");
        let nextNum = isQuotation ? (settings.quotationNextNumber || 1001) : (settings.invoiceNextNumber || 1001);

        let candidate = `${prefix}${nextNum}`;
        let exists = await Invoice.findOne({ docNumber: candidate });
        while (exists) {
            nextNum += 1;
            candidate = `${prefix}${nextNum}`;
            exists = await Invoice.findOne({ docNumber: candidate });
        }

        const docNumber = candidate;

        // Increment sequence in settings
        if (isQuotation) {
            settings.quotationNextNumber = nextNum + 1;
        } else {
            settings.invoiceNextNumber = nextNum + 1;
        }
        await settings.save();

        // Calculate GST
        const shopState = settings.state || "";
        const customerState = params.customerState || customer.state || "";
        const defaultRate = settings.defaultGstRate || 18;

        const preparedItems = params.items.map(it => ({
            itemType: "custom" as const,
            description: it.description || "Product / Service",
            hsnSac: it.hsnSac || "",
            quantity: Math.max(1, Number(it.quantity) || 1),
            unitPrice: Math.max(0, Number(it.unitPrice) || 0),
            discountPercent: 0,
            gstRate: it.gstRate !== undefined ? Number(it.gstRate) : defaultRate,
        }));

        const totals = calculateGstTotals(preparedItems, shopState, customerState);

        const invoice = new Invoice({
            docNumber,
            docType: params.docType || "Quotation",
            customer: customer._id,
            customerName: customer.name,
            customerPhone: customer.phone || "",
            customerEmail: "",
            customerAddress: params.customerAddress || customer.address || "",
            customerGstin: params.customerGstin || customer.gstin || "",
            customerState: customerState,
            items: totals.processedItems,
            subtotal: totals.subtotal,
            discountTotal: totals.totalDiscount,
            taxableTotal: totals.taxableTotal,
            cgstTotal: totals.cgstTotal,
            sgstTotal: totals.sgstTotal,
            igstTotal: totals.igstTotal,
            taxTotal: totals.taxTotal,
            roundOff: totals.roundOff,
            grandTotal: totals.grandTotal,
            paidAmount: 0,
            balanceDue: totals.grandTotal,
            status: isQuotation ? "Draft" : "Unpaid",
            issueDate: new Date(),
            notes: params.notes || undefined,
            terms: params.terms || settings.invoiceTerms || undefined,
        });

        await invoice.save();

        return {
            id: invoice._id,
            docNumber: invoice.docNumber,
            docType: invoice.docType,
            customerName: invoice.customerName,
            customerPhone: invoice.customerPhone,
            items: invoice.items,
            taxableTotal: invoice.taxableTotal,
            cgstTotal: invoice.cgstTotal,
            sgstTotal: invoice.sgstTotal,
            igstTotal: invoice.igstTotal,
            grandTotal: invoice.grandTotal,
            status: invoice.status,
            createdAt: invoice.createdAt,
        };
    }

    /**
     * Action: Get Shop KPIs
     */
    async getShopKpis() {
        const [pendingTickets, unpaidInvoices, inStockCount, totalQuotations] = await Promise.all([
            ServiceTicket.countDocuments({ status: { $in: ["Pending", "In Progress"] } }),
            Invoice.countDocuments({ docType: "Invoice", status: { $in: ["Unpaid", "Partially Paid"] } }),
            Product.countDocuments({ isSold: false }),
            Invoice.countDocuments({ docType: "Quotation" }),
        ]);

        return {
            pendingTickets,
            unpaidInvoices,
            inStockCount,
            totalQuotations,
        };
    }

    /**
     * Process user query using AI and dispatch tool actions
     */
    async processChat(userMessage: string, chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<IAssistantResponse> {
        const settings = await ShopSettings.getSettings();
        const categories = await Category.find({}).select("name");
        const categoryNames = categories.map(c => c.name).join(", ") || "Laptops, Desktops, Accessories";

        const todayStr = new Date().toLocaleDateString("en-IN", { dateStyle: "full" });

        const systemPrompt = `You are the AI ERP Assistant for ${settings.shopName || "Astr Computer Shop"}.
Today is ${todayStr}.
Shop State: ${settings.state || "Default State"}
Default GST Rate: ${settings.defaultGstRate || 18}%
Product Categories: ${categoryNames}

Your job is to understand what the user wants and perform ERP operations directly.

AVAILABLE ACTIONS:
1. "search_products":
   Use when the user asks for laptops, hardware, parts, or products under a budget or from catalog.
   Parameters:
   - "query": string (e.g. "laptop", "SSD", "Dell", "monitor")
   - "category": string (optional)
   - "maxPrice": number (optional, e.g. 50000)
   - "minPrice": number (optional)

2. "create_service_ticket":
   Use when the user wants to log or create a repair ticket / service ticket for a device.
   Parameters:
   - "customerName": string (required)
   - "customerPhone": string (optional)
   - "deviceDetails": string (required, brand/model and fault description)
   - "serviceCharge": number (optional, estimated cost)
   - "notes": string (optional)

3. "create_invoice_or_quotation":
   Use when the user wants to generate a quotation (estimate) or invoice (tax invoice/bill).
   Parameters:
   - "docType": "Quotation" or "Invoice" (use "Quotation" if user said quote/quotation/estimate, "Invoice" for invoice/bill)
   - "customerName": string (required)
   - "customerPhone": string (optional)
   - "customerAddress": string (optional)
   - "customerGstin": string (optional)
   - "customerState": string (optional)
   - "items": array of items:
     [
       {
         "description": string,
         "quantity": number,
         "unitPrice": number,
         "gstRate": number (e.g. 18, 12, 5, 28)
       }
     ]
   - "notes": string (optional)

4. "get_shop_kpis":
   Use when the user asks for dashboard summary, pending repairs, open bills count, etc.
   Parameters: {}

5. null (No action):
   Use for general questions, clarifications, greetings, or explanations.

IMPORTANT RULES:
- If prices or quantities are mentioned, parse them accurately.
- If GST rate is specified by user (e.g. "with gst 12%"), apply that gstRate to the items; otherwise use default ${settings.defaultGstRate || 18}%.
- You MUST respond with a valid JSON object ONLY. No conversational prefix or markdown outside the JSON block.

JSON OUTPUT STRUCTURE:
{
  "thought": "brief reason for chosen action",
  "action": "search_products" | "create_service_ticket" | "create_invoice_or_quotation" | "get_shop_kpis" | null,
  "parameters": { ... },
  "reply": "Friendly concise confirmation message to user"
}`;

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt }
        ];

        // Append recent history (last 4 messages)
        const recentHistory = chatHistory.slice(-4);
        for (const h of recentHistory) {
            messages.push({ role: h.role, content: h.content });
        }

        messages.push({ role: "user", content: userMessage });

        let rawResponse = "";
        try {
            rawResponse = await aiService.chatCompletion(messages);
        } catch (error: any) {
            console.warn("[AssistantService] AI Chat completion error:", error.message);

            // Fallback for when AI is not configured or offline
            return this.fallbackRegexParser(userMessage);
        }

        // Parse JSON response from LLM
        let parsed: any = null;
        try {
            // Remove code fences if LLM wrapped in ```json ... ```
            let cleaned = rawResponse.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
            }
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            // If LLM returned raw text instead of JSON, treat as text reply
            console.warn("[AssistantService] Could not parse JSON from LLM output:", rawResponse);
            return {
                reply: rawResponse.replace(/```json|```/g, "").trim(),
                cardType: "text",
            };
        }

        const action = parsed?.action;
        const params = parsed?.parameters || {};
        const replyText = parsed?.reply || "Here is what I found:";

        // Dispatch Action
        try {
            if (action === "search_products") {
                const products = await this.searchProducts(params);
                if (products.length === 0) {
                    return {
                        reply: `I searched our catalog${params.query ? ` for "${params.query}"` : ""}${params.maxPrice ? ` under ₹${params.maxPrice.toLocaleString("en-IN")}` : ""}, but didn't find any items in stock matching your criteria.`,
                        cardType: "text",
                        actionTaken: action,
                    };
                }
                return {
                    reply: replyText,
                    cardType: "products",
                    cardData: products,
                    actionTaken: action,
                };
            }

            if (action === "create_service_ticket") {
                const ticketData = await this.createServiceTicket(params);
                return {
                    reply: replyText || `Service ticket #${ticketData.ticketNumber} created for ${ticketData.customerName}.`,
                    cardType: "ticket",
                    cardData: ticketData,
                    actionTaken: action,
                };
            }

            if (action === "create_invoice_or_quotation") {
                const docData = await this.createInvoiceOrQuotation(params);
                return {
                    reply: replyText || `${docData.docType} ${docData.docNumber} generated and saved for ${docData.customerName}.`,
                    cardType: "invoice",
                    cardData: docData,
                    actionTaken: action,
                };
            }

            if (action === "get_shop_kpis") {
                const kpis = await this.getShopKpis();
                return {
                    reply: replyText || "Here is the current shop operational overview:",
                    cardType: "kpis",
                    cardData: kpis,
                    actionTaken: action,
                };
            }

            // No action: plain conversational answer
            return {
                reply: replyText,
                cardType: "text",
            };
        } catch (execError: any) {
            console.error("[AssistantService] Action execution failed:", execError);
            return {
                reply: `${replyText}\n\n⚠️ (Action could not be completed: ${execError.message})`,
                cardType: "text",
            };
        }
    }

    /**
     * Fallback heuristic parser when AI is unconfigured or unavailable
     */
    private async fallbackRegexParser(text: string): Promise<IAssistantResponse> {
        const lower = text.toLowerCase();

        // 1. Search products (e.g. "laptops under 50000" or "suggest laptops")
        const priceMatch = lower.match(/(?:under|below|less than|within)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
        if (lower.includes("laptop") || lower.includes("suggest") || lower.includes("catalog") || lower.includes("show me") || priceMatch) {
            const maxPrice = priceMatch ? parseInt(priceMatch[1], 10) : undefined;
            const query = lower.includes("laptop") ? "laptop" : undefined;
            const products = await this.searchProducts({ query, maxPrice });

            if (products.length > 0) {
                return {
                    reply: `Found ${products.length} matching product(s) in catalog:`,
                    cardType: "products",
                    cardData: products,
                    actionTaken: "search_products",
                };
            }
        }

        // 2. Fallback notification
        return {
            reply: "AI is not configured yet or the provider is offline. Please configure your AI provider (Gemini, OpenAI, or Ollama) in Settings > AI Configuration.",
            cardType: "text",
        };
    }
}

export default AssistantService.getInstance();
