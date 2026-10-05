import { createHmac, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ContextAssembler,
  ConversationTurnService,
  FakeModelGateway,
  InMemoryInterventionRepository,
  InterventionService,
  PromptAssembler,
} from '@jarvis/brain';
import { buildApi } from '@jarvis/api';
import { initialJobDispatchGeneration } from '@jarvis/contracts';
import type {
  BrainRequest,
  ClarificationRequest,
  ContextManifest,
  ContextRecord,
  ConversationResponse,
  MessagingConnectionStatus,
  MessagingSendResult,
  MessagingTransport,
  ModelRun,
  NormalizedDeliveryUpdate,
  NormalizedInboundMessage,
  OutboundDeliveryIntent,
  PlanProposal,
  ReminderProposal,
} from '@jarvis/contracts';
import type {
  BrainRepository,
  PersistedBrainDecision,
  PersistedConversationResponse,
  PersistedInboundConversationMessage,
  PersistedOutboundDelivery,
  PersistedTransportMessage,
  TransportStateRepository,
} from '@jarvis/database';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import {
  EvolutionMessageMapper,
  EvolutionOwnerIdentityResolver,
  EvolutionWebhookParser,
  EvolutionWebhookVerifier,
  ownerTargetReference,
} from '@jarvis/integrations-evolution';
import { evaluateOwnerTransportDelivery, evaluatePolicy } from '@jarvis/security';
import { InMemoryEventStore } from '@jarvis/testing';
import { TransportEventProcessor, TransportOutboundWorker } from '@jarvis/worker';

const ownerId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const correlationId = '00000000-0000-4000-8000-000000000003';
const dayPlanId = '00000000-0000-4000-8000-000000000004';
const now = '2026-08-29T12:00:00.000Z';
const instanceName = 'jarvis-test-instance';
const ownerPhone = '15551234567';
const testSigningMaterial = 'phase3-test-signing-material-not-a-deployment-credential';

