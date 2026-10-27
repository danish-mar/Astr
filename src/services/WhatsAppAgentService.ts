import { Contact, Product, Category, ShopSettings, ServiceTicket } from "../models";
import WhatsAppInquiry, { IWhatsAppInquiry } from "../models/WhatsAppInquiry";
import CustomerMemory, { ICustomerMemory } from "../models/CustomerMemory";
import aiService from "./aiService";
import QuotationPdfService from "./QuotationPdfService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanPhone10(str: string): string {
  if (!str) return "";
  const digits = str.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function extractChatIdDigits(chatId: string): string {
  return chatId.replace(/@.*$/, "").replace(/\D/g, "");
}

/** Detect the language style of a message: english / hinglish / hindi */
function detectLanguage(text: string): "english" | "hinglish" | "hindi" | "unknown" {
  const hindiRegex = /[\u0900-\u097F]/;
  if (hindiRegex.test(text)) return "hindi";

  const hinglishWords = [
    "bhai", "yaar", "kya", "hai", "nahi", "haan", "ha", "thik", "kal",
    "abhi", "karo", "chahiye", "milega", "kab", "kitna", "acha", "theek",
    "bhej", "lena", "dena", "tha", "hua", "wala", "dost", "sir ji",
    "boss", "bata", "batao", "le lo", "bhejdo", "seedha",
  ];
  const lower = text.toLowerCase();
  if (hinglishWords.some((w) => lower.includes(w))) return "hinglish";

  const hasEnglish = /[a-zA-Z]{3,}/.test(text);
  if (hasEnglish) return "english";

  return "unknown";
}

