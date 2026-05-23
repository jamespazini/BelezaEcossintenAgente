/**
 * WhatsApp Messaging Page
 */

import { renderShell, getContentArea } from '../../../shared/components/shell/shell.js';
import { api } from '../../../shared/utils/http.js';
import { showToast } from '../../../shared/utils/toast.js';
import { formatDate } from '../../../shared/utils/validation.js';

let conversations = [];
let currentSessionId = null;
let currentMessages = [];
let isLoading = false;
let isLoadingMessages = false;
let pollingInterval = null;

export function render() {
    renderShell('whatsapp');
}

export async function init() {
    // Inject styles
    if (!document.getElementById('whatsapp-styles')) {
        const link = document.createElement('link');
        link.id = 'whatsapp-styles';
        link.rel = 'stylesheet';
        link.href = '/src/features/whatsapp/styles/whatsapp.css';
        document.head.appendChild(link);
    }

    await loadConversations();
    renderPage();
    startPolling();

    return () => {
        stopPolling();
        conversations = [];
        currentSessionId = null;
        currentMessages = [];
    };
}

async function loadConversations() {
    isLoading = true;
    try {
        const res = await api.get('/whatsapp/conversations');
        if (res.success && res.data) {
            conversations = res.data.data || [];
        }
    } catch (err) {
        console.error('[WhatsApp] Erro ao carregar conversas:', err);
        showToast('Erro ao carregar conversas', 'error');
    } finally {
        isLoading = false;
    }
}

async function loadMessages(sessionId) {
    isLoadingMessages = true;
    renderChatArea();
    try {
        const res = await api.get(`/whatsapp/conversations/${sessionId}/messages`);
        if (res.success && res.data) {
            currentMessages = res.data.data || [];
        }
    } catch (err) {
        console.error('[WhatsApp] Erro ao carregar mensagens:', err);
        showToast('Erro ao carregar mensagens', 'error');
    } finally {
        isLoadingMessages = false;
        renderChatArea();
        scrollToBottom();
    }
}

async function sendMessage(body) {
    if (!body.trim() || !currentSessionId) return;

    const inputEl = document.getElementById('wa-msg-input');
    const sendBtn = document.getElementById('wa-btn-send');
    if (inputEl) inputEl.value = '';
    if (sendBtn) sendBtn.disabled = true;

    // Adiciona msg temporária para feedback imediato
    const tempMsg = {
        id: 'temp-' + Date.now(),
        direction: 'OUTBOUND',
        body: body,
        status: 'queued',
        created_at: new Date().toISOString()
    };
    currentMessages.push(tempMsg);
    renderChatArea();
    scrollToBottom();

    try {
        const res = await api.post('/whatsapp/send', {
            sessionId: currentSessionId,
            body: body
        });
        
        if (res.success) {
            // Recarrega mensagens reais
            await loadMessages(currentSessionId);
        } else {
            showToast(res.message || 'Erro ao enviar mensagem', 'error');
            // Remove a mensagem temporária em caso de erro
            currentMessages = currentMessages.filter(m => m.id !== tempMsg.id);
            renderChatArea();
        }
    } catch (err) {
        console.error('[WhatsApp] Erro ao enviar mensagem:', err);
        showToast('Erro de conexão', 'error');
        currentMessages = currentMessages.filter(m => m.id !== tempMsg.id);
        renderChatArea();
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        if (inputEl) inputEl.focus();
    }
}

