// UI Elements
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const chatForm = document.getElementById('chat-form');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const statusDot = document.getElementById('status-dot');
const statusPing = document.getElementById('status-ping');
const modelSelect = document.getElementById('model-select');
const thinkingToggle = document.getElementById('thinking-toggle');
const reasoningSelect = document.getElementById('reasoning-select');
const activeModelDisplay = document.getElementById('current-active-model');
const fallbackChainDisplay = document.getElementById('fallback-chain-display');
const restartBtn = document.getElementById('restart-gateway-btn');

// State
let ws = null;
let isConnected = false;
let isThinkingEnabled = false;
let systemAgentConfig = null;

// Setup Marked.js with secure defaults
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false,
});

// Init WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        isConnected = true;
        statusDot.classList.replace('bg-red-500', 'bg-green-500');
        statusPing.classList.replace('bg-red-400', 'bg-green-400');
        statusPing.classList.remove('hidden');
        sendBtn.disabled = false;

        // Request models list upon connection
        ws.send(JSON.stringify({ type: 'message', text: '' }));
    };

    ws.onclose = () => {
        isConnected = false;
        statusDot.classList.replace('bg-green-500', 'bg-red-500');
        statusPing.classList.add('hidden');
        sendBtn.disabled = true;
        setTimeout(connectWebSocket, 3000); // Auto-reconnect
    };

    ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (err) {
            console.error('Failed to parse WS message', err);
        }
    };
}

// Message Handlers
function handleServerMessage(data) {
    if (data.type === 'models') {
        systemAgentConfig = data.agentConfig;
        populateModelDropdown(data.models);
        updateModelDisplay();
    } else if (data.type === 'message') {
        typingIndicator.classList.add('hidden');
        appendMessage(data.role, data.text);
    }
}

// UI Builders
function populateModelDropdown(models) {
    // Keep 'Auto' as first option
    modelSelect.innerHTML = '<option value="">Auto (Fallback Chain)</option>';
    let foundSavedModel = false;
    const savedModel = localStorage.getItem('wanda-selected-model');

    models.forEach(entry => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = `${entry.provider} (${entry.account})`;

        entry.models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = `${entry.provider}/${entry.account}/${model}`;
            opt.textContent = model;
            if (opt.value === savedModel) {
                opt.selected = true;
                foundSavedModel = true;
            }
            optGroup.appendChild(opt);
        });

        modelSelect.appendChild(optGroup);
    });

    // If the saved model parameter was removed or invalid, reset storage
    if (savedModel && !foundSavedModel) {
        localStorage.removeItem('wanda-selected-model');
    }
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Creates a message bubble. For assistant messages, uses the smooth writing animation.
 */
