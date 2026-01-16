import { Agent, AIAgentsSettings } from "./settings";
import AIAgentsPlugin from "./main";

export class AgentManager {
    private plugin: AIAgentsPlugin;

    constructor(plugin: AIAgentsPlugin) {
        this.plugin = plugin;
    }

    getAgents(): Agent[] {
        return this.plugin.settings.agents;
    }

    getAgent(id: string): Agent | undefined {
        return this.plugin.settings.agents.find(a => a.id === id);
    }

    async createAgent(name: string, systemPrompt: string, model: string): Promise<Agent> {
        const newAgent: Agent = {
            id: Date.now().toString(),
            name,
            systemPrompt,
            model
        };
        this.plugin.settings.agents.push(newAgent);
        await this.plugin.saveSettings();
        return newAgent;
    }

    async updateAgent(agent: Agent): Promise<void> {
        const index = this.plugin.settings.agents.findIndex(a => a.id === agent.id);
        if (index !== -1) {
            this.plugin.settings.agents[index] = agent;
            await this.plugin.saveSettings();
        }
    }

    async deleteAgent(id: string): Promise<void> {
        this.plugin.settings.agents = this.plugin.settings.agents.filter(a => a.id !== id);
        await this.plugin.saveSettings();
    }
}
