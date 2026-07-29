# Documentation parity

**Audience:** maintainers keeping this documentation set aligned with the Java and
Python SDKs.

## Prerequisites

None. See [documentation-standard.md](documentation-standard.md) for how individual
pages are written.

## Why parity

The three SDKs share wire contracts — the serialized agent configuration, the plan
format, the agent metadata keys — and the same server compiler. Aligned
documentation means a reader can move between them, and a maintainer can diff the
sets to find gaps.

The canonical structure originates in
[conductor-oss/java-sdk](https://github.com/conductor-oss/java-sdk); the
[Python SDK](https://github.com/conductor-oss/python-sdk) adopted it, and this
adopts it in turn.

## Structure

```
docs/
├── README.md                       ← index
├── <core guides>.md                ← ~20 pages
└── agents/
    ├── README.md                   ← agent index
    ├── concepts/                   ← 11 pages
    ├── frameworks/                 ← per-framework guides
    └── reference/                  ← API surface + agent-schema.json
```

## Language-specific deltas

Parity is structural, not literal. Each SDK omits what doesn't apply and adds what
does.

| Page | Java | Python | JavaScript |
|---|---|---|---|
| `spring-boot.md` | Yes | — | — |
| `file-client.md` | Yes | — | — |
| `documentation-parity.md` | — | Yes | Yes |
| `frameworks/langchain4j.md`, `langgraph4j.md` | Yes | — | — |
| `frameworks/langchain.md`, `langgraph.md` | — | Yes | Yes |
| `frameworks/claude-agent-sdk.md` | — | Yes | — |
| `frameworks/vercel-ai.md` | — | — | **Yes** |

`frameworks/vercel-ai.md` is unique to this SDK: `src/agents/wrappers/ai.ts` is a
JavaScript-only bridge with no Java or Python counterpart. The canonical set has no
slot for it, so it is an addition rather than a substitution.

Conversely, this SDK has no `claude-agent-sdk.md` — there is no such wrapper here.

## Terminology

Shared with the sibling SDKs: **"Conductor agents"** as the noun,
**"Conductor-agent"** hyphenated only attributively. Every page opens with an
`**Audience:**` line and a `## Prerequisites` section. See
[documentation-standard.md](documentation-standard.md).

## Legacy paths

Adopting the structure did not break existing links. The previous
`docs/agents/*.md` pages and `docs/api-reference/*.md` remain as redirect stubs
pointing at their replacements, as the Python SDK did.

One consequence worth recording: Java's CI greps to **reject**
`docs/agents/api-reference.md` as a retired path, while Python **keeps** it as a
stub. This SDK follows Python — the stub is deliberate — so the retired-reference
grep here omits that pattern and `docs/agents/index.md`. The two siblings genuinely
disagree; preserving inbound links to a public SDK's docs won.

## Validation

CI checks, in `.github/workflows/pull_request.yml`:

| Check | Tool |
|---|---|
| Internal Markdown links | `lycheeverse/lychee-action`, `--offline` over `README.md` and `docs` |
| Retired references | `grep`, narrowed to permit the stubs above |
| Agent configuration schema | `scripts/verify-agent-schema.mjs` against `e2e/_configs/*.json` |

```shell
npm run verify:agent-schema
```

## Adding a page

1. Add it under the canonical path, or justify the delta in the table above.
2. Follow [documentation-standard.md](documentation-standard.md).
3. Link it from [README.md](README.md) — the link checker only walks reachable
   pages.
4. If it replaces an existing page, leave a stub rather than deleting it.

## Next steps

[documentation-standard.md](documentation-standard.md) · [README.md](README.md) ·
[compatibility.md](compatibility.md)
