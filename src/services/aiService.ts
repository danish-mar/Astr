import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import ShopSettings from "../models/ShopSettings";

// AI Service for LangChain integration
class AIService {
    private static instance: AIService;

    private reviewQueue: string[] = [];
    private isRefillingQueue = false;
    private readonly QUEUE_TARGET_SIZE = 3;

    private constructor() { }

    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * Get configured LLM instance based on shop settings or override config
     */
    private async getLLM(overrideConfig?: {
        provider?: string;
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    }) {
        const settings = await ShopSettings.findOne().select('+aiApiKey');

        const provider = overrideConfig?.provider || settings?.aiProvider;
        const apiKey = (overrideConfig?.apiKey && overrideConfig.apiKey.trim() !== '')
            ? overrideConfig.apiKey.trim()
            : settings?.aiApiKey;
        const baseUrl = (overrideConfig?.baseUrl && overrideConfig.baseUrl.trim() !== '')
            ? overrideConfig.baseUrl.trim()
            : settings?.aiBaseUrl;
        const model = (overrideConfig?.model && overrideConfig.model.trim() !== '')
            ? overrideConfig.model.trim()
            : settings?.aiModel;

        if (!provider || provider === 'none') {
            throw new Error('AI is not configured. Please select an AI provider in Settings.');
        }

        if (!apiKey && provider !== 'custom') {
            throw new Error('AI API key is missing. Please configure it in Settings.');
        }

        switch (provider) {
            case 'gemini':
                return new ChatGoogleGenerativeAI({
                    apiKey: apiKey || "",
                    model: model || "gemini-2.5-flash",
                    temperature: 0.7,
                });

            case 'openai':
                return new ChatOpenAI({
                    apiKey: apiKey || undefined,
                    openAIApiKey: apiKey || undefined,
                    model: model || "gpt-3.5-turbo",
                    configuration: {
                        baseURL: baseUrl ? baseUrl.replace(/\/+$/, '') : undefined,
                        apiKey: apiKey || undefined,
                        defaultHeaders: {
                            'User-Agent': 'Astr-Protocol/3.3.0',
                            'HTTP-Referer': 'https://astr.app',
                            'X-Title': 'Astr Protocol',
                        }
                    },
                    temperature: 0.7,
                    timeout: 10000,
                    maxRetries: 0,
                });

            case 'custom':
                if (!baseUrl) {
                    throw new Error('OpenAI URL / Base URL is required for custom provider.');
                }
                return new ChatOpenAI({
                    apiKey: apiKey || "dummy-key",
                    openAIApiKey: apiKey || "dummy-key",
                    model: model || "default",
                    modelName: model || "default",
                    configuration: {
                        baseURL: baseUrl.replace(/\/+$/, ''),
                        apiKey: apiKey || "dummy-key",
                        defaultHeaders: {
                            'User-Agent': 'Astr-Protocol/3.3.0',
                            'HTTP-Referer': 'https://astr.app',
                            'X-Title': 'Astr Protocol',
                        }
                    },
                    temperature: 0.7,
                    timeout: 10000,
                    maxRetries: 0,
                });

            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    /**
     * Fetch models from an OpenAI-compatible /models endpoint or Gemini provider
     */
    async fetchModels(options?: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
    }): Promise<string[]> {
        const settings = await ShopSettings.findOne().select('+aiApiKey');

        const provider = options?.provider || settings?.aiProvider;
        const apiKey = (options?.apiKey && options.apiKey.trim() !== '')
            ? options.apiKey.trim()
            : settings?.aiApiKey;
        let baseUrl = (options?.baseUrl && options.baseUrl.trim() !== '')
            ? options.baseUrl.trim()
            : settings?.aiBaseUrl;

        if (provider === 'gemini') {
            return [
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-2.0-flash",
                "gemini-1.5-flash",
                "gemini-1.5-pro"
            ];
        }

        if (provider === 'openai' && !baseUrl) {
            baseUrl = "https://api.openai.com/v1";
        }

        if (!baseUrl) {
            throw new Error("Base URL is required to fetch models for OpenAI compatible provider.");
        }

        // Clean baseUrl
        const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
        const targetUrl = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (apiKey && apiKey.trim() !== '') {
            headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            let response = await fetch(targetUrl, {
                method: 'GET',
                headers,
                signal: controller.signal
            });

            // If 404 and doesn't contain /v1, try appending /v1/models
            if (response.status === 404 && !cleanUrl.includes('/v1')) {
                const fallbackUrl = `${cleanUrl}/v1/models`;
                try {
                    const fallbackResp = await fetch(fallbackUrl, {
                        method: 'GET',
                        headers,
                        signal: controller.signal
                    });
                    if (fallbackResp.ok) {
                        response = fallbackResp;
                    }
                } catch {
                    // ignore fallback error and let standard handler report
                }
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`Endpoint returned status ${response.status}: ${errorText.slice(0, 200)}`);
            }

            const data: any = await response.json();
            let models: string[] = [];

            if (Array.isArray(data)) {
                models = data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
            } else if (Array.isArray(data.data)) {
                models = data.data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
            } else if (Array.isArray(data.models)) {
                models = data.models.map((m: any) => (typeof m === 'string' ? m : m.name || m.id)).filter(Boolean);
            }

            if (models.length === 0) {
                throw new Error("No models were found in the endpoint response.");
            }

            return Array.from(new Set(models)).sort();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("Connection timed out while fetching models.");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Generate product advertisement messages for WhatsApp
     */
    async generateProductAd(productData: {
        name: string;
        category: string;
        price: number;
        specifications?: Record<string, any>;
        tags?: string[];
    }): Promise<{ short: string; medium: string; long: string }> {
        try {
            const llm = await this.getLLM();

            // Format specifications
            const specs = productData.specifications
                ? Object.entries(productData.specifications)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ')
                : 'No specifications';

            const tags = productData.tags?.join(', ') || 'No tags';

            // Prompt template for short message
            const shortPrompt = PromptTemplate.fromTemplate(`
You are a WhatsApp marketing expert for a computer/electronics shop in India.

Product Details:
- Name: {name}
- Category: {category}
- Price: ₹{price}
- Specifications: {specs}
- Tags: {tags}

Generate a SHORT WhatsApp message (max 50 words) to advertise this product.
Requirements:
- Use 1-2 relevant emojis
- Include price in Indian Rupees (₹)
- Create urgency or excitement
- End with a call-to-action
- Sound natural and friendly
- Use Indian English style

Message:
`);

            const mediumPrompt = PromptTemplate.fromTemplate(`
                You are an expert product listing writer for a computer/electronics shop in India.

                Your task is to generate a CLEAN, STRUCTURED WhatsApp product listing message using the format shown below.  
                The style must match the sample layout — line-by-line specs with emojis.

                -------------------------
                📌 {name} — {category}

                Then list the specifications in neat bullet-style lines.  
                Follow this structure exactly:

                💻 Processor: ...
                ⚡ RAM: ...
                💾 Storage: ...
                🎮 Graphics: ...
                🖥️ Display: ...
                🔋 Battery: ...
                📦 Condition: ...
                🔌 Charger: ...
                -------------------------

                RULES:
                - Use ONLY this structured, clean formatting (no paragraphs)
                - Use 2–3 carefully selected emojis that match the spec type
                - Rephrase specs only when needed (keep accuracy)
                - If some spec is missing, intelligently skip that line
                - Do NOT add CTA, promotions, price urgency, or marketing tone
                - Keep the message neutral, informative, and professional
                - Ensure the final output feels like a premium product listing
                - Keep within 60–120 words

                Product Details:
                - Name: {name}
                - Category: {category}
                - Price: ₹{price}
                - Specifications: {specs}
                - Tags: {tags}

                Generate the formatted WHATSAPP LISTING MESSAGE now:
                `);


            // Prompt template for long message
            const longPrompt = PromptTemplate.fromTemplate(`
You are a WhatsApp marketing expert for a computer/electronics shop in India.

Product Details:
- Name: {name}
- Category: {category}
- Price: ₹{price}
- Specifications: {specs}
- Tags: {tags}

Generate a DETAILED WhatsApp message (100-150 words) to advertise this product.
Requirements:
- Use 3-4 relevant emojis
- Include price in Indian Rupees (₹)
- Highlight all key features and specifications
- Explain benefits to customer
- Create urgency or excitement
- End with multiple call-to-action options (call, visit, DM)
- Sound natural and friendly
- Use Indian English style

Message:
`);

            // Generate all three variants
            const [shortChain, mediumChain, longChain] = await Promise.all([
                shortPrompt.pipe(llm),
                mediumPrompt.pipe(llm),
                longPrompt.pipe(llm),
            ]);

            const inputData = {
                name: productData.name,
                category: productData.category,
                price: productData.price.toString(),
                specs,
                tags,
            };

            const [shortResult, mediumResult, longResult] = await Promise.all([
                shortChain.invoke(inputData),
                mediumChain.invoke(inputData),
                longChain.invoke(inputData),
            ]);

            return {
                short: shortResult.content.toString().trim(),
                medium: mediumResult.content.toString().trim(),
                long: longResult.content.toString().trim(),
            };
        } catch (error: any) {
            console.error('AI Service Error:', error);
            throw new Error(`Failed to generate ad: ${error.message}`);
        }
    }

    /**
     * Fast, resilient prompt execution with direct fetch for custom endpoints and 8s timeout
     */
    private async executePrompt(promptText: string, timeoutMs = 8000): Promise<string> {
        const settings = await ShopSettings.findOne().select('+aiApiKey');
        const provider = settings?.aiProvider;
        const apiKey = settings?.aiApiKey;
        const baseUrl = settings?.aiBaseUrl;
        const model = settings?.aiModel;

        if (!provider || provider === 'none') {
            throw new Error('AI is not configured.');
        }

        if (provider === 'custom') {
            if (!baseUrl) throw new Error('Base URL is missing for custom provider.');
            const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
            const targetUrl = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Astr-Protocol/3.3.0',
                    'HTTP-Referer': 'https://astr.app',
                    'X-Title': 'Astr Protocol',
                };
                if (apiKey && apiKey.trim() !== '') {
                    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
                }

                const payload = {
                    model: model || 'default',
                    messages: [
                        { role: 'user', content: promptText }
                    ],
                    temperature: 0.7,
                    stream: false,
                };

                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => res.statusText);
                    throw new Error(`Custom provider returned ${res.status}: ${errText.slice(0, 200)}`);
                }

                const data: any = await res.json();
                const reply = data?.choices?.[0]?.message?.content;
                if (!reply) throw new Error('Empty response from custom AI provider.');
                return String(reply).trim();
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // Gemini or OpenAI Official
        const llm = await this.getLLM();
        const promptTemplate = PromptTemplate.fromTemplate("{inputPrompt}");
        const chain = promptTemplate.pipe(llm);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`AI generation timed out after ${timeoutMs}ms.`)), timeoutMs)
        );
        const result: any = await Promise.race([
            chain.invoke({ inputPrompt: promptText }),
            timeoutPromise
        ]);
        return result.content ? result.content.toString().trim() : '';
    }

    /**
     * Generate customer reviews (random positive from queue or custom prompt based)
     */
    async generateReview(options: {
        type: 'random' | 'custom';
        customPrompt?: string;
        shopName?: string;
    }): Promise<string> {
        const shopName = options.shopName || "the shop";

        // For random reviews: instantly pop an already generated review and queue up a replacement
        if (options.type === 'random' || !options.customPrompt?.trim()) {
            return this.popFromReviewQueue(shopName);
        }

        // Custom prompt review (generated dynamically on demand based on specific user prompt)
        try {
            const promptText = `You are a satisfied real customer writing an authentic, 5-star Google review for ${shopName} (a computer repair and electronics shop).

The service or purchase experience was:
"${options.customPrompt}"

Rules for the review:
- Write in first person ("I got my laptop repaired...", "They fixed my...", "Great experience with...")
- Sound genuine, conversational, warm, and natural (NOT overly corporate or robotic)
- Length: 2 to 4 concise sentences (40-80 words)
- Highlight friendly staff, quick turnaround, fair pricing, and quality workmanship
- Do NOT use hashtags or quote marks around the whole text
- Mention ${shopName} naturally if appropriate

Review text:`;

            const review = await this.executePrompt(promptText, 8000);
            return review || this.getFallbackReview(options);
        } catch (error) {
            console.warn('AI custom review generation fallback invoked:', error);
            return this.getFallbackReview(options);
        }
    }

    /**
     * Pop a review from the pre-generated queue and trigger a background refill
     */
    async popFromReviewQueue(shopName?: string): Promise<string> {
        let review: string;
        if (this.reviewQueue.length > 0) {
            review = this.reviewQueue.shift()!;
        } else {
            // Queue empty: fallback sample
            review = this.getFallbackReview({ type: 'random', shopName });
        }

        // Trigger background refill to maintain queue size
        this.refillReviewQueue(shopName).catch(err => console.warn('Queue refill background error:', err));

        return review;
    }

    /**
     * Pre-generate a single random positive review
     */
    private async generateSingleRandomReview(shopName?: string): Promise<string> {
        const shop = shopName || "the shop";
        try {
            const promptText = `You are a satisfied real customer writing an authentic, positive 5-star Google review for ${shop} (a computer/laptop repair and tech shop).

Rules for the review:
- Write in first person as a happy customer
- Vary the topic naturally: mention quick turnaround time, professional diagnosis, affordable repair cost, honesty, or friendly technicians
- Sound natural, friendly, and human (NOT AI-generated or overly exaggerated)
- Length: 2 to 4 sentences (40-75 words)
- Do NOT use hashtags or quote marks around the message

Review text:`;

            const review = await this.executePrompt(promptText, 8000);
            return review || this.getFallbackReview({ type: 'random', shopName: shop });
        } catch (error) {
            return this.getFallbackReview({ type: 'random', shopName: shop });
        }
    }

    /**
     * Refill queue sequentially until target size of 3 is reached
     */
    async refillReviewQueue(shopName?: string): Promise<void> {
        if (this.isRefillingQueue) return;
        this.isRefillingQueue = true;

        try {
            while (this.reviewQueue.length < this.QUEUE_TARGET_SIZE) {
                const review = await this.generateSingleRandomReview(shopName);
                if (review) {
                    this.reviewQueue.push(review);
                }
            }
        } catch (err) {
            console.warn('[AIService] Failed to refill review queue:', err);
        } finally {
            this.isRefillingQueue = false;
        }
    }

    /**
     * Initialize the queue on server startup
     */
    async initReviewQueue(shopName?: string): Promise<void> {
        console.log('[AIService] Pre-generating review queue (target: 3)...');
        this.refillReviewQueue(shopName).then(() => {
            console.log(`[AIService] Review queue initialized with ${this.reviewQueue.length} pre-generated reviews.`);
        }).catch(err => {
            console.warn('[AIService] Error initializing review queue:', err);
        });
    }

    /**
     * Fallback authentic reviews in case AI is offline / unconfigured
     */
    private getFallbackReview(options: { type: 'random' | 'custom'; customPrompt?: string; shopName?: string }): string {
        const shop = options.shopName || "this shop";
        if (options.type === 'custom' && options.customPrompt?.trim()) {
            const customSamples = [
                `Had a great experience getting my ${options.customPrompt.trim()} done at ${shop}. The team was transparent about pricing and finished the work faster than expected. Everything is running smoothly!`,
                `Visited ${shop} for ${options.customPrompt.trim()}. The staff was extremely polite and professional. Highly impressed by their quick turnaround and reasonable charges!`,
                `Super happy with the service at ${shop}! They handled my ${options.customPrompt.trim()} with great care and attention to detail. Highly recommend them for any repair or tech needs.`
            ];
            return customSamples[Math.floor(Math.random() * customSamples.length)];
        }

        const randomSamples = [
            `Excellent service and honest advice! Took my laptop here for repair and was pleasantly surprised by how quickly they diagnosed and fixed the issue. Very reasonable prices compared to other places.`,
            `Hands down the best repair and tech shop in town. The technicians at ${shop} really know their craft and were super courteous throughout. 10/10 recommended!`,
            `Quick, reliable, and very professional service. They fixed my computer issues within the same day at an affordable rate. Will definitely visit again for any tech needs!`,
            `Great customer support and high quality repair work. Pricing was transparent with no hidden charges. My device works like new again. Thank you ${shop}!`,
            `Outstanding experience! The staff is friendly, knowledgeable, and honest. They explained the problem clearly and resolved it in no time. Highly recommended!`
        ];
        return randomSamples[Math.floor(Math.random() * randomSamples.length)];
    }

    /**
     * Test AI connection with current or provided settings
     */
    async testConnection(config?: {
        provider?: string;
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    }): Promise<{ success: boolean; message: string; provider?: string }> {
        const settings = await ShopSettings.findOne().select('+aiApiKey');

        const provider = config?.provider || settings?.aiProvider;
        const apiKey = (config?.apiKey && config.apiKey.trim() !== '') ? config.apiKey.trim() : settings?.aiApiKey;
        const baseUrl = (config?.baseUrl && config.baseUrl.trim() !== '') ? config.baseUrl.trim() : settings?.aiBaseUrl;
        const model = (config?.model && config.model.trim() !== '') ? config.model.trim() : settings?.aiModel;

        if (!provider || provider === 'none') {
            return {
                success: false,
                message: 'AI is not configured. Please select an AI provider in Settings.',
            };
        }

        if (provider === 'custom') {
            if (!baseUrl) {
                return {
                    success: false,
                    message: 'Endpoint URL is required for custom provider.',
                };
            }

            // Direct fast test to chat/completions with 15s timeout
            const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
            const targetUrl = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Astr-Protocol/3.2.0',
                    'HTTP-Referer': 'https://astr.app',
                    'X-Title': 'Astr Protocol',
                };
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }

                const payload: Record<string, any> = {
                    model: model || 'default',
                    messages: [
                        { role: 'user', content: "Say 'Connection successful!' in one sentence." }
                    ],
                    stream: false,
                };

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    let errMsg = '';
                    try {
                        const errJson: any = await response.json();
                        errMsg = errJson?.error?.message || JSON.stringify(errJson);
                    } catch {
                        errMsg = await response.text().catch(() => response.statusText);
                    }
                    return {
                        success: false,
                        message: `Provider returned ${response.status}: ${errMsg.slice(0, 200)}`,
                        provider,
                    };
                }

                const data: any = await response.json();
                const reply = data?.choices?.[0]?.message?.content || 'Connection successful!';

                return {
                    success: true,
                    message: String(reply).trim(),
                    provider,
                };
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    return {
                        success: false,
                        message: 'Connection timed out after 15s. The model may be cold or endpoint unreachable.',
                        provider,
                    };
                }
                return {
                    success: false,
                    message: `Connection failed: ${err.message}`,
                    provider,
                };
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // Standard Gemini or OpenAI
        try {
            const llm = await this.getLLM({ provider, apiKey, baseUrl, model });
            const testPrompt = PromptTemplate.fromTemplate("Say 'Connection successful!' in one sentence.");
            const chain = testPrompt.pipe(llm);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out after 15s.")), 15000)
            );
            const result: any = await Promise.race([chain.invoke({}), timeoutPromise]);

            return {
                success: true,
                message: result.content ? result.content.toString().trim() : 'AI connection successful!',
                provider,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                provider,
            };
        }
    }
}

export default AIService.getInstance();
