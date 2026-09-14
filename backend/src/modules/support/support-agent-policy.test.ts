import { describe, expect, it } from 'vitest';
import {
  buildSupportSystemPrompt,
  resolveItemAliases,
  scrubAgentReply,
} from './support-agent-policy.js';

describe('support agent policy', () => {
  it('refuses replies that mention another order or a model', () => {
    expect(scrubAgentReply('I am a Gemini model', 'DF20260908-000001')).toContain('only help with this order');
    expect(scrubAgentReply('Your other order DF20260101-999999 is ready', 'DF20260908-000001')).toContain(
      'only help with this order',
    );
  });

  it('keeps a normal reply about this order', () => {
    const reply = scrubAgentReply('I can help with order DF20260908-000001.', 'DF20260908-000001');
    expect(reply).toContain('DF20260908-000001');
  });

  it('maps only aliases from this order', () => {
    const aliases = [{ alias: 'item_1', orderItemId: 'item-real', quantity: 2 }];
    expect(resolveItemAliases(aliases, [{ orderItemId: 'item_1', quantity: 1 }])).toEqual([
      { orderItemId: 'item-real', quantity: 1, note: undefined },
    ]);
    expect(() => resolveItemAliases(aliases, [{ orderItemId: 'someone-elses-item', quantity: 1 }])).toThrow();
  });

  it('does not put internal ids in the system prompt', () => {
    const prompt = buildSupportSystemPrompt({
      orderNumber: 'DF20260908-000001',
      itemLines: '- item_1: Milk (1L), quantity 1',
      returnStatus: null,
    });
    expect(prompt).toContain('signed-in customer');
    expect(prompt).toContain('Local shop items are prepaid only');
    expect(prompt).toContain('request_item_selection');
    expect(prompt).toContain('Never ask the customer to type item names');
    expect(prompt).not.toContain('raise_return_request');
    expect(prompt).not.toContain('item-real');
  });
});
