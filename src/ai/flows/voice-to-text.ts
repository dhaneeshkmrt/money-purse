'use server';
/**
 * @fileOverview AI flow to transcribe voice audio to plain text.
 * Supports English, Tamil (தமிழ்), and Tanglish (mixed Tamil-English).
 * Used for the Notes "Detailed" variety voice-to-text feature.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const VoiceToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A voice recording as a data URI with MIME type and Base64 encoding. Expected format: 'data:audio/webm;base64,<encoded_data>'."
    ),
});
export type VoiceToTextInput = z.infer<typeof VoiceToTextInputSchema>;

const VoiceToTextOutputSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio in its original language.'),
});
export type VoiceToTextOutput = z.infer<typeof VoiceToTextOutputSchema>;

const prompt = ai.definePrompt({
  name: 'voiceToTextPrompt',
  input: { schema: VoiceToTextInputSchema },
  output: { schema: VoiceToTextOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are an expert multilingual transcription assistant. Your only task is to accurately transcribe the spoken words from the provided audio recording.

LANGUAGE SUPPORT:
- The speaker may use English, Tamil (தமிழ்), or Tanglish (a natural mix of Tamil and English words).
- Transcribe the words EXACTLY as spoken — do not translate, summarize, or modify.
- If the speaker uses Tamil script words, write them in Tamil script.
- If they use English words, keep them in English.
- If they mix both (Tanglish), reproduce the mix faithfully.
- Preserve natural speech including filler sounds if they are meaningful.

IMPORTANT:
- Return ONLY the transcript. Do not add explanations, labels, or commentary.
- If the audio is silent or unclear, return an empty string for transcript.

Audio: {{media url=audioDataUri}}`,
});

const voiceToTextFlow = ai.defineFlow(
  {
    name: 'voiceToTextFlow',
    inputSchema: VoiceToTextInputSchema,
    outputSchema: VoiceToTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('Transcription failed. Please try again with clearer audio.');
    return output;
  }
);

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  try {
    return await voiceToTextFlow(input);
  } catch (error: any) {
    console.error('Voice transcription failed:', error);
    throw new Error(error.message || 'Failed to transcribe voice note. Ensure microphone quality is good.');
  }
}