function startPolling() {
    stopPolling(); // Evita múltiplos intervalos
    pollingInterval = setInterval(async () => {
        // Atualiza a lista de conversas
        const prevConvs = JSON.stringify(conversations);
        await loadConversations();
        if (JSON.stringify(conversations) !== prevConvs) {
            renderSidebar();
        }

        // Se houver uma conversa aberta, atualiza as mensagens
        if (currentSessionId) {
            const prevMsgsLength = currentMessages.length;
            const res = await api.get(`/whatsapp/conversations/${currentSessionId}/messages`);
            if (res.success && res.data) {
                const newMsgs = res.data.data || [];
                if (newMsgs.length !== prevMsgsLength || newMsgs[newMsgs.length-1]?.status !== currentMessages[currentMessages.length-1]?.status) {
                    currentMessages = newMsgs;
                    renderChatArea();
                    if (newMsgs.length > prevMsgsLength) scrollToBottom();
                }
            }
        }
    }, 10000); // Polling a cada 10s
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function selectConversation(sessionId) {
    currentSessionId = sessionId;
    renderSidebar(); // Update active state
    loadMessages(sessionId);
    
    // Mobile view handling
    const chatArea = document.getElementById('wa-chat-area');
    if (chatArea && window.innerWidth <= 768) {
        chatArea.classList.add('active');
    }
}

function backToList() {
    currentSessionId = null;
    const chatArea = document.getElementById('wa-chat-area');
    if (chatArea) {
        chatArea.classList.remove('active');
    }
    renderSidebar();
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function renderPage() {
    const content = getContentArea();
    if (!content) return;

    content.innerHTML = `
        <div class="whatsapp-container">
            <div class="whatsapp-sidebar" id="wa-sidebar">
                <!-- Preenchido dinamicamente -->
            </div>
            <div class="whatsapp-chat-area" id="wa-chat-area">
                <!-- Preenchido dinamicamente -->
            </div>
        </div>
    `;

    renderSidebar();
    renderChatArea();
    bindEvents();
}

function renderSidebar() {
    const sidebar = document.getElementById('wa-sidebar');
    if (!sidebar) return;

    if (isLoading && conversations.length === 0) {
        sidebar.innerHTML = `
            <div class="whatsapp-sidebar-header">
                <h2>Mensagens</h2>
            </div>
            <div class="whatsapp-loading">
                <div class="spinner"></div>
            </div>
        `;
        return;
    }

    const conversationsHtml = conversations.map(conv => {
        const name = conv.client ? `${conv.client.first_name || ''} ${conv.client.last_name || ''}`.trim() : conv.customer_number;
        const initial = name.charAt(0).toUpperCase();
        const isActive = conv.id === currentSessionId;
        const time = new Date(conv.last_interaction_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let contextMsg = 'Nova conversa';
        if (conv.session_context && conv.session_context.last_message) {
            contextMsg = conv.session_context.last_message;
        }

        return `
            <div class="whatsapp-conv-item ${isActive ? 'active' : ''}" data-session-id="${conv.id}">
                <div class="whatsapp-avatar">${initial}</div>
                <div class="whatsapp-conv-details">
                    <div class="whatsapp-conv-header">
                        <span class="whatsapp-conv-name">${name}</span>
                        <span class="whatsapp-conv-time">${time}</span>
                    </div>
                    <div class="whatsapp-conv-last-msg">${contextMsg}</div>
                </div>
            </div>
        `;
    }).join('');

    sidebar.innerHTML = `
        <div class="whatsapp-sidebar-header">
            <h2>Mensagens</h2>
            <button class="btn-icon" title="Nova Conversa" onclick="window.alert('Feature de iniciar nova conversa em breve')">
                <i class="fas fa-edit"></i>
            </button>
        </div>
        <div class="whatsapp-search">
            <input type="text" placeholder="Buscar cliente ou número..." disabled title="Busca em breve">
        </div>
        <div class="whatsapp-conversations">
            ${conversations.length > 0 ? conversationsHtml : '<div style="padding: 2rem; text-align: center; color: #888;">Nenhuma conversa encontrada.</div>'}
        </div>
    `;

    // Re-bind sidebar events
    sidebar.querySelectorAll('.whatsapp-conv-item').forEach(item => {
        item.addEventListener('click', () => {
            selectConversation(item.dataset.sessionId);
        });
    });
}

function renderChatArea() {
    const chatArea = document.getElementById('wa-chat-area');
    if (!chatArea) return;

    if (!currentSessionId) {
        chatArea.innerHTML = `
            <div class="whatsapp-empty-state">
                <i class="fab fa-whatsapp"></i>
                <h3>Beleza Ecosystem Messaging</h3>
                <p>Selecione uma conversa ao lado para visualizar as mensagens e responder aos seus clientes.</p>
            </div>
        `;
        return;
    }

    const session = conversations.find(c => c.id === currentSessionId);
    if (!session) return;

    const name = session.client ? `${session.client.first_name || ''} ${session.client.last_name || ''}`.trim() : session.customer_number;
    const initial = name.charAt(0).toUpperCase();
    const phone = session.client?.phone || session.customer_number;

    let bodyHtml = '';

    if (isLoadingMessages && currentMessages.length === 0) {
        bodyHtml = `
            <div class="whatsapp-loading">
                <div class="spinner"></div>
            </div>
        `;
    } else {
        bodyHtml = `
            <div class="whatsapp-messages" id="wa-messages-list">
                ${currentMessages.map(msg => {
                    const isInbound = msg.direction === 'INBOUND';
                    const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    
                    let statusIcon = '';
                    if (!isInbound) {
                        if (msg.status === 'read') statusIcon = '<i class="fas fa-check-double whatsapp-msg-status read"></i>';
                        else if (msg.status === 'delivered') statusIcon = '<i class="fas fa-check-double whatsapp-msg-status delivered"></i>';
                        else if (msg.status === 'sent') statusIcon = '<i class="fas fa-check whatsapp-msg-status sent"></i>';
                        else if (msg.status === 'failed') statusIcon = '<i class="fas fa-exclamation-circle whatsapp-msg-status failed"></i>';
                        else statusIcon = '<i class="far fa-clock whatsapp-msg-status"></i>';
                    }

                    return `
                        <div class="whatsapp-msg whatsapp-msg--${isInbound ? 'inbound' : 'outbound'}">
                            <div class="whatsapp-msg-content">${escapeHTML(msg.body)}</div>
                            <div class="whatsapp-msg-meta">
                                <span>${time}</span>
                                ${statusIcon}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    chatArea.innerHTML = `
        <div class="whatsapp-chat-header">
            <button class="whatsapp-btn-back" id="wa-btn-back">
                <i class="fas fa-arrow-left"></i>
            </button>
            <div class="whatsapp-avatar">${initial}</div>
            <div class="whatsapp-chat-info">
                <h3>${name}</h3>
                <p>${phone}</p>
            </div>
        </div>
        ${bodyHtml}
        <div class="whatsapp-input-area">
            <input type="text" class="whatsapp-input" id="wa-msg-input" placeholder="Digite uma mensagem..." autocomplete="off">
            <button class="whatsapp-btn-send" id="wa-btn-send">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;

    // Re-bind chat events
    document.getElementById('wa-btn-back')?.addEventListener('click', backToList);
    
    const inputEl = document.getElementById('wa-msg-input');
    const sendBtn = document.getElementById('wa-btn-send');
    
    if (inputEl && sendBtn) {
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage(inputEl.value);
            }
        });
        sendBtn.addEventListener('click', () => {
            sendMessage(inputEl.value);
        });
    }
}

function scrollToBottom() {
    const list = document.getElementById('wa-messages-list');
    if (list) {
        list.scrollTop = list.scrollHeight;
    }
}

function bindEvents() {
    // Global events if needed
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    ).replace(/\n/g, '<br>');
}
