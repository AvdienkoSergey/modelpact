/**
 * A `TransformStream` that cuts decoded text into NDJSON lines.
 *
 * Network chunks and protocol lines are unrelated cuts of the same bytes. A
 * chunk is whatever arrived in one TCP read: it can hold six frames, or the
 * first half of one, and the boundary can fall inside a multi-byte character —
 * which is `TextDecoderStream`'s job upstream, not this one's. Feeding chunks
 * to `JSON.parse` therefore fails on the first delta long enough to be split.
 *
 * A stage rather than a `let buffer` in the reader loop, for three things a
 * variable cannot do: `flush` runs at end-of-stream, so a body that stops
 * without a trailing newline still yields its last line; the stage takes part
 * in backpressure, since the readable side of a `TransformStream` has
 * `highWaterMark` 0 and stops pulling while the consumer is behind; and
 * cancelling anywhere in a `pipeThrough` chain tears down the whole chain,
 * buffer included.
 */
export function ndjsonLines(): TransformStream<string, string> {
  let tail = "";
  return new TransformStream({
    transform(chunk, controller) {
      const lines = (tail + chunk).split("\n");
      // `split` always yields at least one element, and the last is what comes
      // before the next newline — "" when the chunk ended on one.
      tail = lines.pop() ?? "";
      for (const line of lines) {
        // Blank lines are legal NDJSON padding. `\r` is not stripped: it is
        // JSON whitespace, so `JSON.parse` takes a CRLF line as it stands.
        if (line.trim() !== "") controller.enqueue(line);
      }
    },
    flush(controller) {
      if (tail.trim() !== "") controller.enqueue(tail);
    },
  });
}
