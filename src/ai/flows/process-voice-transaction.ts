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
  date: z.string().describe('The date mentioned, or current date if not specified (YYYY-MM-DD).'),
  notes: z.string().optional().describe('Any extra context from the voice note.'),
});
export type ProcessVoiceTransactionOutput = z.infer<typeof ProcessVoiceTransactionOutputSchema>;

const prompt = ai.definePrompt({
  name: 'processVoiceTransactionPrompt',
  input: { schema: ProcessVoiceTransactionInputSchema },
  output: { schema: ProcessVoiceTransactionOutputSchema },
  prompt: `You are a financial assistant. Listen to this voice note and extract transaction details.
  
  Map the expense to one of these categories if possible: {{#each availableCategories}}{{{this}}}, {{/each}}.
  
  If the user says something like "Spent 50 on coffee yesterday", set the date to yesterday's date relative to now.
  If no date is mentioned, use today's date: ${new Date().toISOString().split('T')[0]}.

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
    return output!;
  }
);

export async function processVoiceTransaction(input: ProcessVoiceTransactionInput): Promise<ProcessVoiceTransactionOutput> {
  try {
    return await processVoiceTransactionFlow(input);
  } catch (error: any) {
    console.error('Voice processing failed:', error);
    throw new Error(error.message || 'Failed to process voice note. Ensure microphone quality is good.');
  }
}
