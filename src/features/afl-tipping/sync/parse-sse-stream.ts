/** One Server-Sent Event: the `event:` name (`message` if none), its `data:` lines, and its `id:`. */
export type SseMessage = { event: string; data: string; id?: string };

/**
 * Reads Server-Sent Events from text chunks, as the SSE spec says: events end at a blank line,
 * `data:` lines join with `\n`, a line starting with `:` is a comment (Squiggle's 10 s heartbeat),
 * and `retry:` is ignored (we choose our own backoff). Chunks may split anywhere, even inside a
 * line or between `\r` and `\n`. An event cut off by the end of the stream is dropped, as a
 * browser does. An event with no `data:` line is dropped too.
 */
export async function* parseSseStream(chunks: AsyncIterable<string>): AsyncGenerator<SseMessage> {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let id: string | undefined;

  function* handleLine(line: string): Generator<SseMessage> {
    if (line === "") {
      if (data.length > 0) {
        yield {
          event: event || "message",
          data: data.join("\n"),
          ...(id === undefined ? {} : { id }),
        };
      }
      event = "";
      data = [];
      id = undefined;
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
  }

  for await (const chunk of chunks) {
    buffer += chunk;
    // A trailing "\r" may be the first half of "\r\n": keep it for the next chunk.
    const ends = buffer.endsWith("\r");
    const complete = ends ? buffer.slice(0, -1) : buffer;
    const lines = complete.split(/\r\n|\n|\r/);
    buffer = lines.pop()! + (ends ? "\r" : "");
    for (const line of lines) yield* handleLine(line);
  }
}