function signedWebhookToken(): string {
  const timestamp = Math.floor(new Date(now).getTime() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ app: 'evolution', action: 'webhook', iat: timestamp, exp: timestamp + 600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', testSigningMaterial)
    .update(`${header}.${payload}`, 'utf8')
    .digest('base64url');
  return `Bearer ${header}.${payload}.${signature}`;
}

function ownerTextPayload(): Record<string, unknown> {
  return {
    event: 'MESSAGES_UPSERT',
    instance: instanceName,
    date_time: now,
    data: {
      key: {
        id: 'provider-inbound-001',
        remoteJid: `${ownerPhone}@s.whatsapp.net`,
        fromMe: false,
      },
      message: { conversation: 'Move my gym to tonight.' },
      messageType: 'conversation',
      messageTimestamp: 1_788_000_000,
    },
  };
}

function asPersistedDelivery(
  input: OutboundDeliveryIntent,
  state: PersistedOutboundDelivery['state'],
): PersistedOutboundDelivery {
  return {
    id: input.id,
    ownerId: input.ownerId,
    messageId: input.messageId,
    connectionId: input.connectionId,
    transport: input.transport,
    targetReference: input.targetReference,
    operationKey: input.operationKey,
    state,
    providerMessageReference: null,
    attemptCount: 0,
    requiresReconciliation: false,
    correlationId: input.correlationId,
  };
}

class InMemoryTransportRepository implements TransportStateRepository {
  public readonly inbound = new Map<string, PersistedTransportMessage>();
  public readonly deliveries = new Map<string, PersistedOutboundDelivery>();
  public readonly intents = new Map<string, OutboundDeliveryIntent>();
  public readonly deliveryUpdates: NormalizedDeliveryUpdate[] = [];
  public readonly connectionEvents: Array<{
    readonly state: string;
    readonly sourceEventId: string | null;
  }> = [];
  public readonly rejections: Array<Record<string, unknown>> = [];
  public readonly mediaRequests: Array<Record<string, unknown>> = [];

  public async persistInboundMessage(input: {
    readonly ownerId: string;
    readonly sourceEventId: string;
    readonly correlationId: string;
    readonly messageId: string;
    readonly message: NormalizedInboundMessage;
  }): Promise<PersistedTransportMessage> {
    const existing = this.inbound.get(input.message.providerMessageReference);
    if (existing) return { ...existing, duplicate: true };
    const persisted = {
      id: input.messageId,
      conversationId: '00000000-0000-4000-8000-000000000005',
      duplicate: false,
    } satisfies PersistedTransportMessage;
    this.inbound.set(input.message.providerMessageReference, persisted);
    if (input.message.media) this.mediaRequests.push({ type: input.message.media.mediaType });
    return persisted;
  }

  public async createOrLoadOutboundDelivery(input: OutboundDeliveryIntent): Promise<{
    readonly delivery: PersistedOutboundDelivery;
    readonly duplicate: boolean;
  }> {
    const existing = [...this.deliveries.values()].find(
      (candidate) =>
        candidate.ownerId === input.ownerId && candidate.operationKey === input.operationKey,
    );
    if (existing) return { delivery: existing, duplicate: true };
    const delivery = asPersistedDelivery(input, 'pending');
    this.deliveries.set(delivery.id, delivery);
    this.intents.set(delivery.id, input);
    return { delivery, duplicate: false };
  }

  public async leaseOutboundDelivery(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly leaseExpiresAt: string;
  }): Promise<PersistedOutboundDelivery | undefined> {
    void input.leaseExpiresAt;
    const delivery = this.deliveries.get(input.deliveryId);
    if (
      !delivery ||
      delivery.ownerId !== input.ownerId ||
      !['pending', 'failed_retryable'].includes(delivery.state) ||
      delivery.requiresReconciliation
    ) {
      return undefined;
    }
    const leased = {
      ...delivery,
      state: 'leased' as const,
      attemptCount: delivery.attemptCount + 1,
    };
    this.deliveries.set(leased.id, leased);
    return leased;
  }

  public async recordSendResult(input: {
    readonly ownerId: string;
    readonly deliveryId: string;
    readonly result: MessagingSendResult;
    readonly occurredAt: string;
  }): Promise<PersistedOutboundDelivery> {
    void input.occurredAt;
    const delivery = this.deliveries.get(input.deliveryId);
    if (!delivery || delivery.ownerId !== input.ownerId || delivery.state !== 'leased') {
      throw new Error('Fake outbox rejects a result for an unleased delivery.');
    }
    const state =
      input.result.disposition === 'accepted'
        ? 'sent'
        : input.result.disposition === 'retryable_failure'
          ? 'failed_retryable'
          : 'failed_terminal';
    const updated = {
      ...delivery,
      state,
      providerMessageReference: input.result.providerMessageReference,
      requiresReconciliation: input.result.requiresReconciliation,
    } as PersistedOutboundDelivery;
    this.deliveries.set(updated.id, updated);
    return updated;
  }

  public async applyDeliveryUpdate(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly update: NormalizedDeliveryUpdate;
  }): Promise<PersistedOutboundDelivery | undefined> {
    this.deliveryUpdates.push(input.update);
    const current = [...this.deliveries.values()].find(
      (candidate) =>
        candidate.ownerId === input.ownerId &&
        candidate.connectionId === input.connectionId &&
        candidate.providerMessageReference === input.update.providerMessageReference,
    );
    if (!current) return undefined;
    const updated = { ...current, state: input.update.state };
    this.deliveries.set(updated.id, updated);
    return updated;
  }

  public async recordRejectedTransportEvent(input: {
    readonly ownerId: string;
    readonly transport: string;
    readonly instanceReference: string;
    readonly providerEventReference: string | null;
    readonly senderReference: string | null;
    readonly eventType: string;
    readonly reason: string;
    readonly receivedAt: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    this.rejections.push({ ...input });
  }

  public async recordConnectionState(input: {
    readonly ownerId: string;
    readonly connectionId: string;
    readonly state: string;
    readonly occurredAt: string;
    readonly correlationId: string;
    readonly sourceEventId: string | null;
    readonly safeErrorCategory: string | null;
  }): Promise<void> {
    void input.ownerId;
    void input.connectionId;
    void input.occurredAt;
    void input.correlationId;
    void input.safeErrorCategory;
    this.connectionEvents.push({ state: input.state, sourceEventId: input.sourceEventId });
  }
}

class InMemoryDeliveryOutbox {
  public readonly jobs: OutboundDeliveryIntent[] = [];

  public constructor(private readonly repository: InMemoryTransportRepository) {}

