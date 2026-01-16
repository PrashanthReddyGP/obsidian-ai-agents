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
                        model
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
