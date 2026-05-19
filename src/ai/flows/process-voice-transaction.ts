'use server';
/**
 * @fileOverview AI flow to process voice notes and extract transaction details.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessVoiceTransactionInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording of a transaction detail, as a data URI. Format: 'data:audio/webm;base64,<encoded_data>'."
    ),
  availableCategories: z.array(z.string()).describe('List of current user categories.'),
});
export type ProcessVoiceTransactionInput = z.infer<typeof ProcessVoiceTransactionInputSchema>;

const ProcessVoiceTransactionOutputSchema = z.object({
  description: z.string().describe('Short summary of the expense.'),
  amount: z.number().describe('The numeric amount of the transaction.'),
  category: z.string().describe('The best matching category from the provided list.'),
  subcategory: z.string().describe('A logical subcategory for the expense.'),
  microcategory: z.string().optional().describe('A specific micro-subcategory if mentioned or implied.'),
  date: z.string().describe('The date mentioned, or current date if not specified (YYYY-MM-DD).'),
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
  prompt: `You are a highly skilled financial assistant. Your task is to listen to the provided voice note and extract structured transaction details.
  
  Fields to extract:
  1. **description**: A concise summary of what was purchased.
  2. **amount**: The numeric value.
  3. **category**: Choose the BEST match from this list: {{#each availableCategories}}{{{this}}}, {{/each}}.
  4. **subcategory**: Identify a specific sub-type (e.g., "Grocery", "Petrol", "Hospital Bill").
  5. **microcategory**: If mentioned (e.g., "Shampoo", "Apples", "Tablets"), capture it here.
  6. **date**: The date of the transaction. If the user says "yesterday" or "last Friday", calculate it relative to today: ${new Date().toISOString().split('T')[0]}. If no date is mentioned, use today.
  7. **notes**: Any additional context like "emergency", "for mom", "birthday gift", or payment method mentions.

  Be precise with the amount. If multiple items are mentioned, summarize them in the description and sum the amounts.

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
    if (!output) throw new Error('AI failed to generate a response');
    return output;
  }
);

export async function processVoiceTransaction(input: ProcessVoiceTransactionInput): Promise<ProcessVoiceTransactionOutput> {
  try {
    return await processVoiceTransactionFlow(input);
  } catch (error: any) {
    console.error('Voice processing failed:', error);
    // Return a default object with an error message in notes to avoid crashing the server action render
    throw new Error(error.message || 'Failed to process voice note. Check your API key or audio quality.');
  }
}
