document.addEventListener('DOMContentLoaded', () => {
  // Load existing settings
  chrome.storage.local.get(['apiKey', 'model', 'systemPrompt'], (data) => {
    if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
    if (data.model) document.getElementById('model').value = data.model;
    if (data.systemPrompt) document.getElementById('systemPrompt').value = data.systemPrompt;
  });

  // Save settings on button click
  document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value.trim();
    const systemPrompt = document.getElementById('systemPrompt').value.trim();
    
    chrome.storage.local.set({ apiKey, model, systemPrompt }, () => {
      const status = document.getElementById('status');
      status.style.display = 'block';
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    });
  });
});