  public async persistAndEnqueue(intent: OutboundDeliveryIntent): Promise<{
    readonly deliveryId: string;
    readonly duplicate: boolean;
  }> {
    const persisted = await this.repository.createOrLoadOutboundDelivery(intent);
    if (!persisted.duplicate) this.jobs.push(intent);
    return { deliveryId: persisted.delivery.id, duplicate: persisted.duplicate };
  }
}

class FakeEvolutionTransport implements MessagingTransport {
  public readonly kind = 'evolution_whatsapp' as const;
  public state: MessagingConnectionStatus['state'] = 'connected';
  public readonly sent: OutboundDeliveryIntent[] = [];
  public nextResult: MessagingSendResult = {
    disposition: 'accepted',
    providerMessageReference: 'evolution-message:4c8f6f263441211b54365a25f4e2bb3d',
    acceptedAt: now,
    errorCategory: null,
    requiresReconciliation: false,
  };

  public async sendText(
    input: Parameters<MessagingTransport['sendText']>[0],
  ): Promise<MessagingSendResult> {
    const intent = fakeIntentFromText(input);
    this.sent.push(intent);
    return this.nextResult;
  }

  public async sendImage(): Promise<MessagingSendResult> {
    return this.nextResult;
  }

  public async sendAudio(): Promise<MessagingSendResult> {
    return this.nextResult;
  }

  public async sendDocument(): Promise<MessagingSendResult> {
    return this.nextResult;
  }

  public async markRead(): Promise<void> {}

  public async getConnectionStatus(input: {
    readonly connectionId: string;
  }): Promise<MessagingConnectionStatus> {
    return {
      transport: 'evolution_whatsapp',
      connectionId: input.connectionId,
      state: this.state,
      readiness: this.state === 'connected' ? 'connected' : 'degraded',
      checkedAt: now,
      safeErrorCategory: this.state === 'connected' ? null : 'connection_closed',
    };
  }
}

function fakeIntentFromText(
  input: Parameters<MessagingTransport['sendText']>[0],
): OutboundDeliveryIntent {
  return {
    id: input.deliveryId,
    ownerId: input.ownerId,
    messageId: input.deliveryId,
    conversationId: '00000000-0000-4000-8000-000000000005',
    connectionId: input.connectionId,
    transport: 'evolution_whatsapp',
    targetReference: input.targetReference,
    operationKey: input.operationKey,
    contentType: 'text',
    content: input.text,
    mediaObjectReference: null,
    sourceEventId: null,
    brainRequestId: null,
    reminderId: null,
    critical: false,
    correlationId: input.correlationId,
    causationId: input.causationId,
    createdAt: now,
  };
}

class MinimalBrainRepository implements BrainRepository {
  public readonly requests = new Map<string, BrainRequest>();
  public readonly responses: PersistedConversationResponse[] = [];
  public readonly planProposals: PlanProposal[] = [];
  public readonly decisions: PersistedBrainDecision[] = [];
  public readonly inbound: PersistedInboundConversationMessage[] = [];
  public readonly modelRuns: ModelRun[] = [];

  public async beginOrLoadRequest(request: BrainRequest) {
    const key = `${request.ownerId}:${request.idempotencyKey}`;
    const existing = this.requests.get(key);
    if (existing) return { request: existing, duplicate: true };
    this.requests.set(key, request);
    return { request, duplicate: false };
  }

