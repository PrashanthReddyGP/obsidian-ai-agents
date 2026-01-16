import { App, Modal, Setting, Notice, setIcon } from "obsidian";
import AIAgentsPlugin from "../main";
import { Agent } from "../settings";
import { OllamaClient } from "../ollama-client";

export class AgentEditModal extends Modal {
    plugin: AIAgentsPlugin;
    agent: Agent | null;
    onSubmit: (agent: Agent) => void;
    ollama: OllamaClient;

    constructor(app: App, plugin: AIAgentsPlugin, agent: Agent | null, onSubmit: (agent: Agent) => void) {
        super(app);
        this.plugin = plugin;
        this.agent = agent;
        this.onSubmit = onSubmit;
        this.ollama = new OllamaClient(this.plugin.settings.ollamaUrl);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: this.agent ? "Edit Agent" : "Create Agent" });

        let name = this.agent?.name || "";
        let systemPrompt = this.agent?.systemPrompt || "";
        let model = this.agent?.model || "";

        new Setting(contentEl)
            .setName("Name")
            .addText(text => text
                .setValue(name)
                .onChange(value => name = value));

        if (this.agent) {
            new Setting(contentEl)
                .setName("Agent ID")
                .setDesc("Use this ID to call this agent from other agents.")
                .addText(text => text
                    .setValue(this.agent!.id)
                    .setDisabled(true)
                    .inputEl.addClass("agent-id-readonly"));
        }

        const modelSetting = new Setting(contentEl)
            .setName("Model")
            .setDesc("Select an Ollama model");

        const capabilityContainer = modelSetting.descEl.createDiv({ cls: "model-capabilities" });

        const updateCapabilities = async (modelName: string) => {
            capabilityContainer.empty();
            if (!modelName) return;

            const details = await this.ollama.getModelDetails(modelName);
            if (!details) return;

            const families = details.details?.families || [];
            if (families.includes('vision')) {
                const span = capabilityContainer.createSpan({ cls: "cap-icon", title: "Vision" });
                setIcon(span, "eye");
                span.createSpan({ text: "Vision" });
            }
            if (details.modelfile?.includes('tools') || details.template?.includes('tool')) {
                const span = capabilityContainer.createSpan({ cls: "cap-icon", title: "Tools" });
                setIcon(span, "wrench");
                span.createSpan({ text: "Tools" });
            }
            if (modelName.toLowerCase().includes('r1') || modelName.toLowerCase().includes('thought')) {
                const span = capabilityContainer.createSpan({ cls: "cap-icon", title: "Thinking" });
                setIcon(span, "brain");
                span.createSpan({ text: "Thinking" });
            }
        };

        this.ollama.listModels().then(models => {
            modelSetting.addDropdown(dropdown => {
                if (models.length === 0) {
                    dropdown.addOption("", "No models found");
                } else {
                    models.forEach(m => {
                        dropdown.addOption(m.name, m.name);
                    });
                }

                if (model && models.find(m => m.name === model)) {
                    dropdown.setValue(model);
                } else if (models.length > 0) {
                    model = models[0].name;
                    dropdown.setValue(model);
                }

                updateCapabilities(model);

                dropdown.onChange(async (value) => {
                    model = value;
                    await updateCapabilities(value);
                });
            });
        });

        new Setting(contentEl)
            .setName("System Prompt")
            .setDesc("The personality and instructions for this agent.")
            .addTextArea(text => text
                .setValue(systemPrompt)
                .onChange(value => systemPrompt = value));

        contentEl.createEl("h3", { text: "Permissions & Tools" });

        let enabledTools = this.agent?.enabledTools || ['get_current_time', 'read_vault_file', 'call_agent'];
        let allowedPaths = this.agent?.allowedPaths || "";

        const tools = [
            { id: 'get_current_time', name: 'Current Time', desc: 'Allow getting current date/time' },
            { id: 'read_vault_file', name: 'Read Vault', desc: 'Allow reading files from vault' },
            { id: 'call_agent', name: 'Agent Orchestration', desc: 'Allow calling other agents' }
        ];

        tools.forEach(tool => {
            new Setting(contentEl)
                .setName(tool.name)
                .setDesc(tool.desc)
                .addToggle(toggle => toggle
                    .setValue(enabledTools.includes(tool.id))
                    .onChange(value => {
                        if (value) {
                            if (!enabledTools.includes(tool.id)) enabledTools.push(tool.id);
                        } else {
                            enabledTools = enabledTools.filter(id => id !== tool.id);
                        }
                    }));
        });

        new Setting(contentEl)
            .setName("Allowed Paths")
            .setDesc("Comma-separated list of folders or files this agent can access (e.g. 'Project A, Journal/Daily'). Leave empty for all.")
            .addTextArea(text => text
                .setPlaceholder("e.g. Folder1, Note.md")
                .setValue(allowedPaths)
                .onChange(value => allowedPaths = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    if (!name.trim()) {
                        new Notice("Name is required.");
                        return;
                    }
                    if (!model) {
                        new Notice("Model is required.");
                        return;
                    }
                    const newAgent: Agent = {
                        id: this.agent?.id || Date.now().toString(),
                        name,
                        systemPrompt,
                        model,
                        enabledTools,
                        allowedPaths
                    };
                    this.onSubmit(newAgent);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
