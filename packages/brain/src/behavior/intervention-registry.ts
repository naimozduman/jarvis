export interface InterventionDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly purpose: string;
  readonly triggerConditions: readonly string[];
  readonly contraindications: readonly string[];
  readonly requiredContext: readonly string[];
  readonly example: string;
  readonly cooldownMinutes: number;
  readonly successSignal: string;
  readonly failureSignal: string;
  readonly cost: string;
  readonly applicableDomains: readonly string[];
}

function definition(
  id: string,
  name: string,
  purpose: string,
  example: string,
  domains: readonly string[],
  cooldownMinutes = 240,
): InterventionDefinition {
  return {
    id,
    name,
    version: '1.0.0',
    purpose,
    triggerConditions: ['a meaningful commitment is open', 'the tactic matches available context'],
    contraindications: [
      'active quiet mode for noncritical outreach',
      'same intervention is in cooldown',
    ],
    requiredContext: ['commitment', 'available time', 'known constraints'],
    example,
    cooldownMinutes,
    successSignal: 'A concrete next action is started or completed.',
    failureSignal: 'No progress occurs before the next review point.',
    cost: 'Low-friction behavioral tactic; correlation is not treated as causation.',
    applicableDomains: domains,
  };
}

/** Static, reviewable tactic library. The model selects an ID; it never invents clinical claims. */
export const seededInterventions: readonly InterventionDefinition[] = [
  definition(
    'implementation-intention',
    'Implementation intention',
    'Convert intent into an if-then cue.',
    'If it is 6 PM, put on running shoes and leave the door.',
    ['training', 'work'],
  ),
  definition(
    'minimum-viable-action',
    'Minimum viable action',
    'Lower the action to the smallest meaningful version.',
    'Do a 10-minute walk rather than delete today’s movement.',
    ['training', 'work', 'school'],
  ),
  definition(
    'environment-preparation',
    'Environment preparation',
    'Prepare the environment before the decision point.',
    'Lay out gym clothes before sleep.',
    ['training', 'sleep'],
  ),
  definition(
    'friction-reduction',
    'Friction reduction',
    'Remove a practical barrier to starting.',
    'Open the assignment and write the first heading.',
    ['work', 'school'],
  ),
  definition(
    'choice-reduction',
    'Choice reduction',
    'Reduce options when indecision blocks action.',
    'Choose one of two preselected dinner options.',
    ['work', 'training', 'food'],
  ),
  definition(
    'precommitment',
    'Precommitment',
    'Make the desired future action easier to keep.',
    'Book a focused hour and silence noncritical notifications.',
    ['work', 'school'],
  ),
  definition(
    'temptation-bundling',
    'Temptation bundling',
    'Pair a wanted activity with a needed action.',
    'Save the podcast for the walk.',
    ['training'],
  ),
  definition(
    'time-boxing',
    'Time boxing',
    'Constrain a task to a finite startable interval.',
    'Work for 25 minutes, then reassess.',
    ['work', 'school'],
  ),
  definition(
    'deadline-compression',
    'Deadline compression',
    'Use an earlier internal checkpoint for a hard deadline.',
    'Finish the draft by 4 PM for a 6 PM due time.',
    ['work', 'school'],
  ),
  definition(
    'identity-framing',
    'Identity-based framing',
    'Frame a next action as consistent with a chosen identity.',
    'Act like someone who protects their training commitment.',
    ['training', 'work'],
  ),
  definition(
    'future-self-framing',
    'Future-self framing',
    'Make a later consequence concrete without shaming.',
    'Tomorrow morning is easier if the bag is packed now.',
    ['sleep', 'work'],
  ),
  definition(
    'recovery-after-lapse',
    'Recovery after lapse',
    'Resume after a miss without abandoning the goal.',
    'Protect a minimum session tomorrow instead of declaring the week lost.',
    ['training', 'work'],
  ),
  definition(
    'task-decomposition',
    'Task decomposition',
    'Break an ambiguous task into physical next steps.',
    'Open the document, list sources, then draft the first paragraph.',
    ['work', 'school'],
  ),
  definition(
    'starting-ritual',
    'Starting ritual',
    'Use a consistent cue to enter a task.',
    'Make tea, open the timer, start the first task.',
    ['work', 'school'],
  ),
  definition(
    'commitment-protection',
    'Commitment protection',
    'Defend an important block against low-value displacement.',
    'Keep the protected study hour and move the optional errand.',
    ['work', 'school', 'training'],
  ),
  definition(
    'if-then-planning',
    'If-then planning',
    'Specify a contingency for a predictable disruption.',
    'If work runs late, do the 20-minute home session.',
    ['training', 'work'],
  ),
  definition(
    'reduce-activation-energy',
    'Reduce activation energy',
    'Make the next step physically easier to begin.',
    'Put the laptop on the desk and open the tab now.',
    ['work', 'school'],
  ),
  definition(
    'progress-visibility',
    'Progress visibility',
    'Make completed progress visible.',
    'Check off the first completed subtask.',
    ['work', 'school', 'training'],
  ),
  definition(
    'streak-protection',
    'Streak protection without streak obsession',
    'Protect continuity without treating one lapse as failure.',
    'Use a minimum session to preserve momentum, not perfection.',
    ['training'],
  ),
  definition(
    'default-action-design',
    'Default action design',
    'Preselect the safest helpful action for a common situation.',
    'At 9 PM, default to preparing tomorrow’s essentials.',
    ['sleep', 'work'],
  ),
  definition(
    'scheduled-decision-point',
    'Scheduled decision point',
    'Delay a nonurgent decision to a specific review point.',
    'Revisit the uncertain purchase next Tuesday.',
    ['finance', 'work'],
  ),
  definition(
    'bounded-choice',
    'Bounded choice',
    'Offer a small set of valid alternatives.',
    'Choose gym at 5 PM or a home session at 8 PM.',
    ['training', 'work'],
  ),
  definition(
    'preparation-reminder',
    'Preparation reminder',
    'Prompt preparation before a commitment.',
    'Pack the bag two hours before training.',
    ['training', 'work'],
  ),
  definition(
    'consequence-reminder',
    'Consequence reminder',
    'State a material consequence plainly and once.',
    'Missing the draft checkpoint leaves less review time tomorrow.',
    ['work', 'school'],
  ),
  definition(
    'next-physical-action',
    'Specific next physical action',
    'Name a concrete action that can start now.',
    'Stand up, fill the water bottle, and put on shoes.',
    ['training', 'work', 'school'],
    90,
  ),
];

