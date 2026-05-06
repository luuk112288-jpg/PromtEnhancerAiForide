chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "enhance") {
      chrome.storage.local.get(['apiKey', 'model', 'systemPrompt'], async (data) => {
          if (!data.apiKey) {
              sendResponse({ error: "API Key not set. Click the extension icon to set it." });
              return;
          }
          
          const model = data.model || "openai/gpt-3.5-turbo";
          const systemPrompt = data.systemPrompt || "You are a prompt engineering expert. Refine the user's input prompt (ytring) to be specific, add output format rules, and optimize for Google Gemini (Antigravity). Return only the enhanced prompt, no extra commentary.";
          
          try {
              const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                      "Authorization": `Bearer ${data.apiKey}`,
                      "Content-Type": "application/json",
                      "HTTP-Referer": "https://github.com/LO/antigravity-prompt-enhancer",
                      "X-Title": "Antigravity Prompt Enhancer"
                  },
                  body: JSON.stringify({
                      model: model,
                      messages: [
                          { role: "system", content: systemPrompt },
                          { role: "user", content: request.text }
                      ]
                  })
              });
              
              const json = await res.json();
              if (json.error) {
                  sendResponse({ error: json.error.message || JSON.stringify(json.error) });
              } else if (json.choices && json.choices.length > 0) {
                  sendResponse({ enhancedText: json.choices[0].message.content });
              } else {
                  sendResponse({ error: "Unexpected API response format." });
              }
          } catch (err) {
              sendResponse({ error: err.message });
          }
      });
      return true; // Keep the message channel open for async response
  }
});
