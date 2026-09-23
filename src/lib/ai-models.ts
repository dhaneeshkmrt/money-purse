/**
 * Supported and experimental AI model configurations for Google Gemini.
 */
export interface AIModelOption {
  value: string;
  label: string;
  description?: string;
  isNew?: boolean;
}

export const GEMINI_MODELS: AIModelOption[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Default & Recommended)', description: 'Fast, stable & highly accurate multimodal model', isNew: true },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: 'Fast next-gen flash model', isNew: true },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', description: 'Next-gen multimodal reasoning model', isNew: true },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: 'Next-gen flash model' },
  { value: 'custom', label: 'Custom Model ID', description: 'Enter any custom or future model ID' },
];

export const DEFAULT_AI_MODEL = 'gemini-2.5-flash';

// Retired or shut-down models mapped to their best active replacement
const RETIRED_MODELS_MAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash',
};

/**
 * Normalizes an AI model ID, converting retired/deprecated model names to their
 * current active equivalents.
 */
export function normalizeAiModel(model?: string | null): string {
  if (!model) return DEFAULT_AI_MODEL;
  if (RETIRED_MODELS_MAP[model]) {
    return RETIRED_MODELS_MAP[model];
  }
  return model;
}

