import { App } from "obsidian";
import AIAgentsPlugin from "../main";
import { Agent } from "../settings";
import { OllamaClient, ChatMessage } from "../ollama-client";
import { ToolManager } from "../tool-manager";

export interface ChatStatusUpdate {
    status: "loading" | "tool_running" | "tool_result" | "done" | "error";
    message?: string;
}

export class ChatService {
    app: App;
    plugin: AIAgentsPlugin;

    constructor(app: App, plugin: AIAgentsPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async chatWithTools(
        agent: Agent,
        history: ChatMessage[],
        onStatusUpdate?: (update: ChatStatusUpdate) => void
    ): Promise<ChatMessage[]> {
        const ollama = new OllamaClient(this.plugin.settings.ollamaUrl);
        const toolManager = new ToolManager(this.app, this.plugin);
        const tools = toolManager.getToolDefinitions(agent);

        const messages = [...history];
        let done = false;
        let iterations = 0;
        const maxIterations = 5;

        // Build agent registry for orchestration
        const allAgents = this.plugin.agentManager.getAgents();
        const agentRegistry = allAgents.map(a => `- ${a.name} (ID: ${a.id})`).join("\n");

        const orchestrationRules = `
### Orchestration Rules:
1. Only call another agent if you cannot fulfill the user's request with your existing knowledge or tools.
2. If the user's request is a simple follow-up that you can answer, do NOT call another agent.
3. When you call an agent, be specific in your prompt to them.
4. **Output Format**: Always respond to the user in plain, conversational text. Do NOT use JSON formatting for your final response.
5. You are aware of the following available agents:
${agentRegistry}
`.trim();

        const enhancedSystemPrompt = `${agent.systemPrompt}\n\n${orchestrationRules}`;

        while (!done && iterations < maxIterations) {
            iterations++;

            if (onStatusUpdate) onStatusUpdate({ status: "loading" });

            const apiMessages: ChatMessage[] = [
                { role: 'system', content: enhancedSystemPrompt },
                ...messages
            ];

            try {
                const response = await ollama.chat(agent.model || "llama3.2-latest", apiMessages, tools);

                if (response.tool_calls && response.tool_calls.length > 0) {
                    messages.push(response);

                    for (const toolCall of response.tool_calls) {
                        const toolName = toolCall.function.name;
                        const toolArgs = toolCall.function.arguments;

                        if (onStatusUpdate) onStatusUpdate({ status: "tool_running", message: `🔧 Running tool: ${toolName}...` });

                        const result = await toolManager.executeTool(toolName, toolArgs, agent);

                        messages.push({
                            role: 'tool',
                            content: result
                        });
                    }
                } else {
                    messages.push(response);
                    done = true;
                }
            } catch (error) {
                if (onStatusUpdate) onStatusUpdate({ status: "error", message: error instanceof Error ? error.message : String(error) });
                done = true;
            }
        }

        if (onStatusUpdate) onStatusUpdate({ status: "done" });
        return messages;
    }
}
