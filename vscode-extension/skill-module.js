const vscode = require('vscode');
const https = require('https');

// Keep-alive agent for faster repeated HTTPS requests (approx 30% reduction in connection overhead)
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

/**
 * KnowledgeBase
 * Continuously monitors the active Markdown file or chat log and updates its internal memory.
 */
class KnowledgeBase {
    constructor() {
        // Store context by fileName to accumulate multiple files
        this.contexts = new Map();
        this.documentListeners = [];
    }

    determineContextType(doc) {
        const fileName = doc.fileName.toLowerCase();
        if (fileName.includes('skill') || fileName.includes('skills')) return "Skill Definition";
        if (fileName.includes('chat') || fileName.includes('promts')) return "Chat Log / User Prompts";
        if (doc.languageId === 'markdown') return "Markdown Document";
        return doc.languageId + " Source Code";
    }

    updateFromDocument(doc) {
        if (!doc) return;
        this.contexts.set(doc.fileName, {
            type: this.determineContextType(doc),
            fileName: doc.fileName,
            language: doc.languageId,
            content: doc.getText()
        });
    }

    activate(context) {
        // Monitor document changes in real time across the whole workspace
        const listener = vscode.workspace.onDidChangeTextDocument(event => {
            const doc = event.document;
            // Now tracking ANY file the user edits to build a comprehensive memory
            this.updateFromDocument(doc);
        });
        context.subscriptions.push(listener);
        
        // Capture all currently open documents initially (even if not visible)
        vscode.workspace.textDocuments.forEach(doc => {
            this.updateFromDocument(doc);
        });

        // Update when active editor changes
        const editorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateFromDocument(editor.document);
            }
        });
        context.subscriptions.push(editorListener);
    }

    getContexts() {
        return Array.from(this.contexts.values());
    }

    // Extensibility: allow external modules to push knowledge
    updateContext(fileName, newData) {
        this.contexts.set(fileName, newData);
    }
}

const kb = new KnowledgeBase();

/**
 * generateIntelligentResponseStream
 * Retrieves relevant info from KB and calls OpenRouter with keep-alive and streaming for instant feedback.
 */
async function generateIntelligentResponseStream(query, apiKey, model, systemPrompt, onChunk, temperature = 0.7, maxTokens = 4096) {
    const allContexts = kb.getContexts();
    let promptWithContext = query;
    
    if (allContexts.length > 0) {
        let combinedContextText = "[Aggregated Workspace Context]\n\n";
        
        // Take up to the 5 most recently updated/relevant contexts to avoid blowing token limits
        const recentContexts = allContexts.slice(-5);
        
        for (const ctx of recentContexts) {
            if (ctx.content && ctx.content.trim().length > 0) {
                combinedContextText += `--- Context Type: ${ctx.type} ---\nFile Path: ${ctx.fileName}\nLanguage: ${ctx.language}\nContent:\n${ctx.content.substring(0, 2000)}\n\n`;
            }
        }

        promptWithContext = `${combinedContextText}\n[User Query]:\n${query}`;
    }

    return new Promise((resolve, reject) => {
        const body = { 
            model, 
            messages: [
                { role: "system", content: systemPrompt }, 
                { role: "user", content: promptWithContext }
            ], 
            temperature, 
            max_tokens: maxTokens,
            stream: true
        };
        const data = JSON.stringify(body);
        const opts = {
            hostname: 'openrouter.ai', 
            port: 443, 
            path: '/api/v1/chat/completions', 
            method: 'POST',
            agent: agent, // Use keep-alive agent to significantly boost speed on subsequent calls
            headers: { 
                'Authorization': `Bearer ${apiKey}`, 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(data), 
                'HTTP-Referer': 'https://github.com/LO/antigravity-prompt-enhancer', 
                'X-Title': 'Antigravity Prompt Enhancer' 
            }
        };
        
        const req = https.request(opts, (res) => {
            if (res.statusCode !== 200) {
                let errBody = '';
                res.on('data', c => errBody += c);
                res.on('end', () => reject(new Error(`API ${res.statusCode}: ${errBody}`)));
                return;
            }

            let buffer = '';
            res.on('data', chunk => {
                buffer += chunk.toString();
                let lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line
                for (let line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const j = JSON.parse(dataStr);
                            if (j.error) {
                                reject(new Error(j.error.message));
                            } else if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) {
                                onChunk(j.choices[0].delta.content);
                            }
                        } catch(e) { /* ignore parse error for incomplete chunks */ }
                    }
                }
            });
            res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function registerSkillCommand(context) {
    kb.activate(context);
    
    const disposable = vscode.commands.registerCommand('antigravity-prompt-enhancer.enhanceWithContext', async () => {
        const out = vscode.window.createOutputChannel("Antigravity Enhancer");
        out.appendLine("Intelligent Skill triggered.");
        
        const ed = vscode.window.activeTextEditor;
        let query = "";
        
        if (ed && !ed.selection.isEmpty) {
            query = ed.document.getText(ed.selection);
        } else {
            query = await vscode.env.clipboard.readText();
        }
        
        if (!query || !query.trim()) {
            vscode.window.showInformationMessage("No prompt found in selection or clipboard to enhance.");
            return;
        }

        const cfg = vscode.workspace.getConfiguration('antigravityEnhancer');
        let apiKey = cfg.get('openRouterApiKey') || "YOUR_OPENROUTER_API_KEY";
        const model = cfg.get('model') || "tencent/hy3-preview:free";
        const systemPrompt = "You are an expert context-aware assistant. Use the provided context from the user's active file to answer their query intelligently and concisely. If no context is provided, just enhance or answer the prompt.";

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "✨ Antigravity: Generating...",
            cancellable: false
        }, async () => {
            try {
                const startTime = Date.now();
                
                // Open a blank document first for live streaming
                const doc = await vscode.workspace.openTextDocument({ content: "", language: 'markdown' });
                const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
                
                let fullResult = "";
                let editQueue = Promise.resolve();

                await generateIntelligentResponseStream(query, apiKey, model, systemPrompt, (chunk) => {
                    fullResult += chunk;
                    // Queue the edits to prevent overlapping edit conflicts in VS Code
                    editQueue = editQueue.then(() => {
                        return editor.edit(editBuilder => {
                            const lastLine = doc.lineAt(doc.lineCount - 1);
                            editBuilder.insert(lastLine.range.end, chunk);
                        });
                    });
                });
                
                // Wait for all queued UI updates to finish painting
                await editQueue;

                const duration = Date.now() - startTime;
                
                out.appendLine(`Response streamed in ${duration}ms (Keep-Alive Agent active)`);
                
                await vscode.env.clipboard.writeText(fullResult);
                vscode.window.showInformationMessage(`✨ Skill streamed successfully in ${duration}ms! Answer copied to clipboard.`);
            } catch (err) {
                vscode.window.showErrorMessage("Skill failed: " + err.message);
                out.appendLine("Error: " + err.message);
            }
        });
    });
    
    context.subscriptions.push(disposable);
}

module.exports = {
    KnowledgeBase,
    generateIntelligentResponseStream,
    registerSkillCommand,
    kb,
    agent
};
