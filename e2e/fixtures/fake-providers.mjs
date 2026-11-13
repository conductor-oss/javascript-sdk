/* global process, console */
// Deterministic stand-ins for the providers behind Jev decision SWITCHes.
//
//   POST /v1/systemone  — system-one decision API (conductor.ai.decision.endpoint)
//   POST /v1/responses  — OpenAI Responses API (conductor.ai.openai.base-url),
//                         only when FAKE_OPENAI=1; CI uses the real provider.
//
// Decision answers are keyword based: for each choice question, the first
// choice whose key or description shares a word stem with the state wins,
// otherwise the first choice. The fake OpenAI model calls the first function
// tool named in its instructions (or the first tool) once with
// {"state": <last user text>}, then answers with text that echoes the tool
// output. Run: node e2e/fixtures/fake-providers.mjs  (PORT, default 9911)
import http from "node:http";

const port = Number(process.env.PORT ?? 9911);
const fakeOpenAI = process.env.FAKE_OPENAI === "1";
const stems = (s) =>
  new Set((String(s).toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 3).map((w) => w.slice(0, 6)));

function decide(req) {
  const state = typeof req.state === "string" ? req.state : JSON.stringify(req.state ?? "");
  const stateStems = stems(state);
  const answers = {};
  for (const [name, q] of Object.entries(req.questions ?? {})) {
    if (q.type === "choice") {
      const keys = Object.keys(q.criteria ?? {});
      const hit = keys.find((k) => [...stems(`${k} ${q.criteria[k]}`)].some((w) => stateStems.has(w)));
      answers[name] = { type: "choice", choice: hit ?? keys[0], confidence: 0.9 };
    } else if (q.type === "score") {
      answers[name] = { type: "score", score: 0, confidence: 0.9 };
    } else {
      answers[name] = { type: "noul", noul: 0.5, confidence: 0.9 };
    }
  }
  return {
    id: `fake-decision-${Date.now()}`,
    model: req.model,
    answers,
    usage: { input_tokens: 42, output_tokens: 1, cost: 0.0001 },
  };
}

const textOf = (content) =>
  typeof content === "string" ? content : (content ?? []).map((p) => p.text ?? "").join("");

function respond(req) {
  const items = typeof req.input === "string" ? [{ type: "message", role: "user", content: req.input }] : req.input ?? [];
  const userText = textOf(items.filter((i) => (i.type ?? "message") === "message" && i.role === "user").at(-1)?.content);
  const toolOutputs = items.filter((i) => i.type === "function_call_output");
  const tools = (req.tools ?? []).filter((t) => t.type === "function");
  const base = { id: `fake-resp-${Date.now()}`, object: "response", model: req.model, status: "completed" };
  const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };
  if (tools.length > 0 && toolOutputs.length === 0) {
    const tool = tools.find((t) => (req.instructions ?? "").includes(t.name)) ?? tools[0];
    const callId = `call_${Date.now()}`;
    return {
      ...base,
      usage,
      output: [{ type: "function_call", id: `fc_${callId}`, call_id: callId, name: tool.name, arguments: JSON.stringify({ state: userText }), status: "completed" }],
    };
  }
  const text = toolOutputs.length > 0 ? `FAKE_ANSWER tool=${toolOutputs.at(-1).output}` : `FAKE_ANSWER ${userText}`;
  return {
    ...base,
    usage,
    output_text: text,
    output: [{ type: "message", id: "msg_fake", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }],
  };
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        res.writeHead(400).end();
        return;
      }
      let out;
      if (req.method === "POST" && req.url?.endsWith("/systemone")) out = decide(json);
      else if (fakeOpenAI && req.method === "POST" && req.url?.endsWith("/responses")) out = respond(json);
      if (!out) {
        res.writeHead(404).end();
        return;
      }
      console.log(JSON.stringify({ path: req.url, model: json.model, out: out.answers ?? out.output?.[0]?.type }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  })
  .listen(port, () => console.log(`fake providers on :${port} (openai=${fakeOpenAI})`));
