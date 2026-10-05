import type { ConversationResponse, OwnerTurnFeedback } from '@jarvis/contracts';

const feedbackPhrases: readonly [OwnerTurnFeedback['category'], string, RegExp][] = [
  [
    'brevity',
    'shorter',
    /^(?:too long|be shorter|keep it short|shorter please|çok uzun|daha kısa(?: yaz| cevap ver)?|kısa cevap ver|bro keep it short|abi kısa yaz)$/u,
  ],
  ['tone', 'natural', /^(?:too robotic|you sound robotic|çok robotik|robot gibi konuşuyorsun)$/u],
  ['tone', 'respectful', /^(?:don['’]t talk to me like that|benimle böyle konuşma)$/u],
  [
    'challenge',
    'challenge_more',
    /^(?:you should(?:['’]ve| have) challenged me|bana karşı çıkmalıydın|beni zorlamalıydın)$/u,
  ],
  [
    'positive',
    'retain_this_approach',
    /^(?:that was good|that helped|good answer|bu iyiydi|iyi cevap|bu yardımcı oldu)$/u,
  ],
  ['meaning', 'correct_meaning', /^(?:you misunderstood me|beni yanlış anladın)$/u],
];

/** Whole owner turns only. Quoted/reported commands never select a style or activate a rule. */
export function detectOwnerTurnFeedback(message: string): OwnerTurnFeedback | null {
  const quote = message.trim();
  if (!quote || quote.length > 1_000) return null;
  const normalized = quote
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\u0307/gu, '')
    .replace(/[.!?]+$/u, '')
    .trim();
  const mode =
    /^(?:switch to |use |geç: )?(default|friday|mentor)(?: mode| moduna geç| modu)?$/u.exec(
      normalized,
    );
  if (mode)
    return { category: 'mode', scope: 'explicit_owner_preference', directive: mode[1]!, quote };
  const rule = /^(?:constitution rule|constitution proposal|anayasa önerisi):\s*(.{1,800})$/u.exec(
    normalized,
  );
  if (rule)
    return { category: 'rule', scope: 'constitution_candidate', directive: rule[1]!, quote };
  const explicit =
    /^(?:from now on[, :] *|always |my preference is[: ]+|bundan sonra[, :] *|her zaman )(.+)$/u.exec(
      normalized,
    );
  const text = explicit?.[1] ?? normalized;
  if (explicit) {
    const preferences: readonly [OwnerTurnFeedback['category'], string, RegExp][] = [
      [
        'brevity',
        'shorter',
        /^(?:be shorter|keep (?:it|replies|your replies) short|daha kısa(?: yaz| cevap ver)?|kısa cevap ver)$/u,
      ],
      ['tone', 'natural', /^(?:use a natural tone|sound more natural|daha doğal konuş)$/u],
      ['tone', 'respectful', /^(?:be respectful|saygılı konuş)$/u],
      ['challenge', 'challenge_more', /^(?:challenge me more|beni daha fazla zorla)$/u],
    ];
    for (const [category, directive, pattern] of preferences)
      if (pattern.test(text)) {
        return { category, directive, scope: 'explicit_owner_preference', quote };
      }
  }
  for (const [category, directive, pattern] of feedbackPhrases) {
    if (pattern.test(text)) {
      return {
        category,
        scope: 'one_turn',
        directive,
        quote,
      };
    }
  }
  if (/^(?:i meant |demek istediğim |kastettiğim )\S/u.test(normalized)) {
    return { category: 'meaning', scope: 'one_turn', directive: 'correct_meaning', quote };
  }
  return null;
}

export function feedbackInstruction(feedback: OwnerTurnFeedback): string {
  if (feedback.scope === 'constitution_candidate')
    return 'Record this as a draft for owner review only; no constitution or policy changed.';
  if (feedback.category === 'meaning')
    return 'Correct the interpretation of the preceding completed turn. Use the supplied meaning; ask one question only if the intended meaning remains missing. Do not claim an action.';
  if (feedback.scope === 'one_turn')
    return 'Apply this correction to this reply only. Do not claim a permanent preference or personality change. Positive feedback records what helped without inventing a universal rule.';
  if (feedback.category === 'mode')
    return 'Acknowledge the explicit presentation mode briefly. Default balances continuity; Friday stays concise; mentor explains when useful. Memory, commitments, tools, policy and authority are identical. EDITH is disabled.';
  return 'Acknowledge the owner’s explicit communication preference briefly. It affects presentation only; no constitution, commitment, policy or authority changed.';
}

/** A correction receipt cannot fabricate an action or silently activate a lasting rule. */
export function ownerFeedbackReceipt(feedback: OwnerTurnFeedback): ConversationResponse {
  const turkish = /[çğıöşü]|\b(?:bundan|beni|kısa|bu|daha|demek|kastettiğim)\b/iu.test(
    feedback.quote,
  );
  let message: string;
  if (feedback.scope === 'constitution_candidate')
    message = turkish ? 'İncelemek üzere taslak olarak kaydettim.' : 'Saved as a draft for review.';
  else if (feedback.category === 'mode') {
    message = turkish
      ? `${feedback.directive} modu.`
      : `${feedback.directive === 'default' ? 'Back to default' : feedback.directive === 'mentor' ? 'Mentor mode' : 'Friday mode'}.`;
  } else if (feedback.scope === 'explicit_owner_preference') {
    message =
      feedback.directive === 'shorter'
        ? turkish
          ? 'Bundan sonra daha kısa cevap vereceğim.'
          : 'I’ll keep my replies shorter.'
        : feedback.directive === 'natural'
          ? turkish
            ? 'Daha doğal konuşacağım.'
            : 'I’ll keep the tone more natural.'
          : feedback.directive === 'respectful'
            ? turkish
              ? 'Üslubumu saygılı tutacağım.'
              : 'I’ll keep the tone respectful.'
            : turkish
              ? 'Gerektiğinde sana daha net karşı çıkacağım.'
              : 'I’ll challenge you more clearly when it matters.';
  } else if (feedback.category === 'meaning') {
    const meaning = /^(?:i meant |demek istediğim |kastettiğim )(.+)$/iu.exec(
      feedback.quote.trim(),
    )?.[1];
    message = meaning
      ? turkish
        ? `Anladım: ${meaning}`
        : `Got it: ${meaning}`
      : turkish
        ? 'Ne demek istediğini söyler misin?'
        : 'What did you mean?';
  } else if (feedback.category === 'positive')
    message = turkish ? 'İyi, işe yaramasına sevindim.' : 'Glad that helped.';
  else if (feedback.category === 'brevity')
    message = turkish ? 'Tamam, bu yanıtı kısa tutacağım.' : 'Fair. I’ll keep this reply short.';
  else if (feedback.category === 'challenge')
    message = turkish
      ? 'Haklısın, o tercihi sorgulamalıydım.'
      : 'Fair. I should have challenged that choice.';
  else
    message = turkish
      ? 'Anladım, bu yanıtta üslubumu düzelteceğim.'
      : 'Understood. I’ll adjust the tone for this reply.';
  return { message, nextAction: null, tone: 'neutral' };
}
