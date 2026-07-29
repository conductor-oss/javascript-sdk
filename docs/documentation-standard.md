# Documentation standard

Every primary guide must include its audience and prerequisites, an OSS/Orkes
capability label when behavior differs, and a security note when it handles
credentials, user data, tools, or external side effects.

Commands must be runnable against a real example in the repository (or
explicitly marked as illustrative). State the expected result, common
failure modes, and next steps. Use `@io-orkes/conductor-javascript` and
published npm versions rather than local-only paths. CI validates internal
Markdown links (`lychee`) and a legacy-branding grep guard.