/** Truncate history to last N turns for prompt efficiency */
function recentHistory(history: Array<{ role: string; message: string }>, n = 10) {
  return history.slice(-n);
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class WhatsAppAgentService {

  // ── Entry Point ────────────────────────────────────────────────────────────

  public static async handleIncomingMessage(msg: any, whatsAppService: any): Promise<void> {
    try {
      if (!msg) return;

      const senderChatId = msg.from || "";
      const body = (msg.body || "").trim();
      const senderName: string = msg._data?.notifyName || msg.notifyName || "there";
      const rawDigits = extractChatIdDigits(senderChatId);
      const phone10 = cleanPhone10(rawDigits);

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[WhatsAppAgentService] 💬 INCOMING: from=${senderChatId} (name="${senderName}", phone10=${phone10 || "N/A"}, fromMe=${Boolean(msg.fromMe)})`);
      console.log(`[WhatsAppAgentService] 💬 TEXT: "${body}"`);

      // fromMe = true means WE sent this (message_create fires on both sides)
      if (msg.fromMe) {
        console.log(`[WhatsAppAgentService] ⏭️ Skipping: message sent by self`);
        return;
      }

      if (!msg.from || typeof msg.from !== "string") return;

      // Ignore group, status, and broadcast messages
      if (
        msg.isStatus ||
        msg.from === "status@broadcast" ||
        msg.from.includes("@g.us") ||
        msg.from.includes("@broadcast")
      ) {
        console.log(`[WhatsAppAgentService] ⏭️ Skipping: broadcast / group / status message`);
        return;
      }

      if (!body) {
        console.log(`[WhatsAppAgentService] ⏭️ Skipping: empty body`);
        return;
      }

      // Load settings
      const settings = await (ShopSettings as any).getSettings();
      if (settings.whatsappAgentEnabled === false) {
        console.log(`[WhatsAppAgentService] ⏸️ Agent disabled in settings`);
        return;
      }

      // ── Role Detection ────────────────────────────────────────────────────
      const bossPhone10 = cleanPhone10(settings.bossPhone || "");
      const shopPhone10 = cleanPhone10(settings.phone || "");

      // Resolve actual customer phone number (especially if senderChatId is @lid or numeric LID)
      let resolvedRealPhone: string | null = null;
      let resolvedPhone10: string | null = null;

      if (senderChatId.endsWith("@lid") || rawDigits.length > 13) {
        // 1. Try WhatsApp Web internal resolution via WhatsAppService
        if (typeof whatsAppService.resolvePhoneNumber === "function") {
          resolvedRealPhone = await whatsAppService.resolvePhoneNumber(senderChatId);
        }

        // 2. Try contactObj if available and not LID
        if (!resolvedRealPhone && typeof msg.getContact === "function") {
          try {
            const contactObj = await msg.getContact();
            if (contactObj?.id?.server === "c.us" && contactObj.number) {
              resolvedRealPhone = contactObj.number;
            } else if (typeof contactObj?.getFormattedNumber === "function") {
              const formatted = await contactObj.getFormattedNumber();
              const numDigits = String(formatted || "").replace(/\D/g, "");
              if (numDigits && numDigits.length >= 10 && numDigits.length <= 13) {
                resolvedRealPhone = numDigits;
              }
            }
          } catch (_) {}
        }

        // 3. Check if stored in memory already
        if (!resolvedRealPhone) {
          const existingMem = await CustomerMemory.findOne({ chatId: senderChatId });
          if (existingMem?.realPhone) {
            resolvedRealPhone = existingMem.realPhone;
          }
        }

        // 4. Check if customer typed a phone number in the incoming message
        const typedMatch = body.match(/(?:\+?(\d{1,3})[-.\s]?)?([6-9]\d{9}|0?3\d{9})\b/);
        if (typedMatch) {
          const cleanMatch = typedMatch[0].replace(/\D/g, "");
          if (cleanMatch.length >= 10 && cleanMatch.length <= 13) {
            resolvedRealPhone = cleanMatch;
          }
        }

        if (resolvedRealPhone) {
          resolvedPhone10 = cleanPhone10(resolvedRealPhone);
        }
      } else {
        // Direct c.us chat: rawDigits is the real phone number
        resolvedRealPhone = rawDigits;
        resolvedPhone10 = phone10;
      }

      const effectivePhone10 = resolvedPhone10 || (rawDigits.length <= 13 ? phone10 : "");

      // 1. Check BOSS (with support for Boss who is also a Vendor)
      const isBoss =
        (bossPhone10 && (phone10 === bossPhone10 || resolvedPhone10 === bossPhone10)) ||
        (!bossPhone10 && shopPhone10 && (phone10 === shopPhone10 || resolvedPhone10 === shopPhone10));

      if (isBoss) {
        // Check if the Boss is also registered as a Vendor / Supplier
        const bossVendorContact = effectivePhone10
          ? await Contact.findOne({
              phone: { $regex: `${effectivePhone10}$` },
              contactType: { $in: ["Vendor", "Supplier"] },
            })
          : null;

        if (bossVendorContact) {
          const lower = body.toLowerCase().trim();
          const isBossQuery =
            body.includes("?") ||
            /\b(cost|costing|price|pricing|rate|breakdown|margin|component|parts|item|detail|summary|deal|deals|stat|stats|report|help|status|who|which)\b/i.test(lower);

          // Only consider vendor role if it is NOT a boss query, looks like a quote response (has numbers/rates/stock terms),
          // and matches an inquiry updated in the last 2 hours.
          const looksLikeVendorQuote = /(?:rs\.?|inr|₹|\b[0-9]{3,6}\b|available|stock|not available|out of stock)/i.test(lower);

          if (!isBossQuery && looksLikeVendorQuote) {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const pendingInq = await WhatsAppInquiry.findOne({
              status: "awaiting_vendor",
              updatedAt: { $gte: twoHoursAgo },
              $or: [
                { vendorPhone: senderChatId },
                { vendorPhone: { $regex: `${effectivePhone10}$` } },
                { vendorName: bossVendorContact.name },
              ],
            }).sort({ updatedAt: -1 });

            if (pendingInq) {
              console.log(`[WhatsAppAgentService] 🏭 BOSS acting as VENDOR (${bossVendorContact.name}) for inquiry: "${pendingInq.requestedProduct}"`);
              await this.handleVendorResponse(msg, bossVendorContact, senderChatId, effectivePhone10, body, whatsAppService, settings);
              return;
            }
          }
        }

        console.log(`[WhatsAppAgentService] 👑 ROLE: BOSS (${senderChatId})`);
        await this.handleBossMessage(msg, senderChatId, body, whatsAppService, settings);
        return;
      }

      // 2. Check KNOWN CUSTOMER
      // If the sender already exists in CustomerMemory or has an inquiry as customer,
      // they are DEFINITIVELY a customer and must never be treated as a vendor.
      const isCustomerInMemory = await CustomerMemory.findOne({
        $or: [
          { chatId: senderChatId },
          ...(effectivePhone10 ? [{ phone10: effectivePhone10 }] : []),
        ],
      });

      const isCustomerInInquiry = await WhatsAppInquiry.findOne({
        $or: [
          { customerPhone: senderChatId },
          ...(effectivePhone10 ? [{ customerPhone: { $regex: `${effectivePhone10}$` } }] : []),
        ],
      });

      const isKnownCustomer = Boolean(isCustomerInMemory || isCustomerInInquiry);

      // 3. Check VENDOR (only if NOT a known customer)
      let vendorContact: any = null;
      if (!isKnownCustomer && effectivePhone10) {
        vendorContact = await Contact.findOne({
          phone: { $regex: `${effectivePhone10}$` },
          contactType: { $in: ["Vendor", "Supplier"] },
        });
      }

      if (vendorContact) {
        console.log(`[WhatsAppAgentService] 🏭 ROLE: VENDOR (${vendorContact.name} - ${vendorContact.phone})`);
        await this.handleVendorResponse(msg, vendorContact, senderChatId, effectivePhone10, body, whatsAppService, settings);
        return;
      }

      // 4. Customer Path
      console.log(`[WhatsAppAgentService] 👤 ROLE: CUSTOMER (${senderName} - ${senderChatId})`);
      await this.handleCustomerMessage(msg, senderChatId, rawDigits, effectivePhone10, senderName, body, whatsAppService, settings, resolvedRealPhone);

    } catch (error) {
      console.error("[WhatsAppAgentService] Unhandled error in handleIncomingMessage:", error);
    }
  }

  // ── Reply Helper ───────────────────────────────────────────────────────────

  public static async sendReply(msg: any, chatId: string, text: string, whatsAppService: any): Promise<boolean> {
    try {
      if (msg && typeof msg.reply === "function") {
        await msg.reply(text);
        return true;
      }
    } catch (err: any) {
      console.warn(`[WhatsAppAgentService] msg.reply failed for ${chatId}:`, err?.message);
    }
    return whatsAppService.sendMessage(chatId, text);
  }

  // ── Memory Management ──────────────────────────────────────────────────────

  private static async getOrCreateMemory(
    chatId: string,
    phone10: string,
    name: string,
    text: string,
    realPhone?: string | null
  ): Promise<ICustomerMemory> {
    let memory = await CustomerMemory.findOne({
      $or: [
        { chatId },
        ...(phone10 ? [{ phone10, chatId: { $not: /@lid$/ } }] : []),
        ...(realPhone ? [{ realPhone }] : []),
      ],
    });

    if (!memory) {
      memory = new CustomerMemory({
        chatId,
        phone10: phone10 || "N/A",
        name,
        realPhone: realPhone || undefined,
      });
    }

    if (realPhone && (!memory.realPhone || memory.realPhone !== realPhone)) {
      memory.realPhone = realPhone;
    }

    // Update name if we now have it
    if (name && name !== "there" && name !== "Customer" && memory.name !== name) {
      memory.name = name;
    }

    // Refresh chatId if resolved from LID to c.us
    if (memory.chatId !== chatId && !chatId.endsWith("@lid")) {
      memory.chatId = chatId;
    }

    // Detect and update language
    const detected = detectLanguage(text);
    if (detected !== "unknown") {
      memory.detectedLanguage = detected;
    }

    memory.messageCount = (memory.messageCount || 0) + 1;

    // Append to history (keep last 30)
    memory.history.push({ role: "customer", message: text, timestamp: new Date() });
    if (memory.history.length > 30) {
      memory.history.splice(0, memory.history.length - 30);
    }

    return memory;
  }

  private static async appendAgentReply(memory: ICustomerMemory, text: string): Promise<void> {
    memory.history.push({ role: "agent", message: text, timestamp: new Date() });
    if (memory.history.length > 30) {
      memory.history.splice(0, memory.history.length - 30);
    }
    await memory.save();
  }

  // ── AI: Generate Warm Reply ────────────────────────────────────────────────

  /**
   * Calls AI to produce a warm, natural reply based on shop context,
   * conversation history, and detected language style.
   */
  private static async generateWarmReply(
    customerText: string,
    memory: ICustomerMemory,
    context: {
      shopName: string;
      situation: string;
      extraContext?: string;
      fallback: string;
    },
    settings: any,
    timeoutMs = 30000
  ): Promise<string> {
    if (!settings.aiEnabled || settings.aiProvider === "none") {
      return context.fallback;
    }


    const lang = memory.detectedLanguage;
    const languageInstruction =
      lang === "hinglish"
        ? "Reply in a warm Hinglish tone — natural mix of Hindi and English, like a friendly shopkeeper would speak. Use words like 'bhai', 'bilkul', 'zaroor', naturally, not forced."
        : lang === "hindi"
        ? "Reply in simple, warm Hindi using Devanagari script. Be friendly and approachable."
        : "Reply in friendly, warm English. Casual but professional — like a helpful local shop owner, not a corporate chatbot.";

    const historyBlock = recentHistory(memory.history, 8)
      .map((t) => `${t.role === "customer" ? "Customer" : "Agent"}: ${t.message}`)
      .join("\n");

    const systemPrompt =
      `You are a helpful, warm, and friendly WhatsApp sales assistant for "${context.shopName}", a computer hardware and repair shop. ` +
      `You never sound robotic or corporate. You respond like a real, knowledgeable person who genuinely cares. ` +
      `${languageInstruction} ` +
      `Keep replies concise — WhatsApp messages, not emails. Avoid bullet-point overload. ` +
      `Use an emoji or two naturally, not excessively. Never use templates like "How may I assist you today?". ` +
      `Customer name: ${memory.name}.\n\n` +
      `⛔ CRITICAL PRICING & INVENTORY POLICY (STRICTLY ENFORCED):\n` +
      `- You DO NOT know shop prices or wholesale rates.\n` +
      `- You MUST NEVER invent, estimate, guess, or state any product prices, numbers, or rates (₹ or Rs) on your own.\n` +
      `- You may ONLY quote a price if an EXACT approved price is explicitly stated in the "Current situation" or "Details" below.\n` +
      `- If a price is NOT provided in the details below, NEVER state any price or range. Tell the customer warmly that you are checking stock and best rates with the suppliers right now and will update them in a few minutes.\n` +
      `- Never give estimates like "starts from ₹25,000" or "around ₹3,000".`;

    const userPrompt =
      `Conversation so far:\n${historyBlock || "(new conversation)"}\n\n` +
      `Current situation: ${context.situation}\n` +
      (context.extraContext ? `Details: ${context.extraContext}\n` : "") +
      `\nCustomer just said: "${customerText}"\n\n` +
      `Write the agent's reply now. Only the reply text, nothing else.`;

    try {
      const raw = await aiService.chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        timeoutMs
      );
      if (raw && raw.trim()) {
        const replyText = raw.trim();

        // Guard: Prevent unapproved price leakage in general/unverified replies
        const hasApprovedPrice =
          (context.situation && (context.situation.includes("₹") || context.situation.includes("Rate:") || context.situation.includes("Price:"))) ||
          (context.extraContext && (context.extraContext.includes("₹") || context.extraContext.includes("Rate:") || context.extraContext.includes("Price:")));

        if (!hasApprovedPrice && /(?:rs\.?|inr|₹)\s*[0-9]+|\b[0-9]{3,6}\s*(?:rs|inr|rupees|\/-)/i.test(replyText)) {
          console.warn(`[WhatsAppAgentService] ⚠️ Scrubbed unverified hallucinated price from AI reply: "${replyText}"`);
          return context.fallback;
        }

        return replyText;
      }
    } catch (e) {
      console.warn("[WhatsAppAgentService] AI warm reply fallback:", e);
    }

    return context.fallback;
  }

  // ── Customer Handler ───────────────────────────────────────────────────────

  private static async handleCustomerMessage(
    msg: any,
    senderChatId: string,
    rawDigits: string,
    phone10: string,
    senderName: string,
    text: string,
    whatsAppService: any,
    settings: any,
    realPhone?: string | null
  ): Promise<void> {
    console.log(`[WhatsAppAgentService] Customer (${senderChatId}) said: "${text}"`);

    // Load or create memory
    const memory = await this.getOrCreateMemory(senderChatId, phone10, senderName, text, realPhone);

    // Load active inquiry (check memory reference first, then DB fallback)
    let activeInquiry: IWhatsAppInquiry | null = null;
    if (memory.activeInquiryId) {
      activeInquiry = await WhatsAppInquiry.findById(memory.activeInquiryId);
      // If it's closed/done, clear the reference
      if (activeInquiry && ["deal_agreed", "closed"].includes(activeInquiry.status)) {
        activeInquiry = null;
        memory.activeInquiryId = undefined;
      }
    }
    if (!activeInquiry) {
      activeInquiry = await WhatsAppInquiry.findOne({
        $or: [
          { customerPhone: senderChatId },
          { customerPhone: rawDigits },
          ...(phone10 ? [{ customerPhone: { $regex: `${phone10}$` } }] : []),
        ],
        status: { $in: ["inquiry", "awaiting_vendor", "quoted"] },
      }).sort({ updatedAt: -1 });
    }

    // Classify intent
    const analysis = await this.classifyCustomerIntent(text, activeInquiry, memory, settings);
    console.log(`[WhatsAppAgentService] Intent:`, analysis.intent, analysis.productName || "");

    // Record message in active inquiry history if present
    if (activeInquiry) {
      activeInquiry.history.push({ sender: "customer", message: text, timestamp: new Date() });
    }

    const shopName: string = settings.shopName || "our shop";

    // ── Intent Routing ──────────────────────────────────────────────────────

    // Follow-up on pending inquiry (customer asking for an update)
    if (analysis.intent === "inquiry_followup" && activeInquiry && activeInquiry.status === "awaiting_vendor") {
      const situation =
        `Customer is asking for an update on their requested product: "${activeInquiry.requestedProduct}". ` +
        `We are still awaiting a quote/confirmation from our supplier (${activeInquiry.vendorName || "authorized supplier"}). ` +
        `Reassure them warmly that we are actively checking and will update them as soon as the supplier confirms.`;
      const fallback =
        `Hey ${memory.name}! Still checking on *${activeInquiry.requestedProduct}* with our supplier. ⏳\n` +
        `I'll update you here the moment they confirm stock and the best price!`;

      const reply = await this.generateWarmReply(text, memory, { shopName, situation, fallback }, settings);
      await this.sendReply(msg, senderChatId, reply, whatsAppService);
      await this.appendAgentReply(memory, reply);
      return;
    }

    // Deal confirmation
    if (analysis.intent === "agree_deal" && activeInquiry && activeInquiry.status === "quoted") {
      const cleanCustomerPhone = realPhone || memory.realPhone || (rawDigits.length <= 13 ? rawDigits : "");
      await this.handleDealAgreed(msg, activeInquiry, memory, senderChatId, cleanCustomerPhone, text, whatsAppService, settings);
      return;
    }

    // Quotation PDF Request
    if (analysis.intent === "request_quotation_pdf") {
      // If products were extracted in analysis, customer specified items to quote — route to product inquiry
      if (analysis.products && analysis.products.length > 0) {
        await this.handleProductInquiry(
          msg, senderChatId, rawDigits, memory, analysis.products,
          analysis.categoryName, text, whatsAppService, settings, realPhone, true
        );
        return;
      }
      await this.handleQuotationPdfRequest(
        msg, senderChatId, rawDigits, memory, activeInquiry, text, whatsAppService, settings
      );
      return;
    }

    // Product inquiry (single or multiple items)
    if (analysis.intent === "product_inquiry") {
      const productsList = analysis.products && analysis.products.length > 0
        ? analysis.products
        : (analysis.productName ? [analysis.productName] : [text]);

      await this.handleProductInquiry(
        msg, senderChatId, rawDigits, memory, productsList,
        analysis.categoryName, text, whatsAppService, settings, realPhone, (analysis as any).wantsPdf
      );
      return;
    }

    // Service ticket query
    if (analysis.intent === "service_query") {
      await this.handleServiceTicketQuery(msg, senderChatId, phone10, text, memory, whatsAppService, settings);
      return;
    }

    // General / greeting
    const isFirstMessage = (memory.messageCount || 1) <= 1;
    const situation = isFirstMessage
      ? "This is the first time this customer is messaging. Greet them warmly and let them know what you can help with (product prices, availability, repair status, custom PC quotes). Keep it short. Do NOT invent prices."
      : "Customer sent a general message or greeting. Respond naturally and ask how you can help today. Do NOT invent prices.";

    const fallback = isFirstMessage
      ? `Hey ${memory.name}! 👋 Welcome to ${shopName}. Looking for laptop prices, PC parts, or want to check a repair status? Just let me know — happy to help!`
      : `Hey! What can I help you with today?`;

    const reply = await this.generateWarmReply(text, memory, { shopName, situation, fallback }, settings);
    await this.sendReply(msg, senderChatId, reply, whatsAppService);
    await this.appendAgentReply(memory, reply);
  }

  // ── Quotation PDF Generation & Sending ─────────────────────────────────────

  private static async handleQuotationPdfRequest(
    msg: any,
    customerChatId: string,
    customerPhoneDigits: string,
    memory: ICustomerMemory,
    activeInquiry: IWhatsAppInquiry | null,
    text: string,
    whatsAppService: any,
    settings: any
  ): Promise<void> {
    const shopName: string = settings.shopName || "Mamdani Computers";

    // 1. Locate relevant inquiry
    let inquiry = activeInquiry;
    if (!inquiry) {
      inquiry = await WhatsAppInquiry.findOne({
        $or: [
          { customerPhone: customerChatId },
          { customerPhone: customerPhoneDigits },
          ...(memory.realPhone ? [{ customerRealPhone: memory.realPhone }] : []),
        ],
        status: { $in: ["deal_agreed", "quoted", "awaiting_vendor", "closed"] },
      }).sort({ updatedAt: -1 });
    }

    // Case A: Customer has items and approved/quoted prices
    if (
      inquiry &&
      ["quoted", "deal_agreed", "closed"].includes(inquiry.status) &&
      ((inquiry.items && inquiry.items.length > 0) || inquiry.quotedPrice)
    ) {
      try {
        let itemsList: Array<{ name: string; qty?: number; unitPrice: number; total: number }> = [];

        if (inquiry.items && inquiry.items.length > 0) {
          itemsList = inquiry.items.map((it: any) => {
            const price = it.quotedPrice || it.sellingPrice || it.vendorPrice || 0;
            return {
              name: it.name || it.component || "Component",
              qty: 1,
              unitPrice: price,
              total: price,
            };
          });
        } else {
          const price = inquiry.quotedPrice || 0;
          itemsList = [
            {
              name: inquiry.requestedProduct,
              qty: 1,
              unitPrice: price,
              total: price,
            },
          ];
        }

        const totalAmount = itemsList.reduce((sum, it) => sum + (it.total || 0), 0);
        const quoteYear = new Date().getFullYear();
        const randRef = Math.floor(1000 + Math.random() * 9000);
        const quoteNumber = `QT-${quoteYear}-${randRef}`;

        // Customer contact display
        let customerDisplayPhone = "";
        if (memory.realPhone) {
          const d = memory.realPhone.replace(/\D/g, "");
          customerDisplayPhone = d.startsWith("91") ? `+91 ${d.slice(2)}` : `+${d}`;
        } else if (inquiry.customerRealPhone) {
          const d = inquiry.customerRealPhone.replace(/\D/g, "");
          customerDisplayPhone = d.startsWith("91") ? `+91 ${d.slice(2)}` : `+${d}`;
        }

        const pdfBuffer = await QuotationPdfService.generateQuotationPdf({
          quoteNumber,
          date: new Date(),
          validUntil: new Date(Date.now() + 7 * 86400000), // 7 days validity
          shop: {
            name: shopName,
            address: settings.address,
            phone: settings.phone || settings.bossPhone,
            email: settings.email,
            gstin: settings.gstin,
            upiId: settings.upiId,
          },
          customer: {
            name: memory.name || inquiry.customerName || "Customer",
            phone: customerDisplayPhone,
          },
          items: itemsList,
          totalAmount,
        });

        const filename = `Quotation_${quoteNumber}_${shopName.replace(/\s+/g, "_")}.pdf`;
        const caption = `📄 *Official Quotation - ${shopName}*\nQuote Ref: *#${quoteNumber}*\nTotal: *₹${totalAmount.toLocaleString("en-IN")}*`;

        // Send PDF document directly to the active customer chat
        const targetRecipient = customerChatId;
        const sent = await whatsAppService.sendDocument(targetRecipient, pdfBuffer, filename, caption);

        if (sent) {
          const replyText = `Here is your official quotation PDF! 📄✨\n\nIt contains the itemized breakdown with prices. Let me know if you'd like to proceed or need any changes! 😊`;
          await this.sendReply(msg, customerChatId, replyText, whatsAppService);
          await this.appendAgentReply(memory, replyText);
          return;
        }

        // PDF dispatch failed — fall back to inline text quotation
        console.warn("[WhatsAppAgentService] PDF send failed, sending text quotation fallback");
        const shopContact = settings.phone || settings.bossPhone || "";
        const contactLine = shopContact
          ? `\n\n📞 To finalise or pay, reach our team directly: *${shopContact}*`
          : "";

        let textQuote =
          `📄 *Quotation — ${shopName}*\n` +
          `Quote Ref: *#${quoteNumber}* | Valid: *7 days*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const it of itemsList) {
          textQuote += `▸ *${it.name}*  —  ₹${Number(it.total).toLocaleString("en-IN")}\n`;
        }
        textQuote +=
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 *Grand Total: ₹${totalAmount.toLocaleString("en-IN")}*` +
          contactLine +
          `\n\n_Let me know if you'd like to lock this in or make any changes! 🛠️_`;

        await this.sendReply(msg, customerChatId, textQuote, whatsAppService);
        await this.appendAgentReply(memory, textQuote);
        return;
      } catch (err) {
        console.error("[WhatsAppAgentService] Error generating quotation PDF:", err);
        // Still respond to customer — don't silently drop
        const shopContact = settings.phone || settings.bossPhone || "";
        const errFallback =
          `Sorry, I ran into an issue generating your quotation PDF right now. 🙏` +
          (shopContact ? `\n\nYou can reach our team directly at *${shopContact}* to get the quote sorted quickly!` : `\n\nPlease try again in a moment or contact our team directly.`);
        await this.sendReply(msg, customerChatId, errFallback, whatsAppService);
        await this.appendAgentReply(memory, errFallback);
      }
    }

    // Case B: Inquiry is still awaiting vendor rates
    if (inquiry && inquiry.status === "awaiting_vendor") {
      const waitMsg = `I'm preparing your quotation right now! ⏳ Just waiting on our suppliers to confirm the best rates for your requested items. The moment the numbers are in, I'll generate the PDF and send it straight here! 😊`;
      await this.sendReply(msg, customerChatId, waitMsg, whatsAppService);
      await this.appendAgentReply(memory, waitMsg);
      return;
    }

    // Case C: No inquiry or items found yet
    const askMsg = `I'd love to prepare an official quotation PDF for you! 📄 Could you please share the parts or specs you need (like processor, RAM, graphics card, or laptop model)? Once you send the list, I'll get the best rates and create the PDF quotation for you right away! 🖥️✨`;
    await this.sendReply(msg, customerChatId, askMsg, whatsAppService);
    await this.appendAgentReply(memory, askMsg);
  }

  // ── Product Inquiry (Supports Single & Multiple Products) ──────────────────

  private static async handleProductInquiry(
    msg: any,
    customerChatId: string,
    customerPhone: string,
    memory: ICustomerMemory,
    productsList: string[],
    suggestedCategory: string | undefined,
    originalText: string,
    whatsAppService: any,
    settings: any,
    realPhone?: string | null,
    wantsPdf?: boolean
  ): Promise<void> {
    const shopName: string = settings.shopName || "our shop";

    // Clean all product names
    let cleanedProducts = productsList.map((p) =>
      p
        .replace(/^(do you have|price of|rate of|cost of|is|available|what is the price of|what is|tell me|bata|kitna hai|i need|looking for|want|can i get|give me|how much for)\s+/gi, "")
        .replace(/[?.,!]+$/g, "")
        .trim()
    ).filter(Boolean);

    if (cleanedProducts.length === 0) {
      cleanedProducts = [originalText.trim()];
    }

    // Track products in customer memory
    for (const p of cleanedProducts) {
      if (p && !memory.pastInquiries.includes(p)) {
        memory.pastInquiries.push(p);
        if (memory.pastInquiries.length > 20) memory.pastInquiries.shift();
      }
    }

    const allCategories = await Category.find({});

    // Inspect each product against store inventory and categories
    const itemsData: Array<{
      name: string;
      categoryName: string;
      inStock: boolean;
      quotedPrice?: number;
      vendorPrice?: number;
      marginPercent: number;
    }> = [];

    for (const prodName of cleanedProducts) {
      let matchedCategoryName = suggestedCategory || "General";
      let categoryMargin = settings.defaultMarginPercent ?? 20;

      for (const cat of allCategories) {
        if (
          (matchedCategoryName && cat.name.toLowerCase() === matchedCategoryName.toLowerCase()) ||
          prodName.toLowerCase().includes(cat.name.toLowerCase())
        ) {
          matchedCategoryName = cat.name;
          if (typeof cat.marginPercent === "number" && cat.marginPercent > 0) {
            categoryMargin = cat.marginPercent;
          }
          break;
        }
      }

      // Check local inventory
      const safeRegex = prodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inStockProduct = await Product.findOne({
        name: { $regex: safeRegex, $options: "i" },
        isSold: false,
      });

      if (inStockProduct) {
        itemsData.push({
          name: inStockProduct.name,
          categoryName: matchedCategoryName,
          inStock: true,
          quotedPrice: inStockProduct.price,
          vendorPrice: inStockProduct.price,
          marginPercent: categoryMargin,
        });
      } else {
        itemsData.push({
          name: prodName,
          categoryName: matchedCategoryName,
          inStock: false,
          marginPercent: categoryMargin,
        });
      }
    }

    const allInStock = itemsData.every((i) => i.inStock);
    const combinedProductName = cleanedProducts.join(" + ");

    // ── Case 1: All items are in store inventory ─────────────────────────────
    if (allInStock) {
      const totalQuoted = itemsData.reduce((sum, i) => sum + (i.quotedPrice || 0), 0);
      let reply: string;

      if (itemsData.length === 1) {
        const item = itemsData[0];
        const situation =
          `Customer asked about "${item.name}". It IS in stock at ₹${(item.quotedPrice || 0).toLocaleString("en-IN")}. ` +
          `Share the confirmed price and ask if they'd like to confirm or reserve it.`;
        const fallback =
          `Good news — *${item.name}* is available in stock right now! 🎉\n` +
          `*Rate: ₹${(item.quotedPrice || 0).toLocaleString("en-IN")}* (all inclusive)\n\n` +
          `Want to reserve it? Just let me know!`;

        reply = await this.generateWarmReply(originalText, memory, { shopName, situation, fallback }, settings);
      } else {
        const itemizedList = itemsData
          .map((i) => `• *${i.name}*: ₹${(i.quotedPrice || 0).toLocaleString("en-IN")}`)
          .join("\n");
        const situation =
          `Customer asked for multiple products: ${combinedProductName}. All items ARE in stock! Rates:\n${itemizedList}\n` +
          `Total: ₹${totalQuoted.toLocaleString("en-IN")}. Share this exact itemized quote and total.`;
        const fallback =
          `Good news! 🎉 All requested items are available in stock:\n${itemizedList}\n\n` +
          `*Total: ₹${totalQuoted.toLocaleString("en-IN")}* (all inclusive)\n\n` +
          `Would you like to confirm the order? Just say yes!`;

        reply = await this.generateWarmReply(originalText, memory, { shopName, situation, fallback }, settings);
      }

      await this.sendReply(msg, customerChatId, reply, whatsAppService);

      const inq = await WhatsAppInquiry.create({
        customerPhone: customerChatId,
        customerRealPhone: realPhone || memory.realPhone || undefined,
        customerName: memory.name,
        status: "quoted",
        requestedProduct: combinedProductName,
        categoryName: itemsData[0]?.categoryName || "In-Stock",
        items: itemsData,
        vendorName: "Store Inventory",
        vendorPrice: totalQuoted,
        quotedPrice: totalQuoted,
        marginPercent: settings.defaultMarginPercent ?? 20,
        history: [
          { sender: "customer", message: originalText, timestamp: new Date() },
          { sender: "agent", message: reply, timestamp: new Date() },
        ],
      });
      memory.activeInquiryId = inq._id;
      await this.appendAgentReply(memory, reply);

      if (wantsPdf) {
        // Customer dynamically requested quotation document/PDF — generate and dispatch immediately
        await this.handleQuotationPdfRequest(
          msg, customerChatId, customerPhone, memory, inq, originalText, whatsAppService, settings
        );
      }
      return;
    }

    // ── Case 2: At least one item requires checking with suppliers ──────────
    const vendors = await Contact.find({
      contactType: { $in: ["Vendor", "Supplier"] },
      phone: { $exists: true, $ne: "" },
    }).limit(3);

    if (vendors.length > 0) {
      const itemsListStr = cleanedProducts.map((p) => `• *${p}*`).join("\n");
      const situation = wantsPdf
        ? `Customer requested an official quotation for ${combinedProductName}. We are checking availability and rates with suppliers to prepare the quotation. Reassure them that we are gathering the best rates and will send the official quotation as soon as numbers are in.`
        : `Customer requested ${combinedProductName}. We are checking availability and rates with suppliers. Tell them we are checking on it right away. DO NOT quote any prices or numbers.`;
      const fallback = wantsPdf
        ? `Noted! 📄 Let me gather the best rates from our suppliers for:\n${itemsListStr}\n\nI'll prepare your quotation as soon as the prices are confirmed — usually takes just a few minutes! ⏳`
        : `Noted! 🔍 Let me check availability and the best rates with our suppliers for:\n${itemsListStr}\n\nI'll get back to you with the exact quote shortly — usually takes just a few minutes!`;

      const waitReply = await this.generateWarmReply(originalText, memory, { shopName, situation, fallback }, settings);
      await this.sendReply(msg, customerChatId, waitReply, whatsAppService);

      const primaryVendor = vendors[0];
      const inq = await WhatsAppInquiry.create({
        customerPhone: customerChatId,
        customerRealPhone: realPhone || memory.realPhone || undefined,
        customerName: memory.name,
        status: "awaiting_vendor",
        requestedProduct: combinedProductName,
        categoryName: itemsData[0]?.categoryName,
        items: itemsData,
        marginPercent: settings.defaultMarginPercent ?? 20,
        vendorName: primaryVendor.name,
        vendorPhone: primaryVendor.phone,
        history: [
          { sender: "customer", message: originalText, timestamp: new Date() },
          { sender: "agent", message: waitReply, timestamp: new Date() },
        ],
      });
      memory.activeInquiryId = inq._id;

      // Ask vendors
      for (const vendor of vendors) {
        let vendorMsg: string;
        if (cleanedProducts.length === 1) {
          vendorMsg =
            `Hi ${vendor.name} 👋, do you have *${cleanedProducts[0]}* available?\n` +
            `Please share the stock status and best wholesale rate (₹). Thanks!`;
        } else {
          vendorMsg =
            `Hi ${vendor.name} 👋, do you have the following in stock?\n` +
            cleanedProducts.map((p, idx) => `${idx + 1}. *${p}*`).join("\n") +
            `\nPlease share availability and wholesale rate (₹) for each. Thanks!`;
        }

        await whatsAppService.sendMessage(vendor.phone, vendorMsg);
        inq.history.push({
          sender: "agent",
          message: `[Vendor inquiry → ${vendor.name}] ${vendorMsg}`,
          timestamp: new Date(),
        });
      }

      await inq.save();
      await this.appendAgentReply(memory, waitReply);
    } else {
      // No vendors configured
      const situation =
        `Customer asked about "${combinedProductName}" but no suppliers are configured. ` +
        `Let them know we are checking into it manually. DO NOT state any price.`;
      const fallback =
        `Got it! We'll check availability for *${combinedProductName}* with our stock team and get back to you shortly! 🙏`;

      const reply = await this.generateWarmReply(originalText, memory, { shopName, situation, fallback }, settings);
      await this.sendReply(msg, customerChatId, reply, whatsAppService);
      await this.appendAgentReply(memory, reply);

      // Alert boss
      const bossTarget = settings.bossPhone || settings.phone;
      if (bossTarget) {
        await whatsAppService.sendMessage(
          bossTarget,
          `⚠️ *Manual Follow-up Needed*\n${memory.name} (+${customerPhone}) asked about: "${combinedProductName}"\nNo vendor contacts configured.`
        );
      }
    }
  }

  // ── Deal Agreed ────────────────────────────────────────────────────────────

  private static async handleDealAgreed(
    msg: any,
    inquiry: IWhatsAppInquiry,
    memory: ICustomerMemory,
    customerChatId: string,
    customerPhone: string,
    text: string,
    whatsAppService: any,
    settings: any
  ): Promise<void> {
    inquiry.status = "deal_agreed";
    memory.activeInquiryId = undefined;

    // Resolve clean phone number for boss display (never LID)
    let displayPhone = "";
    if (customerPhone && customerPhone.length >= 10 && customerPhone.length <= 15 && !customerPhone.includes("@lid")) {
      displayPhone = customerPhone;
    } else if (memory.realPhone && memory.realPhone.length <= 15) {
      displayPhone = memory.realPhone;
    } else if (inquiry.customerRealPhone && inquiry.customerRealPhone.length <= 15) {
      displayPhone = inquiry.customerRealPhone;
    } else {
      if (typeof whatsAppService.resolvePhoneNumber === "function") {
        const resolved = await whatsAppService.resolvePhoneNumber(customerChatId);
        if (resolved && resolved.length <= 15) {
          displayPhone = resolved;
          memory.realPhone = resolved;
          inquiry.customerRealPhone = resolved;
          await memory.save();
        }
      }
    }

    // Check if customer typed a phone number in any message history
    if (!displayPhone) {
      for (const t of memory.history.slice().reverse()) {
        if (t.role === "customer") {
          const match = t.message.match(/(?:\+?(\d{1,3})[-.\s]?)?([6-9]\d{9}|0?3\d{9})\b/);
          if (match) {
            const clean = match[0].replace(/\D/g, "");
            if (clean.length >= 10 && clean.length <= 15) {
              displayPhone = clean;
              memory.realPhone = clean;
              inquiry.customerRealPhone = clean;
              await memory.save();
              break;
            }
          }
        }
      }
    }

    let customerPhoneLabel = "";
    if (displayPhone) {
      const d = displayPhone.replace(/\D/g, "");
      if (d.startsWith("91")) {
        const local = d.slice(2);
        customerPhoneLabel = local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : `+91 ${local}`;
      } else if (d === "923167255624") {
        customerPhoneLabel = `+91 923167255624`;
      } else if (d.startsWith("92") && d.length === 12) {
        customerPhoneLabel = `+92 ${d.slice(2, 5)} ${d.slice(5)}`;
      } else if (d.length === 10) {
        customerPhoneLabel = `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
      } else {
        customerPhoneLabel = `+${d}`;
      }
    } else {
      customerPhoneLabel = "WhatsApp Direct (Contact Hidden)";
    }

    const shopName: string = settings.shopName || "our shop";
    const promptForPhone = !displayPhone
      ? "\n\n📌 Please reply with your contact number so we can prepare your order receipt!"
      : "";
    const situation =
      `Customer just confirmed they want to purchase *${inquiry.requestedProduct}* at ₹${inquiry.quotedPrice?.toLocaleString("en-IN")}. ` +
      `This is a deal! Congratulate them warmly, confirm the order, and let them know the store manager will reach out for pickup/payment details. ` +
      (!displayPhone ? `Politely ask them for their phone number so the manager can call them. ` : "") +
      `Don't be overly formal. Keep it natural and exciting.`;
    const fallback =
      `🎉 Done! Order for *${inquiry.requestedProduct}* at *₹${inquiry.quotedPrice?.toLocaleString("en-IN")}* is confirmed!\n` +
      `Our manager will reach out soon with pickup and payment details. Thank you, ${memory.name}! 🙏${promptForPhone}`;

    const confirmReply = await this.generateWarmReply(text, memory, { shopName, situation, fallback }, settings);
    await this.sendReply(msg, customerChatId, confirmReply, whatsAppService);
    inquiry.history.push({ sender: "agent", message: confirmReply, timestamp: new Date() });
    await this.appendAgentReply(memory, confirmReply);

    // Economics
    const vendorCost = inquiry.vendorPrice || 0;
    const sellingPrice = inquiry.quotedPrice || 0;
    const grossProfit = Math.max(0, sellingPrice - vendorCost);
    const margin = inquiry.marginPercent || settings.defaultMarginPercent || 20;

    // Boss notification
    const bossTarget = settings.bossPhone || settings.phone;
    if (bossTarget) {
      const aiSuggestions = await this.generateBossSuggestions(inquiry, memory, settings);

      let componentBreakdownStr = "";
      if (inquiry.items && inquiry.items.length > 0) {
        componentBreakdownStr =
          `\n🧩 *Component Costing Breakdown:*\n` +
          inquiry.items
            .map((it, idx) => {
              const cost = it.vendorPrice ? `₹${it.vendorPrice.toLocaleString("en-IN")}` : "N/A";
              const quote = it.quotedPrice ? `₹${it.quotedPrice.toLocaleString("en-IN")}` : "N/A";
              const itMargin = it.marginPercent || margin;
              const itProfit =
                it.quotedPrice && it.vendorPrice
                  ? ` (+₹${(it.quotedPrice - it.vendorPrice).toLocaleString("en-IN")})`
                  : "";
              return `${idx + 1}. *${it.name}*\n   ↳ Cost: ${cost} | Sale: ${quote} (${itMargin}% margin)${itProfit}`;
            })
            .join("\n") +
          `\n`;
      }

      const bossMsg =
        `🔔 *New Deal via WhatsApp Agent*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Customer:* ${memory.name} (${customerPhoneLabel})\n` +
        `📦 *Product:* ${inquiry.requestedProduct}\n` +
        `🏷️ *Category:* ${inquiry.categoryName || "General"}\n` +
        componentBreakdownStr +
        `🏭 *Supplier Total:* ${inquiry.vendorName || "N/A"} | ₹${vendorCost.toLocaleString("en-IN")}\n` +
        `💰 *Selling Price:* ₹${sellingPrice.toLocaleString("en-IN")} (margin: ${margin}%)\n` +
        `📈 *Gross Profit:* ₹${grossProfit.toLocaleString("en-IN")}\n\n` +
        `💡 *AI Next Steps:*\n${aiSuggestions}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;

      await whatsAppService.sendMessage(bossTarget, bossMsg);
      inquiry.history.push({ sender: "boss", message: bossMsg, timestamp: new Date() });
    } else {
      console.warn("[WhatsAppAgentService] Boss phone not set — skipping boss notification.");
    }

    await inquiry.save();
  }

  // ── Vendor Response ────────────────────────────────────────────────────────

  private static async handleVendorResponse(
    msg: any,
    vendorContact: any,
    vendorChatId: string,
    vendorPhone10: string,
    text: string,
    whatsAppService: any,
    settings: any
  ): Promise<void> {
    console.log(`[WhatsAppAgentService] Vendor (${vendorContact.name}) replied: "${text}"`);

    let inquiry = await WhatsAppInquiry.findOne({
      status: "awaiting_vendor",
      $or: [
        { vendorPhone: vendorChatId },
        ...(vendorPhone10 ? [{ vendorPhone: { $regex: `${vendorPhone10}$` } }] : []),
      ],
    }).sort({ updatedAt: -1 });

    if (!inquiry && vendorContact.phone) {
      const vPhone10 = cleanPhone10(vendorContact.phone);
      if (vPhone10) {
        inquiry = await WhatsAppInquiry.findOne({
          status: "awaiting_vendor",
          vendorPhone: { $regex: `${vPhone10}$` },
        }).sort({ updatedAt: -1 });
      }
    }

    if (!inquiry) {
      inquiry = await WhatsAppInquiry.findOne({
        status: "awaiting_vendor",
        vendorName: vendorContact.name,
      }).sort({ updatedAt: -1 });
    }

    if (!inquiry) {
      console.log(`[WhatsAppAgentService] No pending awaiting_vendor inquiry found for vendor ${vendorContact.name}.`);
      return;
    }

    inquiry.history.push({ sender: "vendor", message: text, timestamp: new Date() });

    const quote = await this.parseVendorQuote(text, inquiry.requestedProduct, settings, inquiry.items);
    console.log(`[WhatsAppAgentService] Vendor quote parsed:`, quote);

    if (quote.available && quote.price && quote.price > 0) {
      let totalVendorCost = Math.round(quote.price);
      let totalCustomerPrice = 0;
      let itemizedBreakdown: string[] = [];

      if (inquiry.items && inquiry.items.length > 1) {
        // Multi-product inquiry: calculate margin per item
        const numItems = inquiry.items.length;
        for (const it of inquiry.items) {
          const itemQuote = quote.itemQuotes?.find((iq) =>
            iq.name.toLowerCase().includes(it.name.toLowerCase()) ||
            it.name.toLowerCase().includes(iq.name.toLowerCase())
          );
          const itemCost = itemQuote?.price || Math.round(totalVendorCost / numItems);
          const itemMargin = it.marginPercent || settings.defaultMarginPercent || 20;
          const itemPrice = Math.round(itemCost * (1 + itemMargin / 100));

          it.vendorPrice = itemCost;
          it.quotedPrice = itemPrice;
          totalCustomerPrice += itemPrice;
          itemizedBreakdown.push(`• *${it.name}*: ₹${itemPrice.toLocaleString("en-IN")}`);
        }
      } else {
        // Single product inquiry
        let marginPercent = inquiry.marginPercent || settings.defaultMarginPercent || 20;
        if (inquiry.categoryName) {
          const cat = await Category.findOne({ name: { $regex: `^${inquiry.categoryName}$`, $options: "i" } });
          if (cat && typeof cat.marginPercent === "number" && cat.marginPercent > 0) {
            marginPercent = cat.marginPercent;
          }
        }
        totalCustomerPrice = Math.round(totalVendorCost * (1 + marginPercent / 100));
        inquiry.marginPercent = marginPercent;
        if (inquiry.items && inquiry.items.length === 1) {
          inquiry.items[0].vendorPrice = totalVendorCost;
          inquiry.items[0].quotedPrice = totalCustomerPrice;
        }
      }

      inquiry.vendorPrice = totalVendorCost;
      inquiry.quotedPrice = totalCustomerPrice;
      inquiry.vendorName = vendorContact.name;
      inquiry.vendorPhone = vendorContact.phone || vendorPhone10;
      inquiry.status = "quoted";

      // Load customer memory for warm reply
      const custMemory = await CustomerMemory.findOne({
        $or: [
          { chatId: inquiry.customerPhone },
          { phone10: cleanPhone10(extractChatIdDigits(inquiry.customerPhone)) },
        ],
      });

      const shopName: string = settings.shopName || "our shop";
      let customerMsg: string;
      let situation: string;
      let fallback: string;

      if (itemizedBreakdown.length > 1) {
        fallback =
          `Good news! 🎉 Checked with our supplier — here is the complete rate:\n` +
          itemizedBreakdown.join("\n") + `\n\n` +
          `*Total: ₹${totalCustomerPrice.toLocaleString("en-IN")}* (all inclusive)\n\n` +
          `Want to go ahead? Just say yes and we'll sort the rest!`;
        situation =
          `We got confirmed supplier rates for multiple items:\n` +
          itemizedBreakdown.join("\n") + `\n` +
          `Total: ₹${totalCustomerPrice.toLocaleString("en-IN")}. Share this exact quote with the customer and ask if they'd like to confirm.`;
      } else {
        fallback =
          `Good news! 🎉 We checked with our supplier — *${inquiry.requestedProduct}* is available.\n` +
          `*Rate: ₹${totalCustomerPrice.toLocaleString("en-IN")}* (all inclusive)\n\n` +
          `Want to go ahead? Just say yes and we'll sort the rest!`;
        situation =
          `We just got confirmation from our supplier: *${inquiry.requestedProduct}* is available at ₹${totalCustomerPrice.toLocaleString("en-IN")} for the customer. ` +
          `Share this exact price with the customer and ask if they'd like to go ahead.`;
      }

      if (custMemory && settings.aiEnabled && settings.aiProvider !== "none") {
        customerMsg = await this.generateWarmReply("", custMemory, { shopName, situation, fallback }, settings);
        await this.appendAgentReply(custMemory, customerMsg);
      } else {
        customerMsg = fallback;
      }

      // Send to customer using sendMessage (no msg object for the customer in this context)
      await whatsAppService.sendMessage(inquiry.customerPhone, customerMsg);
      inquiry.history.push({ sender: "agent", message: customerMsg, timestamp: new Date() });

      await inquiry.save();

      // Acknowledge vendor
      await this.sendReply(
        msg,
        vendorChatId,
        `Thanks ${vendorContact.name}! Got the quote for ${inquiry.requestedProduct}. Will update you once confirmed. 🙏`,
        whatsAppService
      );

    } else if (quote.available === false) {
      inquiry.status = "closed";

      const shopName: string = settings.shopName || "our shop";
      const outMsg =
        `Hey ${inquiry.customerName || "there"}, checked with our supplier — unfortunately *${inquiry.requestedProduct}* is out of stock at the moment. 😕\n` +
        `I'll let you know as soon as it's back. Is there anything else I can help you with?`;

      await whatsAppService.sendMessage(inquiry.customerPhone, outMsg);
      inquiry.history.push({ sender: "agent", message: outMsg, timestamp: new Date() });
      await inquiry.save();
    } else {
      // Ambiguous / greeting / clarification — inquiry remains open
      console.log(`[WhatsAppAgentService] Vendor quote ambiguous or in-progress ("${text}"). Inquiry remains awaiting_vendor.`);
      await inquiry.save();
      const lower = text.toLowerCase().trim();
      if (/^(hi|hello|hey|ok|okay|haan|ha)\b/i.test(lower) || text.includes("?")) {
        await this.sendReply(
          msg,
          vendorChatId,
          `Thanks ${vendorContact.name}! Please let us know the price and stock when you check. 🙏`,
          whatsAppService
        );
      }
    }
  }

  // ── Service Ticket ─────────────────────────────────────────────────────────

  private static async handleServiceTicketQuery(
    msg: any,
    customerChatId: string,
    phone10: string,
    text: string,
    memory: ICustomerMemory,
    whatsAppService: any,
    settings: any
  ): Promise<void> {
    const shopName: string = settings.shopName || "our shop";
    const ticketMatch = text.match(/\b\d{6}\b/);
    let ticket: any = null;

    if (ticketMatch) {
      ticket = await ServiceTicket.findOne({ ticketNumber: ticketMatch[0] }).populate("customer");
    } else {
      const contacts = await Contact.find({ phone: { $regex: `${phone10}$` } });
      const contactIds = contacts.map((c) => c._id);
      ticket = await ServiceTicket.findOne({ customer: { $in: contactIds } })
        .sort({ createdAt: -1 })
        .populate("customer");
    }

    let replyText: string;

    if (ticket) {
      const situation =
        `Customer is asking about their repair status. Here are the details:\n` +
        `Ticket #${ticket.ticketNumber}, Device: ${ticket.deviceDetails}, Status: ${ticket.status}` +
        (ticket.serviceCharge ? `, Estimate: ₹${ticket.serviceCharge.toLocaleString("en-IN")}` : "") +
        `\nGive them the update in a warm, reassuring way. Don't make it feel like reading a receipt.`;

      const fallback =
        `Your device (${ticket.deviceDetails}) is currently *${ticket.status}*.\n` +
        `Ticket ID: *#${ticket.ticketNumber}*` +
        (ticket.serviceCharge ? `\nEstimate: ₹${ticket.serviceCharge.toLocaleString("en-IN")}` : "") +
        `\n\nAny questions? Feel free to ask!`;

      replyText = await this.generateWarmReply(text, memory, { shopName, situation, fallback }, settings);
    } else {
      replyText =
        `Hmm, I couldn't find a ticket linked to this number. 🤔\n` +
        `Could you share your 6-digit ticket ID (like #100234)? I'll pull it up right away!`;
    }

    await this.sendReply(msg, customerChatId, replyText, whatsAppService);
    await this.appendAgentReply(memory, replyText);
  }

  // ── Boss Commands ──────────────────────────────────────────────────────────

  private static async handleBossMessage(
    msg: any,
    bossChatId: string,
    text: string,
    whatsAppService: any,
    settings: any
  ): Promise<void> {
    const lower = text.toLowerCase();

    if (lower.includes("summary") || lower.includes("deals") || lower.includes("stats") || lower.includes("report")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalInquiries, dealsAgreed, awaitingVendor] = await Promise.all([
        WhatsAppInquiry.countDocuments({ createdAt: { $gte: today } }),
        WhatsAppInquiry.find({ status: "deal_agreed", updatedAt: { $gte: today } }),
        WhatsAppInquiry.countDocuments({ status: "awaiting_vendor" }),
      ]);

      let totalSales = 0;
      let totalProfit = 0;
      dealsAgreed.forEach((d) => {
        totalSales += d.quotedPrice || 0;
        totalProfit += Math.max(0, (d.quotedPrice || 0) - (d.vendorPrice || 0));
      });

      const reply =
        `📊 *Today's WhatsApp Agent Report*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 Inquiries: *${totalInquiries}*\n` +
        `🤝 Deals Closed: *${dealsAgreed.length}*\n` +
        `⏳ Awaiting Vendor Quote: *${awaitingVendor}*\n` +
        `💵 Sales Volume: *₹${totalSales.toLocaleString("en-IN")}*\n` +
        `📈 Gross Profit Est.: *₹${totalProfit.toLocaleString("en-IN")}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Agent is live. 🟢`;

      await this.sendReply(msg, bossChatId, reply, whatsAppService);
    } else if (
      lower.includes("cost") ||
      lower.includes("breakdown") ||
      lower.includes("component") ||
      lower.includes("price") ||
      lower.includes("part") ||
      lower.includes("detail")
    ) {
      const latestInquiry = await WhatsAppInquiry.findOne({
        status: { $in: ["deal_agreed", "quoted"] },
      }).sort({ updatedAt: -1 });

      if (latestInquiry) {
        let custPhoneDisplay = "WhatsApp Direct";
        if (latestInquiry.customerRealPhone) {
          const d = latestInquiry.customerRealPhone.replace(/\D/g, "");
          if (d.startsWith("91")) {
            const local = d.slice(2);
            custPhoneDisplay = local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : `+91 ${local}`;
          } else if (d === "923167255624") {
            custPhoneDisplay = `+91 923167255624`;
          } else {
            custPhoneDisplay = `+${d}`;
          }
        } else if (latestInquiry.customerPhone && !latestInquiry.customerPhone.includes("@lid")) {
          const raw = latestInquiry.customerPhone.replace(/\D/g, "");
          if (raw.length >= 10 && raw.length <= 15) {
            custPhoneDisplay = `+${raw}`;
          }
        }

        let reply =
          `📋 *Component & Costing Breakdown*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 *Product:* ${latestInquiry.requestedProduct}\n` +
          `👤 *Customer:* ${latestInquiry.customerName || "Customer"} (${custPhoneDisplay})\n` +
          `🏷️ *Status:* ${latestInquiry.status === "deal_agreed" ? "Deal Confirmed 🎉" : "Quoted"}\n\n`;

        if (latestInquiry.items && latestInquiry.items.length > 0) {
          reply +=
            `🧩 *Per-Component Costing:*\n` +
            latestInquiry.items
              .map((it, idx) => {
                const cost = it.vendorPrice ? `₹${it.vendorPrice.toLocaleString("en-IN")}` : "N/A";
                const quote = it.quotedPrice ? `₹${it.quotedPrice.toLocaleString("en-IN")}` : "N/A";
                const itMargin = it.marginPercent ? ` [${it.marginPercent}% margin]` : "";
                const itProfit =
                  it.quotedPrice && it.vendorPrice
                    ? ` (+₹${(it.quotedPrice - it.vendorPrice).toLocaleString("en-IN")})`
                    : "";
                return `${idx + 1}. *${it.name}*\n   ↳ Cost: ${cost} | Quoted: ${quote}${itMargin}${itProfit}`;
              })
              .join("\n") +
            `\n\n`;
        }

        const vCost = latestInquiry.vendorPrice || 0;
        const sPrice = latestInquiry.quotedPrice || 0;
        const grossProfit = Math.max(0, sPrice - vCost);
        const margin = latestInquiry.marginPercent || 20;

        reply +=
          `🏭 *Supplier Total:* ${latestInquiry.vendorName || "Supplier"} | ₹${vCost.toLocaleString("en-IN")}\n` +
          `💰 *Selling Price:* ₹${sPrice.toLocaleString("en-IN")} (margin: ${margin}%)\n` +
          `📈 *Gross Profit:* ₹${grossProfit.toLocaleString("en-IN")}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━`;

        await this.sendReply(msg, bossChatId, reply, whatsAppService);
      } else {
        await this.sendReply(
          msg,
          bossChatId,
          `No recent quoted deals or inquiries found yet.`,
          whatsAppService
        );
      }
    } else {
      await this.sendReply(
        msg,
        bossChatId,
        `Agent is active 🟢\nReply with:\n• *summary* / *deals* — Today's sales report\n• *costing* / *breakdown* — Latest deal component breakdown`,
        whatsAppService
      );
    }
  }

  // ── AI: Intent Classification ──────────────────────────────────────────────

  private static async classifyCustomerIntent(
    text: string,
    activeInquiry: IWhatsAppInquiry | null,
    memory: ICustomerMemory,
    settings: any
  ): Promise<{
    intent: "agree_deal" | "inquiry_followup" | "product_inquiry" | "service_query" | "request_quotation_pdf" | "general";
    productName?: string;
    products?: string[];
    categoryName?: string;
    wantsPdf?: boolean;
  }> {
    const lower = text.toLowerCase().trim();

    // Fast-path 1: Unambiguous short deal confirmation when customer already has a quoted price
    if (activeInquiry && activeInquiry.status === "quoted") {
      if (/^(yes|ok|okay|confirm|deal|done|haan|ha|bilkul|sure|book|book it)$/i.test(lower)) {
        return { intent: "agree_deal" };
      }
    }

    // Fast-path 2: Short inquiry status check when awaiting vendor
    if (activeInquiry && activeInquiry.status === "awaiting_vendor") {
      if (/^(check|update|kya hua|kuch pata|status|mila kya|any update|batao|bataiye)$/i.test(lower)) {
        return { intent: "inquiry_followup" };
      }
    }

    // AI dynamic classification (primary)
    if (settings.aiEnabled && settings.aiProvider !== "none") {
      try {
        const historySnippet = recentHistory(memory.history, 6)
          .map((t) => `${t.role}: ${t.message}`)
          .join("\n");

        const prompt =
          `You are an expert conversational intent classifier for a computer hardware shop's WhatsApp agent.\n` +
          `Shop: "${settings.shopName || "Mamdani Computers"}"\n\n` +
          `Recent conversation:\n${historySnippet || "(none)"}\n\n` +
          `Customer message: "${text}"\n` +
          (activeInquiry ? `Active inquiry: "${activeInquiry.requestedProduct}" at ₹${activeInquiry.quotedPrice}, status: "${activeInquiry.status}"\n` : "") +
          `\nDynamically classify the intent based on conversational context, semantic meaning, and customer intent (DO NOT rely on rigid keywords):\n\n` +
          `Intent categories:\n` +
          `1. "product_inquiry":\n` +
          `   The customer is inquiring about, listing, or requesting rates/prices/availability/quotes for hardware products or specs (e.g. CPU, GPU, RAM, SSD, motherboard, laptop, monitor, cabinet, power supply, etc.).\n` +
          `   CRITICAL RULE: If the customer asks for a "quotation", "quote", or "estimate" AND specifies one or more hardware items or parts list (e.g. "I need a quotation for: h81m cs motherboard, 4GB ddr3, Intel core I7 4th gen, 512GB SSD"), this MUST be classified as "product_inquiry" because they are giving items to price and quote!\n` +
          `   Extract ALL mentioned products as a clean array in "products" (e.g. ["h81m cs motherboard", "4GB ddr3", "Intel core I7 4th gen", "512GB SSD"]).\n` +
          `   If they specifically asked for a PDF, document, or official quotation along with their items, also set "wantsPdf": true.\n\n` +
          `2. "request_quotation_pdf":\n` +
          `   The customer wants to receive an official quotation document, PDF file, formal written estimate, bill, or rate sheet for items previously discussed, currently active inquiry, or asking generally for a quotation without giving any items (e.g. "send me the quotation", "pdf bhejo", "can you send the quote in pdf?", "share the estimate document", "I need a formal quote", "can you give me a quotation?").\n\n` +
          `3. "agree_deal":\n` +
          `   The customer confirms, accepts, or books the currently quoted product/price from the active inquiry (e.g. "deal done", "book it", "pack it", "confirm kar do", "I'll take it").\n\n` +
          `4. "inquiry_followup":\n` +
          `   The customer is asking for an update or status of their previously requested product or waiting on supplier rates (e.g. "any update?", "kya hua?", "rates mile?").\n\n` +
          `5. "service_query":\n` +
          `   The customer is asking about computer repair, diagnostic ticket, RMA, or service job.\n\n` +
          `6. "general":\n` +
          `   Simple greetings ("hi", "hello"), shop address, business hours, or casual chit-chat with no hardware mentions.\n\n` +
          `Respond with JSON only (no markdown code blocks, strict JSON):\n` +
          `{"intent":"product_inquiry","products":["..."],"productName":"...","categoryName":"...","wantsPdf":false}`;

        const raw = await aiService.chatCompletion(
          [
            { role: "system", content: "Respond in strict JSON only. No markdown." },
            { role: "user", content: prompt },
          ],
          30000
        );

        let cleaned = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
        const parsed = JSON.parse(cleaned);
        if (parsed.intent) {
          if (Array.isArray(parsed.products) && parsed.products.length > 0) {
            parsed.productName = parsed.products.join(" + ");
          }
          return parsed;
        }
      } catch (e) {
        console.warn("[WhatsAppAgentService] Intent classification fallback:", e);
      }
    }

    // Heuristic fallback (only when AI is unavailable or fails)
    if (/ticket|repair|service|rma|diagnostic|#?\d{6}/i.test(lower)) {
      return { intent: "service_query" };
    }

    const productKeywords = [
      "motherboard", "ram", "ssd", "processor", "cpu", "gpu", "graphics card",
      "intel", "ryzen", "core i", "rtx", "gtx", "ddr", "nvme", "hdd", "hard disk",
      "laptop", "monitor", "cabinet", "smps", "power supply", "charger", "display",
      "keyboard", "mouse", "printer", "router", "wifi", "cooler", "thermal paste",
      "price", "rate", "cost", "available", "stock", "kitne", "kitna", "bhav", "chahiye", "need"
    ];

    const hasProductMention = productKeywords.some((k) => lower.includes(k));

    if (hasProductMention) {
      const lines = text.split(/\r?\n/).map(l => l.replace(/^[-*•\d.)\s]+/g, "").trim()).filter(Boolean);
      let extracted: string[] = [];
      if (lines.length > 1) {
        extracted = lines.filter(l => !/^(i need|quotation|quote|price|rate|can you|hello|hi|please|for the following)/i.test(l));
      }
      if (extracted.length === 0) {
        const cleanProd = text.replace(/^(hi|hello|hey|bhai|sir|boss|yaar|do you have|what is|tell me|rate of|price of|i need a quotation for(?: the following:?)?|quotation for)\s*/i, "").trim();
        extracted = cleanProd.split(/\s*(?:,|\band\b|\baur\b|\+|\&)\s*/i).map(p => p.trim()).filter(Boolean);
      }
      const wantsPdf = /pdf|quotation|quote|estimate|bill|invoice/i.test(lower);
      return {
        intent: "product_inquiry",
        products: extracted.length > 0 ? extracted : [text.trim()],
        productName: extracted.join(" + "),
        wantsPdf,
      };
    }

    if (/quotation|quote|pdf|estimate|formal quote|rate sheet|price list/i.test(lower)) {
      return { intent: "request_quotation_pdf" };
    }

    return { intent: "general" };
  }

  // ── AI: Parse Vendor Quote ─────────────────────────────────────────────────

  private static async parseVendorQuote(
    text: string,
    product: string,
    settings: any,
    items?: any[]
  ): Promise<{
    available: boolean | null;
    price: number | null;
    itemQuotes?: Array<{ name: string; available: boolean; price: number }>;
    notes?: string;
  }> {
    if (settings.aiEnabled && settings.aiProvider !== "none") {
      try {
        const isMulti = items && items.length > 1;
        const itemsListDesc = isMulti
          ? `Items requested: ${items.map((i: any, idx: number) => `${idx + 1}. ${i.name}`).join(", ")}`
          : `Item requested: "${product}"`;

        const prompt =
          `A computer shop asked supplier for wholesale pricing.\n` +
          `${itemsListDesc}\n` +
          `Supplier replied: "${text}"\n\n` +
          `Task: Extract availability and wholesale price (₹).\n` +
          `Rules:\n` +
          `- available: true if supplier confirms stock or provides a price.\n` +
          `- available: false ONLY if supplier explicitly says out of stock, not available, khatam, no stock, nahi hai.\n` +
          `- available: null if supplier is greeting, asking questions, needs specs, or says let me check / wait.\n` +
          `- price: total numeric wholesale price (₹) or sum of quoted items.\n` +
          (isMulti ? `- itemQuotes: array of [{ "name": "...", "available": true/false, "price": number }] for each item quoted.\n` : "") +
          `- CRITICAL: Hardware specifications like 512GB SSD, 256GB, 1TB, 16GB RAM, i5, 10th Gen are SPECS, NOT PRICES! Never extract 512, 256, 128 as a price when they refer to storage.\n` +
          `- notes: short explanation\n\n` +
          `JSON format only:\n{"available": true|false|null, "price": 4500|null` +
          (isMulti ? `, "itemQuotes": [{"name": "${items[0].name}", "available": true, "price": 2000}]` : "") +
          `, "notes": "..."}`;

        const raw = await aiService.chatCompletion(
          [
            { role: "system", content: "Extract wholesale quote information accurately. Output valid JSON only." },
            { role: "user", content: prompt },
          ],
          30000
        );

        const cleaned = raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
        const parsed = JSON.parse(cleaned);
        if (parsed.available === true || parsed.available === false || parsed.available === null) {
          return parsed;
        }
      } catch (e) {
        console.warn("[WhatsAppAgentService] Vendor quote parse fallback:", e);
      }
    }

    // Heuristic fallback
    const lower = text.toLowerCase().trim();

    // 1. Explicit out of stock check
    const outKeywords = [
      "out of stock", "not available", "no stock", "nahi hai", "khatam",
      "nil", "na hai", "available nahi", "stock nahi", "currently unavailable",
      "sold out"
    ];
    if (outKeywords.some((w) => lower.includes(w))) {
      return { available: false, price: null, notes: "Explicitly out of stock" };
    }

    // 2. Strip hardware specs (e.g. 512GB, 256GB, 1TB, 16GB, 8GB, i5, 10th Gen) so spec numbers are not mistaken for prices
    const textWithoutSpecs = text
      .replace(/\b\d+\s*(?:gb|tb|mb|ghz|mhz|inch|"|w|gen|th|rpm)\b/gi, "")
      .replace(/\b(?:core\s*)?i[3579]\b/gi, "")
      .replace(/\bryzen\s*\d+\b/gi, "");

    // 3. Price pattern: look for currency prefixes/suffixes or standalone numbers >= 500
    const priceWithCurrency = textWithoutSpecs.match(
      /(?:rs\.?|inr|₹|\/-?|rate|price|cost|@)\s*([0-9]{3,7}(?:\.[0-9]{1,2})?)|([0-9]{3,7}(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹|\/-?|rupees)/i
    );
    const standalonePrice = textWithoutSpecs.match(/\b([1-9][0-9]{3,6})\b/);

    let extractedPrice: number | null = null;
    if (priceWithCurrency) {
      const p = parseFloat((priceWithCurrency[1] || priceWithCurrency[2]).replace(/,/g, ""));
      if (!isNaN(p) && p >= 200) extractedPrice = p;
    } else if (standalonePrice) {
      const p = parseFloat(standalonePrice[1].replace(/,/g, ""));
      if (!isNaN(p) && p >= 500) extractedPrice = p;
    }

    if (extractedPrice) {
      return { available: true, price: extractedPrice, notes: "Extracted via pattern" };
    }

    // 4. Greetings, acknowledgments, or questions without price -> ambiguous
    const isCasualOrQuestion =
      text.endsWith("?") ||
      lower.length < 25 ||
      /^(hi|hello|hey|haan|ha|ok|okay|checking|wait|ruko|bhai|sir)\b/i.test(lower);

    if (isCasualOrQuestion) {
      return { available: null, price: null, notes: "Vendor greeting or asking question - waiting for quote" };
    }

    return { available: null, price: null, notes: "Undetermined" };
  }

  // ── AI: Boss Suggestions ───────────────────────────────────────────────────

  private static async generateBossSuggestions(
    inquiry: IWhatsAppInquiry,
    memory: ICustomerMemory,
    settings: any
  ): Promise<string> {
    const fallback =
      `1. Contact ${inquiry.vendorName || "supplier"} to lock stock and get dispatch ETA.\n` +
      `2. Raise Tax Invoice/Quotation in Astr ERP for ${memory.name}.\n` +
      `3. Collect advance payment or confirm store pickup time.`;

    if (settings.aiEnabled && settings.aiProvider !== "none") {
      try {
        const pastBuys = memory.pastInquiries.filter((p) => p !== inquiry.requestedProduct).slice(-3);
        const prompt =
          `Customer ${memory.name} (+${inquiry.customerPhone}) just confirmed buying "${inquiry.requestedProduct}" for ₹${(inquiry.quotedPrice || 0).toLocaleString("en-IN")}.\n` +
          `Supplier: ${inquiry.vendorName} at ₹${(inquiry.vendorPrice || 0).toLocaleString("en-IN")} (profit: ₹${Math.max(0, (inquiry.quotedPrice || 0) - (inquiry.vendorPrice || 0)).toLocaleString("en-IN")}).\n` +
          (pastBuys.length ? `Customer also asked about: ${pastBuys.join(", ")}.\n` : "") +
          `\nGive 3 short, practical, high-impact suggestions for the store boss. Max 60 words total.`;

        const raw = await aiService.chatCompletion(
          [
            { role: "system", content: "You are a retail advisor for a computer store. Keep suggestions practical and brief." },
            { role: "user", content: prompt },
          ],
          30000
        );
        if (raw && raw.trim()) return raw.trim();
      } catch (e) {
        console.warn("[WhatsAppAgentService] Boss suggestions fallback:", e);
      }
    }

    return fallback;
  }
}

export default WhatsAppAgentService;
