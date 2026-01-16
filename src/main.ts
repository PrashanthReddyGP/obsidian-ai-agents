import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, AIAgentsSettings, AIAgentsSettingTab, Agent } from "./settings";
import { AgentManager } from "./agent-manager";
import { ChatView, VIEW_TYPE_AI_AGENTS } from "./views/chat-view";
import { AgentEditModal } from "./modals/agent-edit-modal";

export default class AIAgentsPlugin extends Plugin {
	settings!: AIAgentsSettings;
	agentManager!: AgentManager;

	async onload() {
		await this.loadSettings();

		this.agentManager = new AgentManager(this);

		this.registerView(
			VIEW_TYPE_AI_AGENTS,
			(leaf) => new ChatView(leaf, this)
		);

		this.addRibbonIcon('bot', 'AI Agents', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-ai-agents-sidebar',
			name: 'Open AI Agents Sidebar',
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new AIAgentsSettingTab(this.app, this));
	}

	async onunload() {
		// Nothing to clean up specifically
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AIAgentsSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_AI_AGENTS);

		if (leaves.length > 0) {
			leaf = leaves[0] ?? null;
		} else {
			leaf = workspace.getRightLeaf(false) ?? null;
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_AI_AGENTS,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	openAgentEditModal(agent: Agent | null = null) {
		new AgentEditModal(this.app, this, agent, async (newAgent) => {
			if (agent) {
				await this.agentManager.updateAgent(newAgent);
			} else {
				await this.agentManager.createAgent(newAgent.name, newAgent.systemPrompt, newAgent.model);
			}

			// Refresh the view
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AI_AGENTS);
			for (const leaf of leaves) {
				if (leaf.view instanceof ChatView) {
					leaf.view.refresh();
				}
			}
		}).open();
	}
}
