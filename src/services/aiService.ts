import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import ShopSettings from "../models/ShopSettings";

// AI Service for LangChain integration
class AIService {
    private static instance: AIService;

    private constructor() { }

    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * Get configured LLM instance based on shop settings
     */
    private async getLLM() {
        const settings = await ShopSettings.findOne().select('+aiApiKey');

        if (!settings || !settings.aiEnabled || settings.aiProvider === 'none') {
            throw new Error('AI is not configured. Please set up AI in Settings.');
        }

        if (!settings.aiApiKey) {
            throw new Error('AI API key is missing. Please configure it in Settings.');
        }

        switch (settings.aiProvider) {
            case 'gemini':
                return new ChatGoogleGenerativeAI({
                    apiKey: settings.aiApiKey,
                    model: "gemini-2.5-flash",
                    temperature: 0.7,
                });

            case 'openai':
                return new ChatOpenAI({
                    openAIApiKey: settings.aiApiKey,
                    modelName: "gpt-3.5-turbo",
                    temperature: 0.7,
                });

            default:
                throw new Error(`Unsupported AI provider: ${settings.aiProvider}`);
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
     * Test AI connection with current settings
     */
    async testConnection(): Promise<{ success: boolean; message: string; provider?: string }> {
        try {
            const settings = await ShopSettings.findOne().select('+aiApiKey');

            if (!settings || !settings.aiApiKey || settings.aiProvider === 'none') {
                return {
                    success: false,
                    message: 'AI is not configured. Please set up AI provider and API key.',
                };
            }

            const llm = await this.getLLM();

            // Simple test prompt
            const testPrompt = PromptTemplate.fromTemplate("Say 'Connection successful!' in one sentence.");
            const chain = testPrompt.pipe(llm);
            const result = await chain.invoke({});

            return {
                success: true,
                message: 'AI connection successful!',
                provider: settings.aiProvider,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
            };
        }
    }
}

export default AIService.getInstance();
