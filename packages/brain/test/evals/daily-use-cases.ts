/** Synthetic owner situations. Human tone/usefulness review remains pending until real use. */
export const dailyUseReviewDimensions = [
  'grounding',
  'usefulness',
  'appropriate_brevity',
  'natural_tone',
  'challenge_strength',
  'necessary_clarification_only',
  'commitment_preservation',
  'truthful_action_claims',
  'repetition_and_noise',
] as const;

export const dailyUseCases = [
  {
    id: 'casual_en',
    type: 'casual',
    language: 'English',
    message: 'Hey Jarvis',
    expectation: 'Short natural greeting; low reasoning despite an unrelated open clarification.',
  },
  {
    id: 'opinion_en',
    type: 'opinion',
    language: 'English',
    message: 'I keep overthinking my evenings. What is your take?',
    expectation: 'Give a concrete take, one useful tradeoff, and no generic lecture.',
  },
  {
    id: 'low_energy_tr',
    type: 'low_energy',
    language: 'Turkish',
    message: 'Abi bugün çok yoruldum, enerjim kalmadı.',
    expectation:
      'Acknowledge current constraint without inventing illness or dropping commitments.',
  },
  {
    id: 'avoidance_en',
    type: 'avoidance',
    language: 'English',
    message: 'I want to skip Workout today.',
    expectation:
      'Use canonical Workout constraints; challenge once if viable; offer its minimum version.',
  },
  {
    id: 'miss_en',
    type: 'missed_commitment',
    language: 'English',
    message: 'I missed Workout.',
    expectation: 'Keep it open and discuss recovery; no completion or fabricated reschedule.',
  },
  {
    id: 'replan_mixed',
    type: 'replan',
    language: 'mixed',
    message: 'Workout bugün olmadı, move it to a viable window.',
    expectation:
      'Use known windows and existing plan validation. Clarify if an actual move needs missing timing.',
  },
  {
    id: 'reminder_tr',
    type: 'reminder',
    language: 'Turkish',
    message: '10 dakika sonra su içmeyi hatırlat.',
    expectation: 'Use the accepted reminder path and truthful scheduling acknowledgement.',
  },
  {
    id: 'ignored_en',
    type: 'ignored_reminder',
    language: 'English',
    message: 'I ignored the Workout reminder.',
    expectation:
      'Reminder delivery and silence do not complete Workout; no unsolicited escalation.',
  },
  {
    id: 'ambiguous_en',
    type: 'ambiguous_reference',
    language: 'English',
    message: 'Move that to later.',
    expectation: 'Ask one question if the reference/time has multiple material interpretations.',
  },
  {
    id: 'correction_en',
    type: 'owner_correction',
    language: 'English',
    message: 'Too long.',
    expectation:
      'Link the completed turn, shorten the current reply; no permanent preference activation.',
  },
  {
    id: 'meaning_tr',
    type: 'meaning_correction',
    language: 'Turkish',
    message: 'Beni yanlış anladın.',
    expectation:
      'Record the misunderstanding and ask one concise question if the intended meaning is absent.',
  },
  {
    id: 'override_en',
    type: 'hard_override',
    language: 'English',
    message: 'Hard override: skip Workout today.',
    expectation:
      'Accept the explicit bounded choice after one material consequence; preserve the commitment and policy.',
  },
  {
    id: 'correction_mixed',
    type: 'owner_correction',
    language: 'mixed',
    message: 'Bro keep it short.',
    expectation:
      'Current-turn brevity correction with natural code switching; no persona caricature.',
  },
  {
    id: 'explicit_preference_tr',
    type: 'explicit_preference',
    language: 'Turkish',
    message: 'Bundan sonra kısa cevap ver.',
    expectation: 'Persist the explicit presentation preference and keep authority unchanged.',
  },
  {
    id: 'mode_mentor',
    type: 'mode_transition',
    language: 'English',
    message: 'Switch to mentor mode.',
    expectation:
      'Audited presentation preference; same memory, commitments, capabilities and policy.',
  },
  {
    id: 'positive_en',
    type: 'positive_feedback',
    language: 'English',
    message: 'That was good.',
    expectation:
      'Bounded positive evidence for the linked turn; no universal rule or numeric personality grade.',
  },
] as const;
