# Recommended examples

The [examples catalog](../examples/README.md) is broad; start with these
maintained paths and review their side effects before using real
credentials.

| Path | Use | Expected result |
|---|---|---|
| [quickstart.ts](../examples/quickstart.ts) | Core workflow and worker | Prints a completed workflow result. |
| [workers-e2e.ts](../examples/workers-e2e.ts) | End-to-end: 3 chained workers with verification | Prints the verified chain output. |
| [kitchensink.ts](../examples/kitchensink.ts) | All major task types in one workflow | Prints the completed workflow output. |
| [workflow-ops.ts](../examples/workflow-ops.ts) | Lifecycle: pause, resume, terminate, retry, search | Prints each operation's result. |
| [test-workflows.ts](../examples/test-workflows.ts) | Unit testing with mock outputs (no workers) | Prints the simulated status/output. |
| [agents/01-basic-agent.ts](../examples/agents/01-basic-agent.ts) | First Conductor agent | Prints an `AgentResult`. |

Stop local servers and worker processes after experimenting. Provider
credentials must be configured on the Conductor server, not the client — see
[security](security.md).
