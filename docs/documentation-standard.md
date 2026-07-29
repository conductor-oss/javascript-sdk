# Documentation standard

Every primary JavaScript SDK guide must include its audience and prerequisites,
an OSS/Orkes capability label when behavior differs, and a security note when it
handles credentials, user data, tools, or external side effects.

Commands must be runnable or marked **Fragment** and linked to a complete
repository example. State the expected result, common failure modes, cleanup,
and next steps. Use `@io-orkes/conductor-javascript` and published npm versions
rather than stale pinned versions. CI validates internal Markdown links and
curated example paths.

## Terminology

- **Conductor agents** — the noun. Not "Agentspan agents", not "AI agents".
- **Conductor-agent** — hyphenated only as an attributive adjective, as in
  "Conductor-agent lifecycle" or "Conductor-agent API reference".
- **Conductor server** — the server. Say "OSS" or "Orkes" when the distinction
  matters.

This vocabulary is shared with the [Python](https://github.com/conductor-oss/python-sdk)
and [Java](https://github.com/conductor-oss/java-sdk) SDKs so the three
documentation sets stay comparable. See [documentation-parity.md](documentation-parity.md).

## Page shape

Open with an `**Audience:**` line, then `## Prerequisites`, then the content.
Close with next steps. Tables that orient the reader use a
goal / guide / expected-result shape.

## TypeScript specifics

- Examples use ESM `import`. The package ships ESM and CommonJS, so `require`
  works too; say so once rather than duplicating every snippet.
- Import agent symbols from the `/agents` subpath, never the package root — the
  root re-exports the generated OpenAPI surface and would collide.
- Prefer `npx tsx file.ts` for runnable snippets.
- Snippets that need `zod` or a framework peer dependency say so in
  Prerequisites.
