'use server';
/**
 * @fileOverview AI flow to process voice notes and extract transaction details.
 * Supports English, Tamil, and Tanglish (mixed) speech.
 * All fields are optional to handle partial dictation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { DEFAULT_AI_MODEL, normalizeAiModel } from '@/lib/ai-models';

const CategoryInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  subcategories: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    microcategories: z.array(z.string()).optional(),
  })).optional(),
});

const ProcessVoiceTransactionInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording of a transaction detail, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;base64,<encoded_data>'."
    ),
  availableCategories: z.array(z.string()).optional().describe('List of current user category names.'),
  categoryDetails: z.array(CategoryInfoSchema).optional().describe('Detailed category list with descriptions and subcategories to guide matching.'),
  model: z.string().optional().describe('The Gemini model to use for processing.'),
});
export type ProcessVoiceTransactionInput = z.infer<typeof ProcessVoiceTransactionInputSchema>;

const ProcessVoiceTransactionOutputSchema = z.object({
  description: z.string().optional().describe('Short summary of the expense in English.'),
  amount: z.number().optional().describe('The numeric amount of the transaction.'),
  category: z.string().optional().describe('The best matching category from the provided list.'),
  subcategory: z.string().optional().describe('A logical subcategory for the expense.'),
  microcategory: z.string().optional().describe('A specific micro category if mentioned or implied.'),
  date: z.string().optional().describe('The date mentioned, in YYYY-MM-DD format.'),
  notes: z.string().optional().describe('Any extra context, details, or specific mentions from the voice note.'),
});
export type ProcessVoiceTransactionOutput = z.infer<typeof ProcessVoiceTransactionOutputSchema>;

const prompt = ai.definePrompt({
  name: 'processVoiceTransactionPrompt',
  input: { schema: ProcessVoiceTransactionInputSchema },
  output: { schema: ProcessVoiceTransactionOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are a highly skilled multi-lingual financial assistant. Your task is to listen to the provided voice note and extract structured transaction details.
  
  IMPORTANT LANGUAGE SUPPORT:
  - The voice note may be in English, Tamil (தமிழ்), or a mix of both (Tanglish).
  - Even if the input is in Tamil, provide the final 'description' in English for consistency.
  - Correctly identify Tamil numbers (e.g., "ஆயிரத்து ஐந்நூறு" is 1500) and dates (e.g., "நேற்று" is yesterday).
  
  CATEGORY MATCHING GUIDELINES:
  Use the category descriptions below to identify which category and subcategory the mentioned expense belongs to:
  {{#if categoryDetails}}
  {{#each categoryDetails}}
  - Category: "{{name}}"{{#if description}} (Guideline: {{description}}){{/if}}
    {{#each subcategories}}
    * Subcategory: "{{name}}"{{#if description}} (Guideline: {{description}}){{/if}}{{#if microcategories}} [Micros: {{#each microcategories}}{{this}}, {{/each}}]{{/if}}
    {{/each}}
  {{/each}}
  {{else}}
  Available Categories: {{#each availableCategories}}{{{this}}}, {{/each}}
  {{/if}}

  Fields to extract (ALL ARE OPTIONAL, only provide what you hear):
  1. **description**: A concise summary of what was purchased (translated to English).
  2. **amount**: The numeric value.
  3. **category**: Choose the BEST match from the available categories using the expense guidelines above.
  4. **subcategory**: Choose the matching subcategory under the chosen category using the guidelines.
  5. **microcategory**: If mentioned (e.g., "Shampoo", "Apples", "Tablets"), capture it here.
  6. **date**: The date of the transaction. If the user mentions "yesterday" (நேற்று) or a specific weekday, calculate it relative to today: ${new Date().toISOString().split('T')[0]}.
  7. **notes**: Any extra context like "emergency", "for mom", "birthday gift", or payment method mentions.

  Be precise with the amount. If multiple items are mentioned, summarize them in the description and sum the amounts. If a field is not mentioned, do not invent data for it.

  Audio: {{media url=audioDataUri}}`,
});

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash'];

const processVoiceTransactionFlow = ai.defineFlow(
  {
    name: 'processVoiceTransactionFlow',
    inputSchema: ProcessVoiceTransactionInputSchema,
    outputSchema: ProcessVoiceTransactionOutputSchema,
  },
  async input => {
    const requestedModel = normalizeAiModel(input.model || DEFAULT_AI_MODEL);
    const candidateModels = Array.from(new Set([requestedModel, ...FALLBACK_MODELS]));

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const modelName = candidateModels[i];
      try {
        if (i > 0) {
          // Brief pause before trying fallback to allow rate limits / gateway to clear
          await new Promise(resolve => setTimeout(resolve, 1000 * i));
        }
        const {output} = await prompt(input, {
          model: googleAI.model(modelName as any),
        });
        if (output) {
          return output;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`Voice AI processing with model ${modelName} failed: ${errMsg}`);

        if (i < candidateModels.length - 1) {
          console.info(`Attempting fallback to ${candidateModels[i + 1]}...`);
        }
      }
    }

    const failureReason = lastError?.message?.includes('503') || lastError?.message?.includes('high demand')
      ? 'The AI model service is currently experiencing high demand. Please try again in a few moments.'
      : (lastError?.message || 'AI failed to generate a structured response. Please try with clearer audio.');

    throw new Error(failureReason);
  }
);

export async function processVoiceTransaction(input: ProcessVoiceTransactionInput): Promise<ProcessVoiceTransactionOutput> {
  try {
    return await processVoiceTransactionFlow(input);
  } catch (error: any) {
    console.error('Voice processing failed:', error);
    // Propagate a clean error message for the UI Toast
    throw new Error(error.message || 'Failed to process voice note. Ensure microphone quality is good.');
  }
}

