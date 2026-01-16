import { App, Modal, Setting, ButtonComponent, TextAreaComponent } from "obsidian";

export type PromptType = "choice" | "text";

export class PromptModal extends Modal {
    question: string;
    type: PromptType;
    options: string[];
    onSubmit: (result: string) => void;

    constructor(app: App, question: string, type: PromptType, options: string[], onSubmit: (result: string) => void) {
        super(app);
        this.question = question;
        this.type = type;
        this.options = options;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Agent Question" });
        contentEl.createDiv({ text: this.question, cls: "prompt-question" });

        if (this.type === "choice") {
            const btnContainer = contentEl.createDiv({ cls: "prompt-button-container" });
            this.options.forEach(option => {
                new ButtonComponent(btnContainer)
                    .setButtonText(option)
                    .onClick(() => {
                        this.onSubmit(option);
                        this.close();
                    });
            });
        } else {
            let value = "";
            new Setting(contentEl)
                .addTextArea(text => text
                    .setPlaceholder("Type your response...")
                    .onChange(v => value = v));

            new Setting(contentEl)
                .addButton(btn => btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        this.onSubmit(value);
                        this.close();
                    }));
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
