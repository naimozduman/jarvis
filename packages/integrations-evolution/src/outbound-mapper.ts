import type { MessagingMediaSendRequest, MessagingTextSendRequest } from '@jarvis/contracts';

export interface EvolutionOutboundTextPayload {
  readonly number: string;
  readonly text: string;
  readonly messageId: string;
}

export interface EvolutionOutboundMediaPayload {
  readonly number: string;
  readonly mediatype: 'image' | 'audio' | 'document';
  readonly media: string;
  readonly mimetype: string;
  readonly fileName?: string;
  readonly caption?: string;
  readonly messageId: string;
}

/**
 * Maps a server-derived JARVIS delivery request to the currently reviewed Evolution request
 * fields. It has no knowledge of model output and receives the configured owner number only from
 * transport composition, never from an inbound payload.
 */
export class EvolutionOutboundMapper {
  public text(input: MessagingTextSendRequest, ownerPhone: string): EvolutionOutboundTextPayload {
    return {
      number: ownerPhone,
      text: input.text,
      messageId: input.operationKey,
    };
  }

  public media(
    input: MessagingMediaSendRequest,
    ownerPhone: string,
    source: string,
  ): EvolutionOutboundMediaPayload {
    return {
      number: ownerPhone,
      mediatype: this.mediaType(input.mimeType),
      media: source,
      mimetype: input.mimeType,
      messageId: input.operationKey,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.caption ? { caption: input.caption } : {}),
    };
  }

  private mediaType(mimeType: string): 'image' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
