const vscode = require('vscode');
const https = require('https');
const fs = require('fs');
const path = require('path');
const skillModule = require('./skill-module.js');

function activate(context) {
    const out = vscode.window.createOutputChannel("Antigravity Enhancer");
    out.appendLine("Antigravity Enhancer activated.");

    // Initialize the new skill module
    skillModule.registerSkillCommand(context);

    // Status bar
    let sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    sb.command = 'antigravity-prompt-enhancer.enhanceSelection';
    sb.text = "$(sparkle) Enhance Prompt";
    sb.tooltip = "Enhance selected text or clipboard via OpenRouter";
    sb.show();
    context.subscriptions.push(sb, out);

    const updateSB = () => {
        const ed = vscode.window.activeTextEditor;
        if (ed && !ed.selection.isEmpty) {
            sb.text = "$(sparkle) Enhance Selection";
            sb.command = 'antigravity-prompt-enhancer.enhanceSelection';
        } else {
            sb.text = "$(lightbulb-autofix) Enhance Clipboard";
            sb.command = 'antigravity-prompt-enhancer.enhanceClipboard';
        }
    };
    vscode.window.onDidChangeTextEditorSelection(updateSB, null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(updateSB, null, context.subscriptions);

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-prompt-enhancer.enhanceClipboard', async () => {
            out.appendLine("Enhance Clipboard triggered.");
            const text = await vscode.env.clipboard.readText();
            if (!text || !text.trim()) { vscode.window.showInformationMessage('Clipboard is empty!'); return; }
            await runEnhancement(text, out);
        }),
        vscode.commands.registerCommand('antigravity-prompt-enhancer.enhanceSelection', async () => {
            out.appendLine("Enhance Selection triggered.");
            const ed = vscode.window.activeTextEditor;
            if (!ed) { vscode.window.showErrorMessage('No active editor!'); return; }
            const text = ed.document.getText(ed.selection);
            if (!text || !text.trim()) {
                vscode.commands.executeCommand('antigravity-prompt-enhancer.enhanceClipboard');
                return;
            }
            await runEnhancement(text, out);
        }),
        vscode.commands.registerCommand('antigravity-prompt-enhancer.openSettingsUI', () => {
            SettingsPanel.createOrShow(context);
        })
    );
}

async function runEnhancement(text, out) {
    const cfg = vscode.workspace.getConfiguration('antigravityEnhancer');
    let apiKey = cfg.get('openRouterApiKey');
    const model = cfg.get('model') || "tencent/hy3-preview:free";
    const systemPrompt = cfg.get('systemPrompt') || '';
    const temperature = cfg.get('temperature') ?? 0.7;
    const maxTokens = cfg.get('maxTokens') ?? 4096;
    const topP = cfg.get('topP') ?? 1;
    const freqPenalty = cfg.get('frequencyPenalty') ?? 0;

    if (!apiKey || !apiKey.trim()) {
        apiKey = "YOUR_OPENROUTER_API_KEY";
    }
    out.appendLine(`Model: ${model} | Temp: ${temperature} | MaxTok: ${maxTokens}`);

    try {
        const enhanced = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Enhancing with Antigravity...",
            cancellable: false
        }, () => callOpenRouter(apiKey, model, systemPrompt, text, temperature, maxTokens, topP, freqPenalty));

        await vscode.env.clipboard.writeText(enhanced);
        const doc = await vscode.workspace.openTextDocument({ content: enhanced, language: 'markdown' });
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
        vscode.window.showInformationMessage('✨ Enhanced! Copied to clipboard & shown in preview.');
    } catch (err) {
        out.appendLine(`Error: ${err.message}`);
        vscode.window.showErrorMessage('Enhancement failed: ' + err.message);
    }
}

