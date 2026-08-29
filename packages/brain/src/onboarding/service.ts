import { randomUUID } from 'node:crypto';

import type { OnboardingAnswer, OnboardingQuestion, OnboardingSection } from '@jarvis/contracts';

export interface OnboardingQuestionnaire {
  readonly id: string;
  readonly ownerId: string;
  readonly version: string;
  readonly state: 'draft' | 'in_review' | 'accepted' | 'rejected';
  readonly questions: readonly OnboardingQuestion[];
  readonly createdAt: string;
  readonly reviewedAt: string | null;
}

export interface OnboardingRepository {
  saveQuestionnaire(questionnaire: OnboardingQuestionnaire): Promise<void>;
  findQuestionnaire(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
  }): Promise<OnboardingQuestionnaire | undefined>;
  saveAnswer(answer: OnboardingAnswer & { readonly questionnaireId: string }): Promise<void>;
  listAnswers(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
  }): Promise<readonly (OnboardingAnswer & { readonly questionnaireId: string })[]>;
}

export const onboardingQuestions: readonly OnboardingQuestion[] = [
  {
    id: 'identity.timezone',
    section: 'identity',
    prompt: 'What timezone should JARVIS use?',
    required: true,
    reviewRequired: true,
  },
  {
    id: 'constitution.values',
    section: 'constitution',
    prompt: 'Which values or commitments should JARVIS protect?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'sleep.preferences',
    section: 'timezone_and_sleep',
    prompt: 'What sleep constraints or preferences matter?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'work.commitments',
    section: 'work_and_school',
    prompt: 'What work or school commitments are recurring?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'training.goals',
    section: 'training_and_health',
    prompt: 'What training goals should be tracked?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'finance.rules',
    section: 'finance_rules',
    prompt: 'What financial boundaries should JARVIS remember? Do not provide account secrets.',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'relationships.boundaries',
    section: 'relationships',
    prompt: 'Which relationship boundaries matter?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'communication.style',
    section: 'communication',
    prompt: 'How should JARVIS communicate?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'recurring.responsibilities',
    section: 'recurring_responsibilities',
    prompt: 'What recurring responsibilities should be reviewed?',
    required: false,
    reviewRequired: true,
  },
  {
    id: 'prohibitions',
    section: 'hard_prohibitions',
    prompt: 'What actions must JARVIS never suggest or perform?',
    required: false,
    reviewRequired: true,
  },
];

export class OnboardingService {
  public constructor(private readonly repository: OnboardingRepository) {}

  public async createQuestionnaire(input: {
    readonly ownerId: string;
    readonly version?: string;
    readonly questions?: readonly OnboardingQuestion[];
  }): Promise<OnboardingQuestionnaire> {
    const questionnaire: OnboardingQuestionnaire = {
      id: randomUUID(),
      ownerId: input.ownerId,
      version: input.version ?? 'phase2-v1',
      state: 'draft',
      questions: input.questions ?? onboardingQuestions,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    await this.repository.saveQuestionnaire(questionnaire);
    return questionnaire;
  }

  public async saveOwnerAnswer(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
    readonly questionId: string;
    readonly value: string | null;
    readonly source: 'owner_input' | 'import';
  }): Promise<OnboardingAnswer & { readonly questionnaireId: string }> {
    const questionnaire = await this.requireQuestionnaire(input.ownerId, input.questionnaireId);
    if (!questionnaire.questions.some((question) => question.id === input.questionId)) {
      throw new Error('The answer does not belong to the requested onboarding questionnaire.');
    }
    const now = new Date().toISOString();
    const answer = {
      id: randomUUID(),
      ownerId: input.ownerId,
      questionnaireId: input.questionnaireId,
      questionId: input.questionId,
      state: 'draft' as const,
      value: input.value,
      source: input.source,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveAnswer(answer);
    return answer;
  }

  public async reviewAnswer(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
    readonly answerId: string;
    readonly accepted: boolean;
  }): Promise<void> {
    const answers = await this.repository.listAnswers({
      ownerId: input.ownerId,
      questionnaireId: input.questionnaireId,
    });
    const answer = answers.find((item) => item.id === input.answerId);
    if (!answer) {
      throw new Error('The requested onboarding answer does not exist for this owner.');
    }
    await this.repository.saveAnswer({
      ...answer,
      state: input.accepted ? 'accepted' : 'rejected',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  public async markQuestionnaireReviewed(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
    readonly accepted: boolean;
  }): Promise<OnboardingQuestionnaire> {
    const questionnaire = await this.requireQuestionnaire(input.ownerId, input.questionnaireId);
    const updated: OnboardingQuestionnaire = {
      ...questionnaire,
      state: input.accepted ? 'accepted' : 'rejected',
      reviewedAt: new Date().toISOString(),
    };
    await this.repository.saveQuestionnaire(updated);
    return updated;
  }

  public sections(questionnaire: OnboardingQuestionnaire): readonly OnboardingSection[] {
    return [...new Set(questionnaire.questions.map((question) => question.section))];
  }

  private async requireQuestionnaire(
    ownerId: string,
    questionnaireId: string,
  ): Promise<OnboardingQuestionnaire> {
    const questionnaire = await this.repository.findQuestionnaire({ ownerId, questionnaireId });
    if (!questionnaire) {
      throw new Error('The requested onboarding questionnaire does not exist for this owner.');
    }
    return questionnaire;
  }
}

export class InMemoryOnboardingRepository implements OnboardingRepository {
  private readonly questionnaires = new Map<string, OnboardingQuestionnaire>();
  private readonly answers = new Map<
    string,
    OnboardingAnswer & { readonly questionnaireId: string }
  >();
  public async saveQuestionnaire(questionnaire: OnboardingQuestionnaire): Promise<void> {
    this.questionnaires.set(questionnaire.id, questionnaire);
  }
  public async findQuestionnaire(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
  }): Promise<OnboardingQuestionnaire | undefined> {
    const questionnaire = this.questionnaires.get(input.questionnaireId);
    return questionnaire?.ownerId === input.ownerId ? questionnaire : undefined;
  }
  public async saveAnswer(
    answer: OnboardingAnswer & { readonly questionnaireId: string },
  ): Promise<void> {
    this.answers.set(answer.id, answer);
  }
  public async listAnswers(input: {
    readonly ownerId: string;
    readonly questionnaireId: string;
  }): Promise<readonly (OnboardingAnswer & { readonly questionnaireId: string })[]> {
    return [...this.answers.values()].filter(
      (answer) =>
        answer.ownerId === input.ownerId && answer.questionnaireId === input.questionnaireId,
    );
  }
}
