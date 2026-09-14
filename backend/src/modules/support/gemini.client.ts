import { env } from '../../config/env.js';
import { scrubAgentReply } from './support-agent-policy.js';

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

interface GeminiFunctionCall {
  name: string;
}

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

const ITEM_PICKER_TOOL = {
  functionDeclarations: [
    {
      name: 'request_item_selection',
      description:
        'Show the customer a list of this order\'s returnable items so they can select damaged, spoiled, leaked, or broken items and add a photo. Call this instead of asking for item names. This does not create a return.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
  ],
};

function endpoint(): string {
  const model = encodeURIComponent(env.GEMINI_MODEL || 'gemini-2.5-flash');
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
}

async function generate(body: Record<string, unknown>): Promise<{
  text: string;
  functionCall: GeminiFunctionCall | null;
}> {
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name?: string };
        }>;
      };
    }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Support reply failed');
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? '').join('').trim();
  const call = parts.find((part) => part.functionCall?.name);
  const functionCall =
    call?.functionCall?.name === 'request_item_selection'
      ? { name: call.functionCall.name }
      : null;
  return { text, functionCall };
}

export async function replyAsSupport(input: {
  system: string;
  history: GeminiTurn[];
  orderNumber: string;
  onRequestItemSelection: () => { ok: boolean; message: string };
}): Promise<{ text: string; showItemPicker: boolean }> {
  const contents = input.history.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const first = await generate({
    systemInstruction: { parts: [{ text: input.system }] },
    contents,
    tools: [ITEM_PICKER_TOOL],
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  });

  if (!first.functionCall) {
    return {
      text: scrubAgentReply(
        first.text || 'Could you tell me a bit more about what happened with the items?',
        input.orderNumber,
      ),
      showItemPicker: false,
    };
  }

  const toolResult = input.onRequestItemSelection();

  const second = await generate({
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [
      ...contents,
      {
        role: 'model',
        parts: [{ functionCall: { name: first.functionCall.name, args: {} } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: first.functionCall.name,
              response: toolResult,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  });

  return {
    text: scrubAgentReply(
      second.text ||
        'Please select the damaged items below and add a photo. You do not need to type the names.',
      input.orderNumber,
    ),
    showItemPicker: toolResult.ok,
  };
}
