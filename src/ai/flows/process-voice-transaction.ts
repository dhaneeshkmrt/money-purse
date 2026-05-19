'use server';
/**
 * @fileOverview AI flow to process voice notes and extract transaction details.
 * Supports English, Tamil, and Tanglish (mixed) speech.
 * All fields are optional to handle partial dictation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const ProcessVoiceTransactionInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording of a transaction detail, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;base64,<encoded_data>'."
    ),
  availableCategories: z.array(z.string()).describe('List of current user categories.'),
});
export type ProcessVoiceTransactionInput = z.infer<typeof ProcessVoiceTransactionInputSchema>;

const ProcessVoiceTransactionOutputSchema = z.object({
  description: z.string().optional().describe('Short summary of the expense in English.'),
  amount: z.number().optional().describe('The numeric amount of the transaction.'),
  category: z.string().optional().describe('The best matching category from the provided list.'),
  subcategory: z.string().optional().describe('A logical subcategory for the expense.'),
  microcategory: z.string().optional().describe('A specific micro-subcategory if mentioned or implied.'),
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
  
  Fields to extract (ALL ARE OPTIONAL, only provide what you hear):
  1. **description**: A concise summary of what was purchased (translated to English).
  2. **amount**: The numeric value.
  3. **category**: Choose the BEST match from this list: {{#each availableCategories}}{{{this}}}, {{/each}}.
  4. **subcategory**: Identify a specific sub-type (e.g., "Grocery", "Petrol", "Hospital Bill").
  5. **microcategory**: If mentioned (e.g., "Shampoo", "Apples", "Tablets"), capture it here.
  6. **date**: The date of the transaction. If the user mentions "yesterday" (நேற்று) or a specific weekday, calculate it relative to today: ${new Date().toISOString().split('T')[0]}.
  7. **notes**: Any extra context like "emergency", "for mom", "birthday gift", or payment method mentions.

  Be precise with the amount. If multiple items are mentioned, summarize them in the description and sum the amounts. If a field is not mentioned, do not invent data for it.

  Audio: {{media url=audioDataUri}}`,
});

const processVoiceTransactionFlow = ai.defineFlow(
  {
    name: 'processVoiceTransactionFlow',
    inputSchema: ProcessVoiceTransactionInputSchema,
    outputSchema: ProcessVoiceTransactionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI failed to generate a structured response. Please try with clearer audio.');
    return output;
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