  public async updateRequestState(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly state: BrainRequest['state'];
  }): Promise<void> {
    for (const [key, request] of this.requests) {
      if (request.ownerId === input.ownerId && request.id === input.requestId) {
        this.requests.set(key, { ...request, state: input.state });
      }
    }
  }

  public async persistContextManifest(manifest: ContextManifest): Promise<void> {
    void manifest;
  }
  public async persistModelRun(run: ModelRun): Promise<void> {
    this.modelRuns.push(run);
  }
  public async persistDecision(input: PersistedBrainDecision): Promise<void> {
    this.decisions.push(input);
  }
  public async persistMemoryCandidate(): Promise<void> {}
  public async persistConstitutionCandidate(): Promise<void> {}
  public async persistPlanProposal(input: {
    readonly proposal: PlanProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void> {
    void input.sourceBrainDecisionId;
    void input.correlationId;
    this.planProposals.push(input.proposal);
  }
  public async persistReminderProposal(input: {
    readonly proposal: ReminderProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void> {
    void input;
  }
  public async persistClarification(input: {
    readonly ownerId: string;
    readonly brainRequestId: string;
    readonly clarification: ClarificationRequest;
    readonly correlationId: string;
  }): Promise<void> {
    void input;
  }
  public async persistInboundMessage(input: PersistedInboundConversationMessage): Promise<void> {
    if (!this.inbound.some((message) => message.id === input.id)) this.inbound.push(input);
  }
  public async persistConversationResponse(input: PersistedConversationResponse): Promise<void> {
    this.responses.push(input);
  }
  public async getConversationResponse(input: {
    readonly ownerId: string;
    readonly responseMessageId: string;
  }): Promise<{ readonly id: string; readonly response: ConversationResponse } | undefined> {
    const response = this.responses.find(
      (candidate) =>
        candidate.ownerId === input.ownerId && candidate.id === input.responseMessageId,
    );
    return response ? { id: response.id, response: response.response } : undefined;
  }
  public async updateDecisionExecutionResult(): Promise<void> {}
  public async getDecisionForRequest(input: {
    readonly ownerId: string;
    readonly requestId: string;
  }): Promise<{ readonly id: string; readonly decisionType: string } | undefined> {
    const decision = this.decisions.find(
      (candidate) =>
        candidate.ownerId === input.ownerId && candidate.brainRequestId === input.requestId,
    );
    return decision ? { id: decision.id, decisionType: decision.decision.decisionType } : undefined;
  }
  public async listContextRecords(input: {
    readonly ownerId: string;
    readonly conversationId: string | null;
    readonly maximumRecentMessages: number;
  }): Promise<readonly ContextRecord[]> {
    void input;
    return [];
  }
}

function modelDecision(): Record<string, unknown> {
  return {
    decisionType: 'replan',
    conversationResponse: {
      message: 'Gym is moved to tonight. I kept the commitment open until you complete it.',
      nextAction: 'Go tonight and tell me when it is done.',
      tone: 'direct',
    },
    reasoningSummary: {
      decisionSummary: 'A later flexible training window preserves the owner commitment.',
      importantEvidenceIds: [],
      materialTradeoffs: ['The evening window reduces flexibility but retains today’s workout.'],
      confidenceBasisPoints: 8_500,
      missingInformation: [],
    },
    evidence: [],
    clarification: null,
    proposedActions: [
      {
        actionType: 'internal.plan.update',
        riskClass: 'LOW_RISK_INTERNAL',
        targetRecordId: null,
        title: null,
        scheduledFor: null,
        completionEvidenceId: null,
        planProposalReference: 'tonight-training-window',
        rationale: 'Use the server-validated flexible plan proposal.',
        evidenceIds: [],
      },
    ],
    memoryCandidates: [],
    planProposal: {
      dayPlanId,
      trigger: 'free_time_opening',
      operations: [],
      newFlexibleBlocks: [
        { title: 'Gym', startsAt: '2026-08-29T19:00:00.000Z', endsAt: '2026-08-29T20:00:00.000Z' },
      ],
      tradeoffs: ['A later workout leaves less evening flexibility.'],
    },
    reminderProposal: null,
    interventionProposal: null,
  };
}

function createBrainHarness() {
  const repository = new MinimalBrainRepository();
  const model = new FakeModelGateway([{ kind: 'decision', decision: modelDecision() }]);
  const actionStore = new InMemoryEventStore();
  const service = new ConversationTurnService({
    repository,
    gateway: model,
    contextAssembler: new ContextAssembler({
      maxContextRecords: 16,
      maxRecentMessages: 8,
      maxApproxPromptTokens: 4_000,
    }),
    promptAssembler: new PromptAssembler(),
    actionPipeline: {
      store: actionStore,
      policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
    },
    deepEscalationEnabled: false,
    maxRecentMessages: 8,
    interventionService: new InterventionService(new InMemoryInterventionRepository()),
  });
  return { service, repository, model, actionStore };
}

function ownerDeliveryPolicy(intent: OutboundDeliveryIntent, status: MessagingConnectionStatus) {
  return evaluateOwnerTransportDelivery({
    intent,
    configuredOwnerTargetReference: ownerTargetReference(ownerPhone),
    outboundKillSwitchActive: false,
    transportConnected: status.state === 'connected',
    versionVerified: true,
    ownerConversationVerified: true,
    quietModeActive: false,
  });
}

function currentState() {
  return {
    contextRecords: [],
    hardOverrideIds: [],
    availableData: [],
    existingPlanBlocks: [],
    availableDayPlanIds: [dayPlanId],
    authorizedNewFlexibleBlockTitles: ['Gym'],
    hasConflict: false,
    highConsequence: false,
    remainingDeepCalls: 0,
    maximumModelCalls: 1,
  } as const;
}

describe('transport worker vertical slice', () => {
  it('runs the provider-free owner webhook → canonical event → FakeModelGateway → policy → durable outbox → send flow exactly once', async () => {
    const events = new InMemoryEventStore();
    const app = buildApi({
      environment: { APP_ENV: 'test' },
      evolutionWebhook: {
        enabled: true,
        ownerId,
        expectedInstanceName: instanceName,
        pipeline: {
          store: events,
          handlers: createDeterministicPhaseOneHandlers(),
          policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
          createJob(event) {
            return {
              id: randomUUID(),
              ownerId: event.ownerId,
              jobType: 'jarvis.event.process',
              payload: { eventId: event.id },
              priority: 0,
              scheduledFor: event.receivedAt,
              availableAfter: event.receivedAt,
              executionDeadline: null,
              dispatchGeneration: initialJobDispatchGeneration,
              maximumAttempts: 5,
              correlationId: event.correlationId,
              sourceEventId: event.id,
              idempotencyKey: `event-job:${event.id}`,
            };
          },
        },
        verifier: new EvolutionWebhookVerifier({
          secret: testSigningMaterial,
          now: () => new Date(now),
        }),
        parser: new EvolutionWebhookParser(),
        mapper: new EvolutionMessageMapper(new EvolutionOwnerIdentityResolver(ownerPhone)),
        rejectionRecorder: { async record() {} },
        now: () => new Date(now),
      },
    });
    try {
      const first = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'application/json' },
        payload: ownerTextPayload(),
      });
      const replay = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'application/json' },
        payload: ownerTextPayload(),
      });

      const repository = new InMemoryTransportRepository();
      const outbox = new InMemoryDeliveryOutbox(repository);
      const brain = createBrainHarness();
      const fakeEvolution = new FakeEvolutionTransport();
      const audit: Array<{
        readonly action: string;
        readonly metadata: Readonly<Record<string, unknown>>;
      }> = [];
      const auditSink = {
        async record(input: {
          readonly action: string;
          readonly metadata: Readonly<Record<string, unknown>>;
        }) {
          audit.push({ action: input.action, metadata: input.metadata });
        },
      };
      const processor = new TransportEventProcessor({
        repository,
        brain: brain.service,
        currentState: { load: async () => currentState() },
        deliveryOutbox: outbox,
        ownerDeliveryPolicy: {
          evaluate: ({ intent, connectionStatus }) => ownerDeliveryPolicy(intent, connectionStatus),
        },
        connectionStatus: {
          getConnectionStatus: (input) => fakeEvolution.getConnectionStatus(input),
        },
        connectionId,
        configuredOwnerTargetReference: ownerTargetReference(ownerPhone),
        audit: auditSink,
        now: () => new Date(now),
      });
      const inboundResult = await processor.process(events.events[0]!);
      // Simulate the durable event job being replayed after the Brain response has committed. The
      // duplicate path must rehydrate that response and hit the same idempotent outbox key.
      const replayedProcessing = await processor.process(events.events[0]!);
      const dispatch = new TransportOutboundWorker({
        repository,
        transport: fakeEvolution,
        ownerDeliveryPolicy: {
          evaluate: ({ intent, connectionStatus }) => ownerDeliveryPolicy(intent, connectionStatus),
        },
        audit: auditSink,
        now: () => new Date(now),
      });
      const deliveryResult = await dispatch.dispatch(outbox.jobs[0]!);
      const duplicateDispatch = await dispatch.dispatch(outbox.jobs[0]!);

      expect(first.statusCode).toBe(202);
      expect(replay.statusCode).toBe(200);
      expect(events.events).toHaveLength(1);
      expect(events.jobs).toHaveLength(1);
      expect(inboundResult).toMatchObject({ disposition: 'brain_enqueued_delivery' });
      expect(replayedProcessing).toMatchObject({ disposition: 'brain_enqueued_delivery' });
      expect(brain.model.requests).toHaveLength(1);
      expect(brain.repository.inbound).toHaveLength(1);
      expect(brain.repository.responses).toHaveLength(1);
      expect(brain.repository.planProposals).toHaveLength(1);
      expect(brain.actionStore.executedActions).toHaveLength(1);
      expect(outbox.jobs).toHaveLength(1);
      expect(deliveryResult).toEqual({ disposition: 'sent', requiresReconciliation: false });
      expect(duplicateDispatch).toEqual({
        disposition: 'already_handled',
        requiresReconciliation: false,
      });
      expect(fakeEvolution.sent).toHaveLength(1);
      expect(repository.deliveries.get(outbox.jobs[0]!.id)).toMatchObject({ state: 'sent' });
      expect(audit.map((entry) => entry.action)).toEqual(
        expect.arrayContaining(['transport.delivery.queued', 'transport.delivery.attempted']),
      );
    } finally {
      await app.close();
    }
  });

  it('keeps the reminder/commitment intent durable while disconnected, retries safely, and never duplicates a timeout send', async () => {
    const repository = new InMemoryTransportRepository();
    const outbox = new InMemoryDeliveryOutbox(repository);
    const fakeEvolution = new FakeEvolutionTransport();
    const brain = createBrainHarness();
    const processor = new TransportEventProcessor({
      repository,
      brain: brain.service,
      currentState: { load: async () => currentState() },
      deliveryOutbox: outbox,
      ownerDeliveryPolicy: {
        evaluate: ({ intent, connectionStatus }) => ownerDeliveryPolicy(intent, connectionStatus),
      },
      connectionStatus: {
        getConnectionStatus: (input) => fakeEvolution.getConnectionStatus(input),
      },
      connectionId,
      configuredOwnerTargetReference: ownerTargetReference(ownerPhone),
      now: () => new Date(now),
    });
    const genericReminder = {
      id: '00000000-0000-4000-8000-000000000030',
      ownerId,
      reminderId: '00000000-0000-4000-8000-000000000031',
      message: 'Time for your gym session.',
      critical: false,
      correlationId,
      causationId: null,
      createdAt: now,
    } as const;
    // A disconnect at reminder eligibility is a durable waiting condition, not a suppression that
    // discards the generic reminder delivery intent.
    fakeEvolution.state = 'disconnected';
    const proactive = await processor.processProactiveReminder({
      intent: genericReminder,
      messagePersistence: {
        async persist() {
          return {
            messageId: '00000000-0000-4000-8000-000000000032',
            conversationId: '00000000-0000-4000-8000-000000000005',
          };
        },
      },
    });
    const worker = new TransportOutboundWorker({
      repository,
      transport: fakeEvolution,
      ownerDeliveryPolicy: {
        evaluate: ({ intent, connectionStatus }) => ownerDeliveryPolicy(intent, connectionStatus),
      },
      now: () => new Date(now),
    });
    const disconnected = await worker.dispatch(outbox.jobs[0]!);
    expect(proactive).toMatchObject({ suppressed: false, deliveryId: expect.any(String) });
    expect(disconnected).toEqual({
      disposition: 'wait_for_connection',
      requiresReconciliation: false,
    });
    expect(fakeEvolution.sent).toHaveLength(0);
    expect(repository.deliveries.get(outbox.jobs[0]!.id)).toMatchObject({
      state: 'failed_retryable',
    });

    fakeEvolution.state = 'connected';
    fakeEvolution.nextResult = {
      disposition: 'retryable_failure',
      providerMessageReference: null,
      acceptedAt: null,
      errorCategory: 'timeout',
      requiresReconciliation: true,
    };
    const timedOut = await worker.dispatch(outbox.jobs[0]!);
    const duplicateAfterTimeout = await worker.dispatch(outbox.jobs[0]!);
    expect(timedOut).toEqual({ disposition: 'retry_scheduled', requiresReconciliation: true });
    expect(duplicateAfterTimeout).toEqual({
      disposition: 'already_handled',
      requiresReconciliation: false,
    });
    expect(fakeEvolution.sent).toHaveLength(1);
    expect(repository.deliveries.get(outbox.jobs[0]!.id)).toMatchObject({
      state: 'failed_retryable',
      requiresReconciliation: true,
    });
    expect(brain.model.requests).toHaveLength(0);
  });
});
