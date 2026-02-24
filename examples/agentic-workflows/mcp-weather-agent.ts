/**
 * MCP Weather Agent — Using MCP tools for real-time data
 *
 * Demonstrates listMcpToolsTask and callMcpToolTask to discover and invoke
 * MCP (Model Context Protocol) server tools from within a workflow.
 *
 * Prerequisites:
 *   - An MCP server integration configured in Conductor
 *   - The MCP server exposes weather-related tools
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/agentic-workflows/mcp-weather-agent.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  listMcpToolsTask,
  callMcpToolTask,
  llmChatCompleteTask,
  inlineTask,
  Role,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  const mcpServer = process.env.MCP_SERVER ?? "weather_mcp_server";
  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  const wf = new ConductorWorkflow(workflowClient, "mcp_weather_agent")
    .description("Uses MCP tools to fetch weather data and summarize with LLM");

  // Step 1: List available MCP tools
  wf.add(listMcpToolsTask("list_tools_ref", mcpServer));

  // Step 2: Log available tools
  wf.add(
    inlineTask(
      "log_tools_ref",
      `(function() {
        var tools = $.list_tools_ref.output.result || [];
        return {
          toolCount: tools.length,
          toolNames: tools.map(function(t) { return t.name; })
        };
      })()`,
      "javascript"
    )
  );

  // Step 3: Call the weather tool
  wf.add(
    callMcpToolTask("get_weather_ref", mcpServer, "get_current_weather", {
      inputParameters: {
        city: "${workflow.input.city}",
        units: "${workflow.input.units}",
      },
    })
  );

  // Step 4: Call forecast tool
  wf.add(
    callMcpToolTask("get_forecast_ref", mcpServer, "get_forecast", {
      inputParameters: {
        city: "${workflow.input.city}",
        days: 3,
      },
    })
  );

  // Step 5: LLM summarizes weather data
  wf.add(
    llmChatCompleteTask("summarize_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a weather assistant. Summarize the weather data in a friendly, concise format.",
        },
        {
          role: Role.USER,
          message: `City: \${workflow.input.city}
Current weather: \${get_weather_ref.output.result}
3-day forecast: \${get_forecast_ref.output.result}

Please provide a brief weather summary.`,
        },
      ],
      temperature: 0.5,
      maxTokens: 300,
    })
  );

  wf.outputParameters({
    city: "${workflow.input.city}",
    availableTools: "${log_tools_ref.output.result.toolNames}",
    currentWeather: "${get_weather_ref.output.result}",
    forecast: "${get_forecast_ref.output.result}",
    summary: "${summarize_ref.output.result}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // Execute
  const run = await wf.execute({
    city: "San Francisco",
    units: "fahrenheit",
  });

  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
