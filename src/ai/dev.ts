import { config } from 'dotenv';
config();

import '@/ai/flows/categorize-transaction.ts';
import '@/ai/flows/generate-image-flow.ts';
import '@/ai/flows/extract-insurance-details.ts';
import '@/ai/flows/process-voice-transaction.ts';
