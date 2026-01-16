import { ItemView, WorkspaceLeaf, Notice, Setting, ButtonComponent, TextComponent, TextAreaComponent } from "obsidian";
import AIAgentsPlugin from "../main";
import { Agent } from "../settings";
import { OllamaClient } from "../ollama-client";

export const VIEW_TYPE_AI_AGENTS = "ai-agents-view";

export class ChatView extends ItemView {
    plugin: AIAgentsPlugin;
    selectedAgentId: string | null = null;
    resultEl!: HTMLDivElement;
    taskInput!: TextAreaComponent;

    constructor(leaf: WorkspaceLeaf, plugin: AIAgentsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_AI_AGENTS;
    }

    getDisplayText() {
        return "AI Agents";
    }

    getIcon() {
        return "bot";
    }

    async onOpen() {
        this.render();
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("ai-agents-view-container");

        contentEl.createEl("h4", { text: "AI Agents" });

        // Agent Selection Row
        const agentRow = contentEl.createDiv({ cls: "agent-selection-row" });
        this.renderAgentSelection(agentRow);

        // Task Input Area
        contentEl.createEl("h5", { text: "Assign Task" });
        const inputContainer = contentEl.createDiv({ cls: "task-input-container" });
        this.taskInput = new TextAreaComponent(inputContainer)
            .setPlaceholder("What should the agent do?")
            .then(ta => {
                ta.inputEl.addClass("task-textarea");
            });

        const actionRow = contentEl.createDiv({ cls: "action-row" });
        new ButtonComponent(actionRow)
            .setButtonText("Run Task")
            .setCta()
            .onClick(() => this.runTask());

        // Result Area
        contentEl.createEl("h5", { text: "Result" });
        this.resultEl = contentEl.createDiv({ cls: "result-container" });
    }

    renderAgentSelection(container: HTMLElement | null) {
        if (!container) return;
        container.empty();

        const agents = this.plugin.agentManager!.getAgents();
        if (agents.length === 0) {
            container.createEl("span", { text: "No agents created yet.", cls: "no-agents-msg" });
        } else {
            if (this.selectedAgentId === null || !agents.find(a => a.id === this.selectedAgentId)) {
                this.selectedAgentId = agents[0]!.id;
            }

            const dropdown = container.createEl("select", { cls: "agent-dropdown" });
            agents.forEach(agent => {
                const option = dropdown.createEl("option", { text: agent.name, value: agent.id });
                if (agent.id === this.selectedAgentId) option.selected = true;
            });

            dropdown.onchange = () => {
                this.selectedAgentId = dropdown.value;
            };
        }

        new ButtonComponent(container)
            .setIcon("plus")
            .setTooltip("Create New Agent")
            .onClick(() => {
                this.plugin.openAgentEditModal();
            });
    }

    refresh() {
        const agentRow = this.contentEl.querySelector(".agent-selection-row") as HTMLElement;
        if (agentRow) {
            this.renderAgentSelection(agentRow);
        }
    }

    async runTask() {
        const selectedId = this.selectedAgentId;
        if (!selectedId) {
            new Notice("Please create and select an agent first.");
            return;
        }

        const agent = this.plugin.agentManager!.getAgent(selectedId);
        if (!agent) return;

        const task = this.taskInput.getValue();
        if (!task.trim()) {
            new Notice("Please enter a task.");
            return;
        }

        this.resultEl.setText("Running task...");
        this.resultEl.addClass("loading");
        this.resultEl.removeClass("error");

        try {
            const ollama = new OllamaClient(this.plugin.settings.ollamaUrl);
            const response = await ollama.chat(agent.model, [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: task }
            ]);

            this.resultEl.empty();
            this.resultEl.removeClass("loading");
            this.resultEl.createEl("pre", { text: response, cls: "result-text" });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.resultEl.setText(`Error: ${message}`);
            this.resultEl.addClass("error");
            this.resultEl.removeClass("loading");
        }
    }
}
