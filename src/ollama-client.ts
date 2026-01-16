import { Notice } from "obsidian";

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    message: ChatMessage;
    done: boolean;
}

export class OllamaClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async chat(model: string, messages: ChatMessage[]): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama error: ${error}`);
            }

            const data: OllamaResponse = await response.json();
            return data.message.content;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`Error connecting to Ollama: ${message}`);
            throw error;
        }
    }

    async listModels(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) throw new Error("Failed to fetch models");
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error("Error listing models:", error);
            return [];
        }
    }

    async getModelDetails(model: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: model })
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error("Error getting model details:", error);
            return null;
        }
    }
}
