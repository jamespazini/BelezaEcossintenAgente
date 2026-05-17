/**
 * Chat com Agente IA - Beleza Ecosystem
 * Interface de chat para interagir com o agente inteligente
 */

import { renderShell, getContentArea } from '../../../shared/components/shell/shell.js';
import { api } from '../../../shared/utils/http.js';
import { navigateTo } from '../../../core/router.js';

let isTyping = false;

export function render() {
    renderShell('ai-chat');
}

export async function init() {
    renderChatInterface();
    return () => {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('aiChatSendButton');
        const backButton = document.getElementById('backToAssistant');

        if (messageInput) {
            messageInput.replaceWith(messageInput.cloneNode(true));
        }
        if (sendButton) sendButton.removeEventListener('click', sendMessage);
        if (backButton) backButton.removeEventListener('click', handleBackNavigation);
    };
}

function renderChatInterface() {
    const c = getContentArea();
    if (!c) return;

    c.innerHTML = `
        <div class="ai-chat-container">
            <div class="ai-chat-header">
                <div class="ai-chat-header__info">
                    <div class="ai-chat-avatar"><i class="fas fa-robot"></i></div>
                    <div>
                        <h2 class="ai-chat-title">Assistente IA</h2>
                        <p class="ai-chat-subtitle">Converse com o agente para gerar ações e sugestões.</p>
                    </div>
                </div>
                <button id="backToAssistant" class="ai-chat-back-btn">Voltar</button>
            </div>

            <div class="ai-chat-messages" id="chatMessages">
                <div class="ai-message ai-message--ai">
                    <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="ai-message-content">
                        Olá! Estou pronto para ajudar. Envie uma mensagem e eu posso criar agendamentos, gerar relatórios ou sugerir ações.
                    </div>
                </div>
            </div>

            <div class="ai-chat-input-area">
                <div class="ai-chat-input-container">
                    <textarea id="messageInput" class="ai-chat-input" placeholder="Digite sua mensagem para o agente..." rows="1"></textarea>
                    <button id="aiChatSendButton" class="ai-chat-send-btn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="ai-chat-hint">
                    <small>Exemplo: "Crie um agendamento para Maria amanhã às 15h"</small>
                </div>
            </div>
        </div>
    `;

    setupEventListeners();
    scrollToBottom();
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('aiChatSendButton');

    if (!messageInput || !sendButton) return;

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        sendButton.disabled = !messageInput.value.trim();
    });

    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);

    const backButton = document.getElementById('backToAssistant');
    if (backButton) {
        backButton.addEventListener('click', handleBackNavigation);
    }
}

function handleBackNavigation() {
    navigateTo('/ai-assistant');
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const message = messageInput.value.trim();
    const sendButton = document.getElementById('aiChatSendButton');
    if (!message || isTyping || !sendButton) return;

    addMessage('user', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;
    showTypingIndicator();

    try {
        const establishmentId = localStorage.getItem('be_establishment_id') || '1';
        const response = await api.post('/ia', { message, establishmentId });

        hideTypingIndicator();

        if (response.success) {
            addMessage('ai', response.response || 'Resposta recebida, mas vazia.');
            if (response.actions && response.actions.length > 0) {
                response.actions.forEach((action) => {
                    addMessage('system', `${action.status === 'success' ? '✅' : '❌'} ${action.name}: ${action.result?.message || action.error || ''}`);
                });
            }
        } else {
            addMessage('ai', response.error || 'O agente retornou um erro inesperado.');
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('ai', 'Erro de conexão. Tente novamente mais tarde.');
        console.error('[AI CHAT] Erro ao enviar mensagem:', error);
    }
}

function addMessage(type, content) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-message--${type}`;

    if (type === 'ai') {
        messageDiv.innerHTML = `
            <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-message-content">${formatMessage(content)}</div>
        `;
    } else if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="ai-message-content ai-message-content--user">${formatMessage(content)}</div>
            <div class="ai-message-avatar ai-message-avatar--user"><i class="fas fa-user"></i></div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="ai-message-content ai-message-content--system">${formatMessage(content)}</div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function formatMessage(text) {
    return String(text).replace(/\n/g, '<br>');
}

function showTypingIndicator() {
    isTyping = true;
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'ai-message ai-message--ai';
    typingDiv.innerHTML = `
        <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
        <div class="ai-message-content">
            <div class="ai-typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    isTyping = false;
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) typingIndicator.remove();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
