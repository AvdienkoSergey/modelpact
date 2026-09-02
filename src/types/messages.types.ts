/**
 * `system` is missing on purpose. The spec accepts a system instruction only
 * as the very first message and throws `TypeError` otherwise; here the system
 * text is a session option instead, so a misplaced one cannot be written.
 */
export type AiRole = "user" | "assistant";

export interface AiMessage {
  readonly role: AiRole;
  // Text only, no modalities yet. Side effect: the spec's "assistant role with
  // non-text content" error is unreachable through this contract.
  readonly content: string;
}

/** Text only for now; the other two gate model selection, not message content. */
export type Modality = "text" | "image" | "audio";

export interface ModalityExpectation {
  readonly type: Modality;
  /** BCP-47 tags. */
  readonly languages?: readonly string[];
}

/**
 * What the caller needs from the model. Availability depends on the request,
 * not only on the environment — an image input or an unsupported language can
 * make an otherwise present model unavailable — so it is asked for up front.
 *
 * Tools are absent because the contract has no tool support; when they arrive
 * they belong here too, since they take part in choosing the model.
 */
export interface ModelRequest {
  readonly inputs?: readonly ModalityExpectation[];
  readonly outputs?: readonly ModalityExpectation[];
}
