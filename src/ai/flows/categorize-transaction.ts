
'use server';

/**
 * @fileOverview Provides AI-powered suggestions for transaction categories.
 *
 * - suggestTransactionCategories - A function that suggests categories for transactions.
 * - SuggestTransactionCategoriesInput - The input type for the suggestTransactionCategories function.
 * - SuggestTransactionCategoriesOutput - The return type for the suggestTransactionCategories function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTransactionCategoriesInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the transaction.'),
  availableCategories: z
    .array(z.string())
    .describe('The list of available categories.'),
  availableSubcategories: z
    .array(z.string())
    .describe('The list of available subcategories.'),
});
export type SuggestTransactionCategoriesInput = z.infer<
  typeof SuggestTransactionCategoriesInputSchema
>;

const SuggestTransactionCategoriesOutputSchema = z.object({
  suggestedCategory: z
    .string()
    .describe('The AI-suggested category for the transaction.'),
  suggestedSubcategory: z
    .string()
    .describe('The AI-suggested subcategory for the transaction.'),
});
export type SuggestTransactionCategoriesOutput = z.infer<
  typeof SuggestTransactionCategoriesOutputSchema
>;

const prompt = ai.definePrompt({
  name: 'suggestTransactionCategoriesPrompt',
  input: {
    schema: SuggestTransactionCategoriesInputSchema,
  },
  output: {
    schema: SuggestTransactionCategoriesOutputSchema,
  },
  prompt: `You are an AI financial assistant. Given the following transaction description, suggest the most appropriate category and subcategory from the provided lists.

Transaction Description: {{{transactionDescription}}}

Available Categories: 
{{#each availableCategories}}- {{{this}}}
{{/each}}

Available Subcategories:
{{#each availableSubcategories}}- {{{this}}}
{{/each}}

Return the best matching pair from the lists.`,
});

const suggestTransactionCategoriesFlow = ai.defineFlow(
  {
    name: 'suggestTransactionCategoriesFlow',
    inputSchema: SuggestTransactionCategoriesInputSchema,
    outputSchema: SuggestTransactionCategoriesOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      return output!;
    } catch (error) {
      throw error;
    }
  }
);

export async function suggestTransactionCategories(
  input: SuggestTransactionCategoriesInput
): Promise<SuggestTransactionCategoriesOutput> {
  try {
    return await suggestTransactionCategoriesFlow(input);
  } catch (error) {
    console.error('AI categorization failed (check your API key):', error);
    return { suggestedCategory: '', suggestedSubcategory: '' };
  }
}
