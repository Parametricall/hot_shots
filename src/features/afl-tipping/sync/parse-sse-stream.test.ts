import { describe, expect, it } from "vite-plus/test";
import { parseSseStream, type SseMessage } from "~/features/afl-tipping/sync/parse-sse-stream";

async function parse(...chunks: string[]): Promise<SseMessage[]> {
  async function* source() {
    for (const chunk of chunks) yield chunk;
  }
  const messages: SseMessage[] = [];
  for await (const message of parseSseStream(source())) messages.push(message);
  return messages;
}

describe("parseSseStream", () => {
  it("reads event, data and id lines, and defaults the name to message", async () => {
    expect(await parse('event: score\nid: a1\ndata: {"x":1}\n\ndata: hi\n\n')).toEqual([
      { event: "score", data: '{"x":1}', id: "a1" },
      { event: "message", data: "hi" },
    ]);
  });

  it("skips comments and retry, and joins multi-line data", async () => {
    expect(await parse("retry:2000\n: heartbeat\ndata: a\ndata: b\n\n: heartbeat\n\n")).toEqual([
      { event: "message", data: "a\nb" },
    ]);
  });

  it("reassembles events split across chunks, including CRLF", async () => {
    expect(await parse("event: sco", "re\r", "\ndata: 1\r\n", "\r\n")).toEqual([
      { event: "score", data: "1" },
    ]);
  });

  it("drops an event the stream ended in the middle of", async () => {
    expect(await parse("data: done\n\ndata: cut")).toEqual([{ event: "message", data: "done" }]);
  });
});
