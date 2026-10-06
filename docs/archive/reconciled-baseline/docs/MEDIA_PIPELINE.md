# Media boundary

Phase 3 normalizes media metadata only. Images, audio/voice notes, and documents preserve message type, MIME type, byte length, file name where relevant, and an opaque provider-media reference. The message body contains no bytes, base64, signed URL, or raw Evolution payload.

`media_fetch_requests` is a metadata-only canonical work boundary. A future secure media worker must use a provider-neutral storage interface and enforce all of the following before fetching or persisting media:

- Explicit MIME allowlist and type-specific maximum size.
- Request timeout, redirect restrictions, content verification, and malware/content scanning policy.
- Private object storage with a narrow object reference, encryption, and retention policy.
- No automatic model upload or transcription.
- Separate policy before vision, transcription, document parsing, or retrieval.

There is no live transcription API, media fetch implementation, or automatic AI processing in Phase 3. This keeps provider credentials, raw media, and private content outside Brain context by default.
