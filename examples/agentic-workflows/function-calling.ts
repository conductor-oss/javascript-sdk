/**
 * Function Calling — LLM dynamically invokes worker functions
 *
 * Demonstrates the agentic pattern where an LLM decides which tool/function
 * to call based on user input. Uses llmChatCompleteTask with tool definitions
 * and a dynamic task to execute the chosen function.
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/agentic-workflows/function-calling.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  llmChatCompleteTask,
  simpleTask,
  switchTask,
  inlineTask,
  Role,
} from "../../src/sdk";
import type { Task, TaskResult } from "../../src/open-api";

// ── Tool workers ────────────────────────────────────────────────────
@worker({ taskDefName: "fn_get_weather", registerTaskDef: true })
async function getWeather(task: Task): Promise<TaskResult> {
  const city = (task.inputData?.city as string) ?? "Unknown";
  // Simulate weather API
  const weather = {
    city,
    temperature: Math.round(15 + Math.random() * 20),
    condition: ["Sunny", "Cloudy", "Rainy", "Windy"][
      Math.floor(Math.random() * 4)
    ],
    humidity: Math.round(30 + Math.random() * 50),
  };
  return { status: "COMPLETED", outputData: weather };
}

@worker({ taskDefName: "fn_get_stock_price", registerTaskDef: true })
async function getStockPrice(task: Task): Promise<TaskResult> {
  const symbol = (task.inputData?.symbol as string) ?? "AAPL";
  // Simulate stock API
  const price = {
    symbol,
    price: Math.round(100 + Math.random() * 200 * 100) / 100,
    change: Math.round((Math.random() * 10 - 5) * 100) / 100,
    currency: "USD",
  };
  return { status: "COMPLETED", outputData: price };
}

@worker({ taskDefName: "fn_calculate", registerTaskDef: true })
async function calculate(task: Task): Promise<TaskResult> {
  const expression = (task.inputData?.expression as string) ?? "0";
  let result: number;
  try {
    // Simple safe evaluation (in production, use a proper math parser)
    result = Function(`"use strict"; return (${expression})`)();
  } catch {
    return {
      status: "FAILED",
      outputData: { error: `Invalid expression: ${expression}` },
    };
  }
  return { status: "COMPLETED", outputData: { expression, result } };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  // ── Build the agentic workflow ────────────────────────────────────
  const wf = new ConductorWorkflow(workflowClient, "function_calling_example")
    .description("LLM picks which function to call based on user query");

  // Step 1: LLM decides which function to call
  wf.add(
    llmChatCompleteTask("decide_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message: `You are a helpful assistant with access to these tools:
1. get_weather(city: string) - Get current weather for a city
2. get_stock_price(symbol: string) - Get current stock price
3. calculate(expression: string) - Evaluate a math expression

Based on the user's query, respond with ONLY a JSON object:
{"function": "<function_name>", "args": {"<key>": "<value>"}}`,
        },
        {
          role: Role.USER,
          message: "${workflow.input.query}",
        },
      ],
      temperature: 0,
      maxTokens: 200,
    })
  );

  // Step 2: Parse LLM response
  wf.add(
    inlineTask(
      "parse_ref",
      `(function() {
        var text = $.decide_ref.output.result;
        try {
          var parsed = JSON.parse(text);
          return parsed;
        } catch(e) {
          return { function: "unknown", args: {} };
        }
      })()`,
      "javascript"
    )
  );

  // Step 3: Route to the appropriate function
  wf.add(
    switchTask(
      "route_ref",
      "${parse_ref.output.result.function}",
      {
        get_weather: [
          simpleTask("weather_ref", "fn_get_weather", {
            city: "${parse_ref.output.result.args.city}",
          }),
        ],
        get_stock_price: [
          simpleTask("stock_ref", "fn_get_stock_price", {
            symbol: "${parse_ref.output.result.args.symbol}",
          }),
        ],
        calculate: [
          simpleTask("calc_ref", "fn_calculate", {
            expression: "${parse_ref.output.result.args.expression}",
          }),
        ],
      },
      [
        inlineTask(
          "unknown_ref",
          '(function() { return { error: "Unknown function requested" }; })()',
          "javascript"
        ),
      ]
    )
  );

  // Step 4: LLM summarizes the result
  wf.add(
    llmChatCompleteTask("summarize_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message: "Summarize the tool result in a natural, conversational way.",
        },
        {
          role: Role.USER,
          message:
            'User asked: "${workflow.input.query}". Tool result: ${route_ref.output}',
        },
      ],
      temperature: 0.5,
      maxTokens: 200,
    })
  );

  wf.outputParameters({
    query: "${workflow.input.query}",
    functionCalled: "${parse_ref.output.result.function}",
    summary: "${summarize_ref.output.result}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // Start workers
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Execute with different queries
  const queries = [
    "What's the weather like in Tokyo?",
    "What's the current price of TSLA stock?",
    "Calculate 42 * 17 + 3",
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    const run = await wf.execute({ query });
    console.log("Status:", run.status);
    console.log("Output:", JSON.stringify(run.output, null, 2));
  }

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