function appendMessage(role, text) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${isUser ? 'justify-end' : 'justify-start'} w-full msg-bubble-enter`;

    const bubble = document.createElement('div');
    bubble.className = isUser
        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 max-w-[85%] shadow-md'
        : 'bg-[#161b22] border border-[#30363d] rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-lg overflow-hidden';

    if (!isUser) {
        const header = document.createElement('div');
        header.className = 'text-xs text-indigo-400 font-semibold mb-1';
        header.textContent = 'Wanda';
        bubble.appendChild(header);
    }

    const content = document.createElement('div');
    content.className = isUser ? 'text-sm whitespace-pre-wrap' : 'prose prose-invert max-w-none text-sm leading-relaxed';

    bubble.appendChild(content);
    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);

    if (isUser) {
        content.textContent = text;
        scrollToBottom();
    } else {
        // --- Smooth Clean Writing Animation ---
        content.innerHTML = '<span class="streaming-cursor"></span>';
        const parsedHTML = marked.parse(text);

        // We simulate reading the parsed HTML into DOM nodes, 
        // then appending them character by character or word by word.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = parsedHTML;

        animateNodes(tempDiv.childNodes, content, () => {
            // Remove cursor when done
            const cursor = content.querySelector('.streaming-cursor');
            if (cursor) cursor.remove();
        });
    }
}

/**
 * Recursively animates DOM nodes to simulate smooth writing.
 */
async function animateNodes(nodes, container, onComplete) {
    const cursor = container.querySelector('.streaming-cursor');

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            // Split into words or chunks to animate smoothly
            const words = text.split(/(\s+)/);
            for (const word of words) {
                if (!word) continue;
                const span = document.createElement('span');
                span.className = 'message-stream-char';
                span.textContent = word;
                if (cursor) {
                    container.insertBefore(span, cursor);
                } else {
                    container.appendChild(span);
                }
                scrollToBottom();
                // Random MS between 5 to 30 for organic typing feel
                await new Promise(r => setTimeout(r, Math.random() * 25 + 5));
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Clone the tag structure but animate its inner contents
            const clonedNode = node.cloneNode(false); // shallow clone
            if (cursor) {
                container.insertBefore(clonedNode, cursor);
            } else {
                container.appendChild(clonedNode);
            }
            await animateNodes(node.childNodes, clonedNode, () => { });
        }
    }

    if (onComplete) onComplete();
}

// Event Listeners

// Thinking Toggle
thinkingToggle.addEventListener('click', () => {
    isThinkingEnabled = !isThinkingEnabled;
    if (isThinkingEnabled) {
        thinkingToggle.classList.add('active');
        reasoningSelect.disabled = false;
        reasoningSelect.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
    } else {
        thinkingToggle.classList.remove('active');
        reasoningSelect.disabled = true;
        reasoningSelect.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
    }
});

// Model Select Changes
function updateModelDisplay() {
    const val = modelSelect.value;
    activeModelDisplay.textContent = val ? val.split('/').pop() : 'Auto';

    // Persist selection
    if (val) {
        localStorage.setItem('wanda-selected-model', val);
    } else {
        localStorage.removeItem('wanda-selected-model');
    }

    // Show Agent Configuration Chain if Auto is selected
    if (!val && systemAgentConfig) {
        fallbackChainDisplay.classList.remove('hidden');
        const chain = [systemAgentConfig.primary, ...systemAgentConfig.fallbacks].join(' → ');
        fallbackChainDisplay.textContent = `Chain: ${chain}`;
        fallbackChainDisplay.title = chain; // Tooltip full view
    } else {
        fallbackChainDisplay.classList.add('hidden');
    }

    // Auto-enable reasoning toggles if o3, o1, or claude-3-7 is selected
    if (val.includes('o3-') || val.includes('o1-') || val.includes('claude-3-7') || val.includes('gemini-3')) {
        if (!isThinkingEnabled) thinkingToggle.click();
    } else {
        if (isThinkingEnabled) thinkingToggle.click();
    }
}

modelSelect.addEventListener('change', updateModelDisplay);

// Restart Gateway API
restartBtn.addEventListener('click', () => {
    if (!isConnected) return;
    if (confirm("Möchtest du das gesamte Wanda Gateway (Backend) neustarten?\\n\\nDadurch werden Konfigurationen und Accounts neu ins Memory geladen.")) {
        ws.send(JSON.stringify({ type: 'command', command: 'restart' }));
        appendMessage('user', 'Gateway Neustart angefordert...');
    }
});

// Chat Submit
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isConnected) return;

    const text = messageInput.value.trim();
    if (!text) return;

    // Build payload
    const payload = {
        type: 'message',
        text: text,
        config: {
            model: modelSelect.value || undefined,
            thinking: isThinkingEnabled,
            reasoning: isThinkingEnabled ? reasoningSelect.value : undefined
        }
    };

    // Send via WS
    ws.send(JSON.stringify(payload));

    // Local Echo
    appendMessage('user', text);
    messageInput.value = '';
    messageInput.style.height = 'auto'; // reset textarea height

    // Show typing state
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
});

// Auto-resizing textarea & Shift+Enter support
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.scrollHeight > 150) {
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
    }
});

// Boot
connectWebSocket();
