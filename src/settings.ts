import { App, PluginSettingTab, Setting } from "obsidian";
import AIAgentsPlugin from "./main";

export interface Agent {
	id: string;
	name: string;
	systemPrompt: string;
	model: string;
	enabledTools?: string[];
	allowedPaths?: string;
}

export interface AIAgentsSettings {
	agents: Agent[];
	ollamaUrl: string;
}

export const DEFAULT_SETTINGS: AIAgentsSettings = {
	agents: [
		{
			id: 'default-assistant',
			name: 'General Assistant',
			systemPrompt: 'You are a helpful AI assistant.',
			model: 'llama3.2-latest',
			enabledTools: ['get_current_time', 'read_vault_file', 'call_agent', 'send_notification', 'ask_user'],
			allowedPaths: ''
		}
	],
	ollamaUrl: 'http://localhost:11434'
}

export class AIAgentsSettingTab extends PluginSettingTab {
	plugin: AIAgentsPlugin;

	constructor(app: App, plugin: AIAgentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Ollama URL')
			.setDesc('The URL where your Ollama instance is running.')
			.addText(text => text
				.setPlaceholder('http://localhost:11434')
				.setValue(this.plugin.settings.ollamaUrl)
				.onChange(async (value) => {
					this.plugin.settings.ollamaUrl = value;
					await this.plugin.saveSettings();
				}));
	}
}
