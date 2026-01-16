import { App, TFile, Notice, normalizePath } from "obsidian";
import AIAgentsPlugin from "./main";
import { Agent } from "./settings";

export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    };
}

export class ToolManager {
    app: App;
    plugin: AIAgentsPlugin;

    constructor(app: App, plugin: AIAgentsPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    getToolDefinitions(agent: Agent): ToolDefinition[] {
        const allTools: ToolDefinition[] = [
            {
                type: "function",
                function: {
                    name: "get_current_time",
                    description: "Get the current date and time.",
                    parameters: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_vault_file",
                    description: "Read the content of a file from the Obsidian vault.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: {
                                type: "string",
                                description: "The relative path to the file in the vault (e.g., 'Folder/Note.md')."
                            }
                        },
                        required: ["path"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "call_agent",
                    description: "Ask another AI agent for help or specific information.",
                    parameters: {
                        type: "object",
                        properties: {
                            agentId: {
                                type: "string",
                                description: "The ID of the agent to call."
                            },
                            prompt: {
                                type: "string",
                                description: "The question or task for the other agent."
                            }
                        },
                        required: ["agentId", "prompt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "send_notification",
                    description: "Show a persistent system-level popup notification. Use this to ensure the user sees an important message even if Obsidian is minimized.",
                    parameters: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "A very SHORT title for the notification (e.g. 'Project Update')."
                            },
                            body: {
                                type: "string",
                                description: "The COMPLETE and DETAILED message text to show in the notification. Do NOT leave this empty."
                            }
                        },
                        required: ["title", "body"]
                    }
                }
            }
        ];

        if (!agent.enabledTools) return [];
        return allTools.filter(t => agent.enabledTools?.includes(t.function.name));
    }

    async executeTool(name: string, args: any, agent: Agent): Promise<string> {
        // Double check permissions
        if (!agent.enabledTools?.includes(name)) {
            return `Error: Agent "${agent.name}" does not have permission to use the "${name}" tool.`;
        }

        switch (name) {
            case "get_current_time":
                return new Date().toLocaleString();

            case "read_vault_file":
                if (!this.isPathAllowed(args.path, agent.allowedPaths)) {
                    return `Error: Agent "${agent.name}" does not have permission to access the path "${args.path}".`;
                }
                const file = this.app.vault.getAbstractFileByPath(normalizePath(args.path));
                if (file instanceof TFile) {
                    return await this.app.vault.read(file);
                }
                return `Error: File not found at path "${args.path}"`;

            case "call_agent":
                return await this.orchestrateAgent(args.agentId, args.prompt);

            case "send_notification":
                const title = args.title || "AI Agent alert";
                const body = args.body || "No message content was provided by the agent.";

                // Show an Obsidian notice with longer duration (10 seconds)
                new Notice(`System Notification: ${title}\n\n${body}`, 10000);

                if (!("Notification" in window)) {
                    return "Error: System notifications are not supported.";
                }

                try {
                    const options = {
                        body: body,
                        requireInteraction: true, // Keeps it open on many systems until clicked
                        silent: false
                    };

                    if (Notification.permission === "granted") {
                        new Notification(title, options);
                        return "Persistent notification sent.";
                    } else if (Notification.permission !== "denied") {
                        const permission = await Notification.requestPermission();
                        if (permission === "granted") {
                            new Notification(title, options);
                            return "Persistent notification sent after permission grant.";
                        }
                    }
                    return "Error: Notification permission denied.";
                } catch (e) {
                    return `Error triggering notification: ${String(e)}`;
                }

            default:
                return `Error: Unknown tool "${name}"`;
        }
    }

    private isPathAllowed(filePath: string, allowedPathsStr?: string): boolean {
        if (!allowedPathsStr || allowedPathsStr.trim() === "") return true; // Default to allow all if empty? 
        // User said "Can we add specific customization... which file it has access to or folder etc"
        // Let's interpret empty as "allow all" for now, or maybe "allow none" is safer?
        // Actually, if the field exists, maybe we should restrict by default if it's not empty.

        const allowedPaths = allowedPathsStr.split(',').map(p => normalizePath(p.trim())).filter(p => p !== "");
        if (allowedPaths.length === 0) return true;

        const normalizedFile = normalizePath(filePath);
        return allowedPaths.some(allowed => normalizedFile.startsWith(allowed));
    }

    private async orchestrateAgent(agentId: string, prompt: string): Promise<string> {
        const agent = this.plugin.agentManager.getAgent(agentId);
        if (!agent) {
            const agents = this.plugin.agentManager.getAgents();
            const available = agents.map(a => `"${a.name}" (id: ${a.id})`).join(", ");
            return `Error: Agent with ID "${agentId}" not found. Available agents: ${available}`;
        }

        try {
            const { ChatService } = await import("./services/chat-service");
            const chatService = new ChatService(this.app, this.plugin);

            const results = await chatService.chatWithTools(agent, [
                { role: 'user', content: prompt }
            ]);

            const lastMessage = results[results.length - 1];
            if (!lastMessage) return `Error: No response from ${agent.name}`;
            return `Response from ${agent.name}: ${lastMessage.content}`;
        } catch (error) {
            return `Error calling agent ${agent.name}: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
