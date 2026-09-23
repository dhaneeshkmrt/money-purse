'use server';
/**
 * @fileOverview An AI agent that extracts insurance policy details from documents.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const ExtractInsuranceInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A photo or scan of an insurance policy document, as a data URI. Format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInsuranceInput = z.infer<typeof ExtractInsuranceInputSchema>;

const ExtractInsuranceOutputSchema = z.object({
  type: z.enum(['Motor', 'Health', 'Term', 'Life', 'Home', 'Travel', 'Other']).describe('The type of insurance.'),
  provider: z.string().describe('The name of the insurance company/provider.'),
  policyNumber: z.string().describe('The unique policy identification number.'),
  premiumAmount: z.number().describe('The premium amount to be paid.'),
  startDate: z.string().describe('The policy start date in YYYY-MM-DD format.'),
  expiryDate: z.string().describe('The policy expiration date in YYYY-MM-DD format.'),
  notes: z.string().optional().describe('Any other important details observed.'),
});
export type ExtractInsuranceOutput = z.infer<typeof ExtractInsuranceOutputSchema>;

const prompt = ai.definePrompt({
  name: 'extractInsurancePrompt',
  input: {schema: ExtractInsuranceInputSchema},
  output: {schema: ExtractInsuranceOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are an insurance document expert. 

Examine the provided insurance policy document image carefully. 
Identify the type of insurance (Motor, Health, Term, etc.), the provider name, policy number, premium amount, start date, and expiry date.

If you see multiple dates, look for 'Expiry', 'Ends On', or 'Valid Upto' for the expiryDate.
For amounts, look for 'Total Premium' or 'Net Premium'.

Document: {{media url=documentDataUri}}`,
});

const FALLBACK_MODELS = ['gemini-2.5-flash','gemini-3.5-flash', 'gemini-3.6-flash'];

const extractInsuranceFlow = ai.defineFlow(
  {
    name: 'extractInsuranceFlow',
    inputSchema: ExtractInsuranceInputSchema,
    outputSchema: ExtractInsuranceOutputSchema,
  },
  async input => {
    let lastError: any = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const {output} = await prompt(input, {
          model: googleAI.model(modelName as any),
        });
        if (output) return output;
      } catch (err: any) {
        lastError = err;
        console.warn(`Insurance AI extraction with ${modelName} failed:`, err?.message);
      }
    }
    throw new Error(lastError?.message || 'AI failed to read the document details. Please ensure the photo is clear.');
  }
);

export async function extractInsuranceDetails(input: ExtractInsuranceInput): Promise<ExtractInsuranceOutput> {
  try {
    return await extractInsuranceFlow(input);
  } catch (error: any) {
    console.error('AI extraction failed:', error);
    throw new Error(error.message || 'Failed to extract insurance details. Please check document quality.');
  }
}