export interface InterventionRunHistory {
  readonly interventionId: string;
  readonly contextKey: string;
  readonly cooldownUntil: string | null;
}

export class InterventionRegistry {
  public constructor(
    private readonly definitions: readonly InterventionDefinition[] = seededInterventions,
  ) {}

  public get(interventionId: string): InterventionDefinition | undefined {
    return this.definitions.find((item) => item.id === interventionId);
  }

  public applicable(domain: string): readonly InterventionDefinition[] {
    return this.definitions.filter((item) => item.applicableDomains.includes(domain));
  }

  public canRun(input: {
    readonly interventionId: string;
    readonly now: string;
    readonly history: readonly InterventionRunHistory[];
  }): boolean {
    const definition = this.get(input.interventionId);
    if (!definition) {
      return false;
    }
    const now = Date.parse(input.now);
    return input.history.every(
      (entry) =>
        entry.interventionId !== input.interventionId ||
        !entry.cooldownUntil ||
        Date.parse(entry.cooldownUntil) <= now,
    );
  }
}

export interface InterventionOutcome {
  readonly ownerId: string;
  readonly interventionRunId: string;
  readonly outcome: 'started' | 'completed' | 'not_started' | 'declined' | 'unknown';
  readonly observedAt: string;
  readonly contextKey: string;
  readonly note: string | null;
}

/** The aggregate is descriptive only; no method claims that an intervention caused an outcome. */
export function summarizeInterventionOutcomes(outcomes: readonly InterventionOutcome[]): {
  readonly observedCount: number;
  readonly completedCount: number;
  readonly note: string;
} {
  return {
    observedCount: outcomes.length,
    completedCount: outcomes.filter((outcome) => outcome.outcome === 'completed').length,
    note: 'Observed association only; this summary does not establish causation or clinical efficacy.',
  };
}
