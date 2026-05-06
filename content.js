// content.js
function createEnhanceButton() {
    if (document.getElementById('antigravity-enhance-btn')) return;

    const btn = document.createElement('button');
    btn.innerText = '✨ Enhance';
    btn.id = 'antigravity-enhance-btn';
    btn.title = 'Enhance your prompt via OpenRouter';
    document.body.appendChild(btn);

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        btn.innerText = '...';
        btn.disabled = true;
        
        // Find the input element (Gemini uses rich-textarea)
        let richTextarea = document.querySelector('rich-textarea');
        let inputEl = null;
        
        if (richTextarea && richTextarea.shadowRoot) {
            inputEl = richTextarea.shadowRoot.querySelector('div[contenteditable="true"]');
        }
        
        if (!inputEl) {
            inputEl = document.querySelector('div[contenteditable="true"]') || document.activeElement;
        }
        
        let textToEnhance = "";
        const selection = window.getSelection();
        const selectedText = selection.toString();
        
        if (selectedText) {
            textToEnhance = selectedText;
        } else if (inputEl) {
            textToEnhance = inputEl.innerText || inputEl.value || "";
        }

        if (!textToEnhance || textToEnhance.trim() === "") {
            btn.innerText = '⚠️ Empty';
            setTimeout(resetBtn, 2000);
            return;
        }

        chrome.runtime.sendMessage({ action: "enhance", text: textToEnhance }, (response) => {
            if (response && response.error) {
                console.error("Enhancement error:", response.error);
                btn.innerText = '❌ Error';
                setTimeout(resetBtn, 3000);
            } else if (response && response.enhancedText) {
                const newText = response.enhancedText;
                
                if (selectedText) {
                    // Try to replace selection
                    try {
                        document.execCommand("insertText", false, newText);
                    } catch (err) {
                        navigator.clipboard.writeText(newText);
                    }
                } else if (inputEl) {
                    inputEl.focus();
                    try {
                        document.execCommand("selectAll", false, null);
                        document.execCommand("insertText", false, newText);
                    } catch (err) {
                        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
                            inputEl.value = newText;
                        } else {
                            inputEl.innerText = newText;
                        }
                    }
                }
                btn.innerText = '✅ Done';
                setTimeout(resetBtn, 2000);
            } else {
                resetBtn();
            }
        });
    });

    function resetBtn() {
        btn.innerText = '✨ Enhance';
        btn.disabled = false;
    }
}

// Polling to ensure button stays or appears when editor loads
setInterval(createEnhanceButton, 2000);
createEnhanceButton();
