'use server';
/**
 * @fileOverview An AI image generation and editing agent.
 *
 * - generateImage - A function that handles image generation and editing.
 * - GenerateImageInput - The input type for the generateImage function.
 * - GenerateImageOutput - The return type for the generateImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('The text prompt to guide the image generation.'),
  imageDataUri: z
    .string()
    .optional()
    .describe(
      "An optional existing image to edit, as a data URI. Format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  generatedImageUri: z
    .string()
    .describe("The generated or edited image as a data URI."),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async ({ prompt, imageDataUri }) => {
    // Using the latest supported image generation model
    const model = 'googleai/gemini-2.5-flash-image';

    const promptParts: any[] = [{ text: prompt }];

    if (imageDataUri) {
      promptParts.unshift({ media: { url: imageDataUri } });
    }

    const { media } = await ai.generate({
      model: model,
      prompt: promptParts,
      config: {
        // Must provide both TEXT and IMAGE for this model
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to produce an image.');
    }
    
    return { generatedImageUri: media.url };
  }
);

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  try {
    return await generateImageFlow(input);
  } catch (error: any) {
    console.error('AI image generation failed:', error);
    // Propagate the specific error message so the UI Toast can display it
    throw new Error(error.message || 'Image generation failed. Please check your API key.');
  }
}
