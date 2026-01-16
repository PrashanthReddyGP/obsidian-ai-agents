import { ItemView, WorkspaceLeaf, Notice, ButtonComponent, TextAreaComponent, setIcon } from "obsidian";
import AIAgentsPlugin from "../main";
import { Agent } from "../settings";
import { OllamaClient, ChatMessage } from "../ollama-client";
import { AgentEditModal } from "../modals/agent-edit-modal";
import { ToolManager } from "../tool-manager";
import { ChatService } from "../services/chat-service";

export const VIEW_TYPE_AI_AGENTS = "ai-agents-view";

export class ChatView extends ItemView {
    plugin: AIAgentsPlugin;
    selectedAgentId: string | null = null;
    resultEl!: HTMLDivElement;
    taskInput!: TextAreaComponent;
    availableModels: string[] = [];
    messages: ChatMessage[] = [];

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
        await this.fetchModels();
        this.render();
    }

    async fetchModels() {
        try {
            const ollama = new OllamaClient(this.plugin.settings.ollamaUrl);
            const models = await ollama.listModels();
            this.availableModels = models.map(m => m.name);
        } catch (e) {
            console.error("Failed to fetch models", e);
        }
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("ai-agents-view-container");

        contentEl.createEl("h4", { text: "AI Agents" });

        // Agent Selection Row
        const agentRow = contentEl.createDiv({ cls: "agent-selection-row" });
        this.renderAgentSelection(agentRow);

        // Chat Header with Clear button
        const chatHeader = contentEl.createDiv({ cls: "chat-header" });
        chatHeader.createEl("h5", { text: "Conversation" });
        new ButtonComponent(chatHeader)
            .setButtonText("Clear")
            .setTooltip("Clear conversation history")
            .onClick(() => this.clearChat());

        // History container
        this.resultEl = contentEl.createDiv({ cls: "result-container" });
        this.renderMessages();

        // Task Input Area
        const inputContainer = contentEl.createDiv({ cls: "task-input-container" });
        this.taskInput = new TextAreaComponent(inputContainer)
            .setPlaceholder("Follow up or assign a new task...")
            .then(ta => {
                ta.inputEl.addClass("task-textarea");
                ta.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        this.runTask();
                    }
                });
            });

        const actionRow = contentEl.createDiv({ cls: "action-row" });
        new ButtonComponent(actionRow)
            .setButtonText("Send")
            .setCta()
            .onClick(() => this.runTask());
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
                this.clearChat(); // Clear chat when switching agents
            };

            // Edit Button
            const editBtn = container.createDiv({ cls: "clickable-icon edit-icon", title: "Edit Agent" });
            setIcon(editBtn, "pencil");
            editBtn.onclick = () => this.editSelectedAgent();

            // Delete Button
            const deleteBtn = container.createDiv({ cls: "clickable-icon delete-icon", title: "Delete Agent" });
            setIcon(deleteBtn, "trash");
            deleteBtn.onclick = () => this.deleteSelectedAgent();
        }

        // Add Button
        const addBtn = container.createDiv({ cls: "clickable-icon add-icon", title: "Create New Agent" });
        setIcon(addBtn, "plus");
        addBtn.onclick = () => this.plugin.openAgentEditModal();
    }

    renderMessages() {
        this.resultEl.empty();
        if (this.messages.length === 0) {
            this.resultEl.createDiv({ cls: "message-system", text: "Start a conversation..." });
            return;
        }

        this.messages.forEach(msg => {
            if (msg.role === 'tool') {
                const msgEl = this.resultEl.createDiv({ cls: `chat-message message-system` });
                msgEl.createEl("div", { text: `🔧 Tool Result: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`, cls: "result-text" });
                return;
            }
            if (msg.tool_calls) {
                const msgEl = this.resultEl.createDiv({ cls: `chat-message message-system` });
                const toolNames = msg.tool_calls.map(tc => tc.function.name).join(", ");
                msgEl.createEl("div", { text: `🤖 Calling tools: ${toolNames}`, cls: "result-text" });
                return;
            }
            const msgEl = this.resultEl.createDiv({ cls: `chat-message message-${msg.role}` });
            msgEl.createEl("div", { text: msg.content, cls: "result-text" });
        });

        // Scroll to bottom
        this.resultEl.scrollTop = this.resultEl.scrollHeight;
    }

    clearChat() {
        this.messages = [];
        this.renderMessages();
    }

    editSelectedAgent() {
        if (!this.selectedAgentId) return;
        const agent = this.plugin.agentManager!.getAgent(this.selectedAgentId);
        if (agent) {
            const modal = new AgentEditModal(this.app, this.plugin, agent, (updated) => {
                this.plugin.agentManager!.updateAgent(updated);
                this.refresh();
                new Notice(`Agent "${updated.name}" updated.`);
            });
            modal.open();
        }
    }

    deleteSelectedAgent() {
        if (!this.selectedAgentId) return;
        const agent = this.plugin.agentManager!.getAgent(this.selectedAgentId);
        if (agent && confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
            this.plugin.agentManager!.deleteAgent(this.selectedAgentId);
            this.selectedAgentId = null;
            this.refresh();
            new Notice(`Agent "${agent.name}" deleted.`);
        }
    }

    refresh() {
        const agentRow = this.contentEl.querySelector(".agent-selection-row") as HTMLElement;
        if (agentRow) {
            this.renderAgentSelection(agentRow);
            this.render(); // Full re-render to handle potential state changes
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

        let model = agent.model;
        if (!model || model === 'llama3') {
            if (this.availableModels.length === 0) {
                await this.fetchModels();
            }
            if (this.availableModels.length > 0) {
                const fallback = this.availableModels.find(m => m.includes('llama3.2')) || this.availableModels[0];
                model = fallback!;
                new Notice(`Using fallback model: ${model}`);
            } else {
                model = 'llama3.2-latest';
                new Notice("No Ollama models detected. Attempting with llama3.2-latest...");
            }
        }

        const task = this.taskInput.getValue();
        if (!task.trim()) {
            return;
        }

        // Add user message to history
        this.messages.push({ role: 'user', content: task });
        this.taskInput.setValue("");
        this.renderMessages();

        const chatService = new ChatService(this.app, this.plugin);
        let loadingEl: HTMLDivElement | null = null;
        let statusEl: HTMLDivElement | null = null;

        try {
            const finalMessages = await chatService.chatWithTools(
                agent,
                this.messages,
                (update) => {
                    if (update.status === "loading") {
                        if (statusEl) {
                            statusEl.remove();
                            statusEl = null;
                        }
                        if (!loadingEl) {
                            loadingEl = this.resultEl.createDiv({ cls: "chat-message message-assistant loading", text: "..." });
                            this.resultEl.scrollTop = this.resultEl.scrollHeight;
                        }
                    } else if (update.status === "tool_running") {
                        if (loadingEl) {
                            loadingEl.remove();
                            loadingEl = null;
                        }
                        if (statusEl) statusEl.remove();
                        statusEl = this.resultEl.createDiv({ cls: "message-system", text: update.message });
                        this.resultEl.scrollTop = this.resultEl.scrollHeight;
                        this.renderMessages(); // Support intermediate rendering
                    } else if (update.status === "done" || update.status === "error") {
                        if (loadingEl) loadingEl.remove();
                        if (statusEl) statusEl.remove();
                        this.renderMessages();
                        if (update.status === "error" && update.message) {
                            new Notice(`Error: ${update.message}`);
                        }
                    }
                }
            );

            this.messages = finalMessages;
            this.renderMessages();
        } catch (error) {
            new Notice(`Chat Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