function callOpenRouter(apiKey, model, systemPrompt, userText, temperature, maxTokens, topP, freqPenalty) {
    return new Promise((resolve, reject) => {
        const body = { model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }], temperature, max_tokens: maxTokens, top_p: topP, frequency_penalty: freqPenalty };
        const data = JSON.stringify(body);
        const opts = {
            hostname: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions', method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'HTTP-Referer': 'https://github.com/LO/antigravity-prompt-enhancer', 'X-Title': 'Antigravity Prompt Enhancer' }
        };
        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) { reject(new Error(`API ${res.statusCode}: ${body}`)); return; }
                    const j = JSON.parse(body);
                    if (j.error) reject(new Error(j.error.message));
                    else if (j.choices) resolve(j.choices[0].message.content);
                    else reject(new Error('Unexpected response'));
                } catch (e) { reject(new Error('Parse failed: ' + body)); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

class SettingsPanel {
    static currentPanel;
    static createOrShow(context) {
        if (SettingsPanel.currentPanel) { SettingsPanel.currentPanel._panel.reveal(); return; }
        const panel = vscode.window.createWebviewPanel('antigravitySettings', '⚙️ Antigravity Settings', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        SettingsPanel.currentPanel = new SettingsPanel(panel, context);
    }
    constructor(panel, context) {
        this._panel = panel;
        this._context = context;
        const htmlPath = path.join(context.extensionPath, 'settings.html');
        this._panel.webview.html = fs.readFileSync(htmlPath, 'utf8');
        this._panel.onDidDispose(() => { SettingsPanel.currentPanel = undefined; });
        const webview = this._panel.webview;
        webview.onDidReceiveMessage(async (msg) => {
            try {
                const cfg = vscode.workspace.getConfiguration('antigravityEnhancer');
                if (msg.command === 'saveSettings') {
                    await cfg.update('openRouterApiKey', msg.apiKey, vscode.ConfigurationTarget.Global);
                    await cfg.update('model', msg.model, vscode.ConfigurationTarget.Global);
                    await cfg.update('systemPrompt', msg.systemPrompt, vscode.ConfigurationTarget.Global);
                    await cfg.update('temperature', msg.temperature, vscode.ConfigurationTarget.Global);
                    await cfg.update('maxTokens', msg.maxTokens, vscode.ConfigurationTarget.Global);
                    await cfg.update('topP', msg.topP, vscode.ConfigurationTarget.Global);
                    await cfg.update('frequencyPenalty', msg.freqPenalty, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('✅ Settings saved!');
                } else if (msg.command === 'loadSettings') {
                    await webview.postMessage({
                        command: 'settingsData',
                        apiKey: cfg.get('openRouterApiKey') || '',
                        model: cfg.get('model') || 'tencent/hy3-preview:free',
                        systemPrompt: cfg.get('systemPrompt') || '',
                        temperature: cfg.get('temperature') ?? 0.7,
                        maxTokens: cfg.get('maxTokens') ?? 4096,
                        topP: cfg.get('topP') ?? 1,
                        freqPenalty: cfg.get('frequencyPenalty') ?? 0
                    });
                } else if (msg.command === 'chatMessage') {
                    let apiKey = cfg.get('openRouterApiKey');
                    const model = cfg.get('model') || 'tencent/hy3-preview:free';
                    const systemPrompt = cfg.get('systemPrompt') || '';
                    const temperature = cfg.get('temperature') ?? 0.7;
                    const maxTokens = cfg.get('maxTokens') ?? 4096;
                    const topP = cfg.get('topP') ?? 1;
                    const freqPenalty = cfg.get('frequencyPenalty') ?? 0;
                    if (!apiKey || !apiKey.trim()) {
                        apiKey = 'YOUR_OPENROUTER_API_KEY';
                    }
                    vscode.window.setStatusBarMessage('💬 Chat: calling ' + model + '...', 10000);
                    
                    // Let's create an output channel if it doesn't exist just to be safe
                    const out = vscode.window.createOutputChannel("Antigravity Enhancer");
                    out.show(true);
                    out.appendLine("--- NEW CHAT MESSAGE ---");
                    out.appendLine("Model: " + model);
                    
                    const messages = [{ role: 'system', content: systemPrompt }];
                    if (msg.history && msg.history.length > 0) {
                        messages.push(...msg.history);
                    }
                    messages.push({ role: 'user', content: msg.text });
                    out.appendLine("Message count: " + messages.length);
                    
                    try {
                        let fullResponse = '';
                        await callOpenRouterChat(apiKey, model, messages, temperature, maxTokens, topP, freqPenalty, (chunk) => {
                            fullResponse += chunk;
                            webview.postMessage({ command: 'chatChunk', text: chunk });
                        });
                        out.appendLine("Stream completed successfully! Length: " + fullResponse.length);
                        vscode.window.setStatusBarMessage('💬 Chat: response complete!', 3000);
                        await webview.postMessage({ command: 'chatDone' });
                    } catch (chatErr) {
                        out.appendLine("CHAT API ERROR: " + chatErr.message);
                        vscode.window.showErrorMessage('💬 Chat API Error: ' + chatErr.message);
                        await webview.postMessage({ command: 'chatError', text: chatErr.message });
                    }
                } else if (msg.command === 'copyToClipboard') {
                    await vscode.env.clipboard.writeText(msg.text);
                    vscode.window.showInformationMessage('📋 Copied to clipboard!');
                } else if (msg.command === 'getSelection') {
                    const ed = vscode.window.activeTextEditor;
                    const text = ed ? ed.document.getText(ed.selection) : '';
                    if (text && text.trim()) {
                        await webview.postMessage({ command: 'chatChunk', text: '📥 Injected selection:\n' + text });
                        await webview.postMessage({ command: 'chatDone' });
                    } else {
                        await webview.postMessage({ command: 'chatError', text: 'No text selected in editor' });
                    }
                }
            } catch (err) {
                const out = vscode.window.createOutputChannel("Antigravity Enhancer");
                out.appendLine("CRITICAL HANDLER ERROR: " + err.message);
                vscode.window.showErrorMessage('💬 Critical Error: ' + err.message);
                try { await webview.postMessage({ command: 'chatError', text: err.message }); } catch(e) {}
            }
        });
    }
}

function callOpenRouterChat(apiKey, model, messages, temperature, maxTokens, topP, freqPenalty, onChunk) {
    const out = vscode.window.createOutputChannel("Antigravity Enhancer");
    return new Promise((resolve, reject) => {
        const body = { model, messages, temperature, max_tokens: maxTokens, top_p: topP, frequency_penalty: freqPenalty, stream: true };
        const data = JSON.stringify(body);
        const opts = {
            hostname: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions', method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'HTTP-Referer': 'https://github.com/LO/antigravity-prompt-enhancer', 'X-Title': 'Antigravity Prompt Enhancer' }
        };
        out.appendLine("Initiating streaming HTTPS request to openrouter.ai...");
        const req = https.request(opts, (res) => {
            if (res.statusCode !== 200) {
                let errBody = '';
                res.on('data', c => errBody += c);
                res.on('end', () => {
                    out.appendLine('API Error Body: ' + errBody.substring(0, 500));
                    reject(new Error(`API ${res.statusCode}: ${errBody.substring(0, 200)}`));
                });
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
            res.on('end', () => {
                resolve();
            });
        });
        req.setTimeout(60000, () => { 
            out.appendLine('Request timed out after 60s');
            req.destroy(); 
            reject(new Error('Request timed out after 60s')); 
        });
        req.on('error', (e) => { 
            out.appendLine('Network Request error: ' + e.message);
            reject(e); 
        });
        req.write(data);
        req.end();
    });
}

function deactivate() {}
module.exports = { activate, deactivate };
