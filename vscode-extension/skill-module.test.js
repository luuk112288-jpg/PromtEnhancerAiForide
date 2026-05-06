const assert = require('assert');
const { KnowledgeBase, kb, agent } = require('./skill-module.js');

// Mock vscode API for testing
const mockContext = {
    subscriptions: []
};

// Mock document events
let textDocumentChangeListeners = [];
const mockVscode = {
    workspace: {
        onDidChangeTextDocument: (listener) => {
            textDocumentChangeListeners.push(listener);
            return { dispose: () => {} };
        }
    },
    window: {
        activeTextEditor: null
    }
};

describe('Skill Module Tests', function() {
    this.timeout(10000);

    it('should initialize and update the KnowledgeBase dynamically when MD files change', () => {
        // Mock the global vscode object locally for this test or inject dependencies
        const testKb = new KnowledgeBase();
        
        // Simulate a document change
        testKb.updateFromDocument({
            languageId: 'markdown',
            fileName: 'SKILL.md',
            getText: () => 'This is updated real-time knowledge.'
        });

        const contexts = testKb.getContexts();
        assert.strictEqual(Array.isArray(contexts), true);
        assert.strictEqual(contexts.length, 1);
        
        const contextInfo = contexts[0];
        assert.strictEqual(typeof contextInfo, 'object');
        assert.strictEqual(contextInfo.type, 'Skill Definition');
        assert.strictEqual(contextInfo.fileName, 'SKILL.md');
        assert.strictEqual(contextInfo.content, 'This is updated real-time knowledge.');
    });

    it('should use Keep-Alive Agent for performance improvement', () => {
        // Assert that the agent is using keep-alive which prevents connection setup overhead 
        // on subsequent calls, aiming for 30%+ reduction in response time.
        assert.strictEqual(agent.options.keepAlive, true);
        assert.strictEqual(agent.options.maxSockets, 10);
    });
});
