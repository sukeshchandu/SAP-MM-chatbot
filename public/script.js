
if (!localStorage.getItem('sap_chat_session_id')) {
    localStorage.setItem('sap_chat_session_id', 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
}
const sessionId = localStorage.getItem('sap_chat_session_id');

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

async function sendMessage(overrideText = null) {
    const text = overrideText || userInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    if (!overrideText) userInput.value = '';

    
    showTyping(); 

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId: sessionId })
        });

        const data = await response.json();
        
       
        removeTyping(); 
        
        if (data.reply) {
            appendMessage(data.reply, 'ai');
        } else {
            appendMessage("Error: Could not retrieve response from backend.", 'ai');
        }
    } catch (error) {
       
        removeTyping(); 
        console.error("Communication error:", error);
        appendMessage("Error: Failed to connect to the server.", 'ai');
    }
}

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.innerHTML = marked.parse(text);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}


function showTyping() {
    const msgWrapper = document.createElement('div');
    msgWrapper.classList.add('message-wrapper');
    msgWrapper.id = 'typing-bubble'; 
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai', 'typing-indicator');
    msgDiv.textContent = 'Thinking...';
    
    msgWrapper.appendChild(msgDiv);
    chatMessages.appendChild(msgWrapper);
    
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}


function removeTyping() {
    const typingBubble = document.getElementById('typing-bubble');
    if (typingBubble) {
        typingBubble.remove();
    }
}