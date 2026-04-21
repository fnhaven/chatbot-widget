(function (global) {
  'use strict';

  const defaultConfig = {
    apiBase: 'http://localhost:3000/api',
    position: 'bottom-right',
    offsetX: 24,
    offsetY: 24,
    primaryColor: '#2563eb',
    zIndex: 999999,
    title: 'AI Assistant',
    subtitle: 'Tanya kami apa saja',
    placeholder: 'Ketik pertanyaan Anda...',
    welcomeMessage: 'Halo! Ada yang bisa kami bantu? Ketik pertanyaan Anda dan kami akan mencarikan artikel bantuan yang sesuai.',
  };

  function mergeConfig(userConfig) {
    return Object.assign({}, defaultConfig, userConfig || {});
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getTimeString() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function isGreeting(text) {
    const greetings = [
      'hi','hello','hey','halo','hai','hallo','hay','hoi','yo',
      'selamat pagi','selamat siang','selamat sore','selamat malam',
      'pagi','siang','sore','malam',
      'good morning','good afternoon','good evening','good night',
    ];
    const lower = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    return greetings.some((g) => lower === g || lower.startsWith(g + ' '));
  }

  function isWellBeing(text) {
    const phrases = [
      'apa kabar','bagaimana kabarmu','bagaimana kabar','how are you','how are you doing',
      'how do you do','what\'s up','sup','how is it going'
    ];
    const lower = text.toLowerCase().replace(/[^a-z\s']/g, '').trim();
    return phrases.some((p) => lower === p || lower.startsWith(p + ' '));
  }

  const icons = {
    chat: `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    newChat: `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 11h-4v4h-2v-4H9v-2h4V7h2v4h4v2z"/></svg>`,
  };

  class ChatbotWidget {
    constructor(config) {
      this.config = mergeConfig(config);
      this.isOpen = false;
      this.messagesEl = null;
      this.typingEl = null;
      this.inputEl = null;
      this.container = null;
      this.chatEl = null;
      this.lastQuery = '';
      this.inAIMode = false;
      this.sessionId = null;
      this.init();
    }

    init() {
      const stored = localStorage.getItem('cbw_session_id');
      this.sessionId = stored || generateUUID();
      localStorage.setItem('cbw_session_id', this.sessionId);

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;z-index:' + this.config.zIndex + ';';
      const shadow = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `__CSS_PLACEHOLDER__`;
      shadow.appendChild(style);

      this.container = document.createElement('div');
      this.container.className = 'cbw-container';
      this.container.setAttribute('data-position', this.config.position);
      this.updatePosition();

      this.chatEl = document.createElement('div');
      this.chatEl.className = 'cbw-chat';

      this.chatEl.innerHTML = `
        <div class="cbw-header">
          <div>
            <div class="cbw-header-title">${escapeHTML(this.config.title)}</div>
            <div class="cbw-header-subtitle">${escapeHTML(this.config.subtitle)}</div>
          </div>
          <div class="cbw-header-actions">
            <button class="cbw-new-chat" title="Sesi chat baru" aria-label="Sesi chat baru">${icons.newChat}</button>
            <button class="cbw-close" aria-label="Close">${icons.close}</button>
          </div>
        </div>
        <div class="cbw-messages"></div>
        <div class="cbw-input-area">
          <input class="cbw-input" type="text" placeholder="${escapeHTML(this.config.placeholder)}" />
          <button class="cbw-send" aria-label="Send">${icons.send}</button>
        </div>
      `;

      this.launcher = document.createElement('button');
      this.launcher.className = 'cbw-launcher';
      this.launcher.setAttribute('aria-label', 'Open chat');
      this.launcher.innerHTML = icons.chat;

      this.container.appendChild(this.chatEl);
      this.container.appendChild(this.launcher);
      shadow.appendChild(this.container);
      document.body.appendChild(host);

      this.messagesEl = this.chatEl.querySelector('.cbw-messages');
      this.inputEl = this.chatEl.querySelector('.cbw-input');
      const sendBtn = this.chatEl.querySelector('.cbw-send');
      const closeBtn = this.chatEl.querySelector('.cbw-close');
      const newChatBtn = this.chatEl.querySelector('.cbw-new-chat');

      this.launcher.addEventListener('click', () => this.toggle(true));
      closeBtn.addEventListener('click', () => this.toggle(false));
      sendBtn.addEventListener('click', () => this.handleSend());
      if (newChatBtn) {
        newChatBtn.addEventListener('click', () => this.resetSession());
      }
      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSend();
      });

      if (this.config.primaryColor) {
        style.textContent = style.textContent.replace(/#2563eb/g, this.config.primaryColor);
        const darken = adjustColor(this.config.primaryColor, -20);
        style.textContent = style.textContent.replace(/#1d4ed8/g, darken);
      }

      console.log('[ChatbotWidget] Session ID:', this.sessionId);

      this.addBotMessage(this.config.welcomeMessage);
      this.loadHistory();
      this.initSocket();
    }

    updatePosition() {
      const pos = this.config.position;
      const x = this.config.offsetX;
      const y = this.config.offsetY;
      if (pos === 'bottom-right') {
        this.container.style.bottom = y + 'px';
        this.container.style.right = x + 'px';
        this.container.style.left = 'auto';
        this.container.style.top = 'auto';
      } else if (pos === 'bottom-left') {
        this.container.style.bottom = y + 'px';
        this.container.style.left = x + 'px';
        this.container.style.right = 'auto';
        this.container.style.top = 'auto';
      } else {
        this.container.style.bottom = y + 'px';
        this.container.style.right = x + 'px';
      }
    }

    toggle(open) {
      this.isOpen = open;
      if (open) {
        this.chatEl.classList.add('open');
        this.launcher.style.display = 'none';
        setTimeout(() => this.inputEl && this.inputEl.focus(), 100);
      } else {
        this.chatEl.classList.remove('open');
        this.launcher.style.display = 'flex';
      }
    }

    resetSession() {
      localStorage.removeItem('cbw_session_id');
      this.sessionId = generateUUID();
      localStorage.setItem('cbw_session_id', this.sessionId);
      this.lastQuery = '';
      this.inAIMode = false;
      this.inTicketingFlow = false;
      this.inCSMode = false;
      this.sessionClosed = false;
      if (this.socket) { this.socket.disconnect(); this.socket = null; this._csListenersAttached = false; }
      if (this.inputEl) this.inputEl.disabled = false;
      if (this.messagesEl) {
        this.messagesEl.innerHTML = '';
      }
      console.log('[ChatbotWidget] New Session ID:', this.sessionId);
      this.addBotMessage(this.config.welcomeMessage);
      if (this.inputEl) {
        this.inputEl.value = '';
        this.inputEl.focus();
      }
      // Reconnect socket with new session ID
      this.initSocket();
    }

    async initSocket() {
      if (this.socket) return;
      try {
        const io = await this.loadSocketIO();
        const origin = this.config.apiBase.replace(/\/api\/?$/, '');
        this.socket = io(origin, {
          auth: { role: 'user', session_id: this.sessionId },
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('[ChatbotWidget] Socket connected:', this.socket.id);
        });
        this.socket.on('disconnect', (reason) => {
          console.log('[ChatbotWidget] Socket disconnected:', reason);
        });
        this.socket.on('connect_error', (err) => {
          console.warn('[ChatbotWidget] Socket connect error:', err.message);
        });

        this.socket.on('ticket:updated', ({ ticket }) => {
          const statusMap = { open: 'Dibuka', in_progress: 'Diproses', resolved: 'Selesai', closed: 'Ditutup' };
          const msg = `📋 **Update Status Tiket**\n\nNomor tiket Anda **${ticket.ticket_number}** statusnya berubah menjadi **${statusMap[ticket.status] || ticket.status}**${ticket.priority ? ` (Prioritas: ${ticket.priority})` : ''}.`;
          this.addBotMessage(formatMarkdownLite(msg));
          this.addNotification('Status tiket Anda telah diperbarui.');
          this.scrollToBottom();
        });
      } catch (err) {
        console.warn('[ChatbotWidget] Socket init failed', err);
      }
    }

    async loadHistory() {
      try {
        const res = await fetch(`${this.config.apiBase}/history`, {
          headers: { 'X-Session-Id': this.sessionId },
        });
        const data = await res.json();
        this.updateSessionId(data.session_id);
        if (data.history && data.history.length) {
          const hadHandover = data.history.some(
            (h) => h.intent === 'handover_to_cs' || h.type === 'handover'
          );
          let csStatus = null;
          if (hadHandover) {
            try {
              const csRes = await fetch(`${this.config.apiBase}/cs/sessions/${this.sessionId}`);
              if (csRes.ok) {
                const csData = await csRes.json();
                csStatus = csData.session?.status || null;
              }
            } catch (_) {}
          }
          this.renderHistory(data.history, csStatus);
        }
      } catch (err) {
        console.error('Failed to load history', err);
      }
    }

    renderHistory(history, csStatus) {
      let lastUserText = '';
      history.forEach((item) => {
        if (item.role === 'user') {
          lastUserText = item.content;
          this.addUserMessage(item.content);
          return;
        }
        if (item.role !== 'bot') return;

        const intent = item.intent;
        const type = item.type;
        const meta = item.meta || {};

        if (intent === 'greeting' || type === 'greeting') {
          this.addBotMessage(item.content);
        } else if (intent === 'chat_agent' || type === 'chat_agent') {
          this.renderAgentAnswer(item.content, 'chat_agent', meta, lastUserText);
        } else if (intent === 'ai_agent' || type === 'ai_agent') {
          if (meta.weather) this.renderWeatherCard(meta.weather);
          this.renderAgentAnswer(item.content, 'ai_agent', meta, lastUserText);
        } else if (intent === 'ticketing' || type === 'ticketing') {
          this.addBotMessage(formatMarkdownLite(item.content || ''));
          if (meta.step === 'ask_field') this.inTicketingFlow = true;
          if (meta.step === 'done' || meta.step === 'cancelled') this.inTicketingFlow = false;
        } else if (intent === 'handover_to_cs' || type === 'handover') {
          if (csStatus === 'closed') {
            this.addBotMessage('Maaf atas ketidaknyamanannya. Segera menghubungkan Anda dengan <strong>Customer Service</strong>...');
            this.addNotification('Sesi Customer Service telah ditutup. Terima kasih.');
            this.sessionClosed = true;
            const btnWrap = document.createElement('div');
            btnWrap.style.textAlign = 'center';
            btnWrap.style.margin = '8px 0';
            btnWrap.innerHTML = '<button class="cbw-action-btn" data-new-session>Mulai Sesi Baru</button>';
            this.messagesEl.appendChild(btnWrap);
            const btn = btnWrap.querySelector('[data-new-session]');
            if (btn) btn.addEventListener('click', () => {
              this.sessionClosed = false;
              this.resetSession();
            });
          } else {
            this.addBotMessage('Maaf atas ketidaknyamanannya. Segera menghubungkan Anda dengan <strong>Customer Service</strong>...');
            this.enterCSMode();
          }
        }
      });
      if (lastUserText) this.lastQuery = lastUserText;
      this.scrollToBottom();
    }

    handleSend() {
      if (this.sessionClosed) return;
      const text = this.inputEl.value.trim();
      if (!text) return;
      this.addUserMessage(text);
      this.inputEl.value = '';
      this.lastQuery = text;

      if (this.inCSMode) {
        if (this.socket) this.socket.emit('user:message', { text });
        return;
      }

      if (this.inTicketingFlow) {
        const aiMsg = this.addBotMessage('');
        this.askAIStream(aiMsg, text);
        return;
      }

      if (isGreeting(text)) {
        this.sendGreeting(text);
        return;
      }

      if (isWellBeing(text)) {
        this.inAIMode = true;
        this.addBotMessage('Saya akan menghubungkan Anda ke AI Agent.');
        const aiMsg = this.addBotMessage('');
        this.askAIStream(aiMsg, text);
        return;
      }

      if (this.inAIMode) {
        const aiMsg = this.addBotMessage('');
        this.askAIStream(aiMsg, text);
        return;
      }

      this.sendChat(text);
    }

    async sendGreeting(text) {
      try {
        const res = await fetch(`${this.config.apiBase}/greeting`, {
          method: 'POST',
          headers: this.apiHeaders(),
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        this.updateSessionId(data.session_id);
        this.addBotMessage(data.greeting);
      } catch (err) {
        const hour = new Date().getHours();
        let timeLabel = 'malam';
        if (hour >= 4 && hour < 11) timeLabel = 'pagi';
        else if (hour >= 11 && hour < 15) timeLabel = 'siang';
        else if (hour >= 15 && hour < 18) timeLabel = 'sore';
        this.addBotMessage(`Halo, Selamat ${timeLabel}! Apa ada yang bisa saya bantu?`);
      }
    }

    async sendChat(text) {
      this.showTyping();
      try {
        const res = await fetch(`${this.config.apiBase}/chat`, {
          method: 'POST',
          headers: this.apiHeaders(),
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        this.hideTyping();
        this.updateSessionId(data.session_id);

        if (data.source === 'ai_agent_stream') {
          this.inAIMode = true;
          const aiMsg = this.addBotMessage('');
          this.askAIStream(aiMsg, text);
          return;
        }

        if (data.source === 'handover_to_cs') {
          this.addBotMessage(formatMarkdownLite(data.answer || 'Menghubungkan Anda dengan Customer Service...'));
          this.enterCSMode();
          this.scrollToBottom();
          return;
        }

        this.renderAgentAnswer(data.answer, data.source, {
          tokens: data.tokens,
          cost_usd: data.cost_usd,
          related_questions: data.related_questions,
        }, text);
      } catch (err) {
        this.hideTyping();
        this.addBotMessage('Maaf, terjadi kesalahan. Silakan coba lagi.');
      }
    }

    renderAgentAnswer(answer, source, meta, originalQuestion) {
      const tokens = meta && meta.tokens ? meta.tokens : { input: 0, output: 0 };
      const costUsd = meta && meta.cost_usd != null ? meta.cost_usd : 0;
      const relatedQuestions = (meta && meta.related_questions) || [];

      let metaHtml = '';
      if (source === 'chat_agent') {
        metaHtml = '<div class="cbw-meta">💡 Jawaban dari Knowledge Base (0 token)</div>';
      } else if (source === 'ai_agent') {
        this.inAIMode = true;
        metaHtml = `<div class="cbw-meta">🤖 AI Agent | Input: ${tokens.input || 0} tokens | Output: ${tokens.output || 0} tokens | Est: $${Number(costUsd).toFixed(6)}</div>`;
      }

      let relatedBtnHtml = '';
      if (source === 'chat_agent' && relatedQuestions.length > 0) {
        relatedBtnHtml = '<button class="cbw-action-btn" data-show-related>Lihat pertanyaan lain</button>';
      }

      const actionHtml = source === 'handover_to_cs'
        ? ''
        : `<div class="cbw-action-row" data-action-row style="margin-top:10px;">
             <button class="cbw-thumb-btn" data-thumb-up title="Jawaban membantu">👍</button>
             <button class="cbw-action-btn" data-unhelpful>Bukan jawaban yang saya cari</button>
             ${relatedBtnHtml}
           </div>`;

      const html = `<div>${formatMarkdownLite(answer)}</div>${metaHtml}${actionHtml}`;
      const bubble = this.addBotMessage(html);

      // "Lihat pertanyaan lain" button
      const relatedBtn = bubble.querySelector('[data-show-related]');
      if (relatedBtn) {
        relatedBtn.addEventListener('click', () => {
          const row = bubble.querySelector('[data-action-row]');
          if (row) row.style.display = 'none';
          this.showRelatedQuestions(relatedQuestions);
        });
      }

      const unhelpfulBtn = bubble.querySelector('[data-unhelpful]');
      if (unhelpfulBtn && source === 'chat_agent') {
        unhelpfulBtn.addEventListener('click', () => {
          this.logFeedback('feedback_negative_chat_agent');
          const row = bubble.querySelector('[data-action-row]');
          if (row) row.style.display = 'none';
          this.inAIMode = true;
          const fallbackQuestion = originalQuestion || this.lastQuery;
          this.addBotMessage('Mari saya coba cari jawaban lain untuk Anda...');
          const aiMsg = this.addBotMessage('');
          this.askAIStream(aiMsg, fallbackQuestion);
        });
      } else if (unhelpfulBtn) {
        unhelpfulBtn.addEventListener('click', () => {
          this.logFeedback('feedback_negative');
          const row = bubble.querySelector('[data-action-row]');
          if (row) row.style.display = 'none';
          this.addBotMessage('Maaf atas ketidaknyamanannya. Segera menghubungkan Anda dengan <strong>Customer Service</strong>...');
          this.enterCSMode();
          this.scrollToBottom();
        });
      }

      const thumbUpBtn = bubble.querySelector('[data-thumb-up]');
      if (thumbUpBtn) {
        thumbUpBtn.addEventListener('click', () => {
          this.logFeedback('feedback_positive');
          const row = bubble.querySelector('[data-action-row]');
          if (row) {
            row.innerHTML = '<span style="font-size:12px;color:var(--cbw-text-secondary);">Terima kasih atas feedback Anda! 👍</span>';
          }
          this.scrollToBottom();
        });
      }
    }

    showRelatedQuestions(questions) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cbw-message-wrapper bot';
      const inner = document.createElement('div');
      inner.className = 'cbw-message bot';
      inner.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Pertanyaan lainnya:</div>';
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      questions.forEach((q) => {
        const btn = document.createElement('button');
        btn.className = 'cbw-action-btn';
        btn.style.textAlign = 'left';
        btn.textContent = q;
        btn.addEventListener('click', () => {
          wrapper.remove();
          this.addUserMessage(q);
          this.lastQuery = q;
          this.sendChat(q);
        });
        list.appendChild(btn);
      });
      inner.appendChild(list);
      wrapper.appendChild(inner);
      this.messagesEl.appendChild(wrapper);
      this.scrollToBottom();
    }

    async askAIStream(targetEl, overrideQuestion) {
      const question = overrideQuestion || this.lastQuery;
      this.showTyping();

      const bubble = targetEl || this.addBotMessage('');
      let answerText = '';
      let meta = { input: 0, output: 0, cost_usd: 0 };
      let weatherCardEl = null;

      try {
        const res = await fetch(`${this.config.apiBase}/ask-ai-stream`, {
          method: 'POST',
          headers: this.apiHeaders(),
          body: JSON.stringify({ question }),
        });

        this.hideTyping();
        this.updateSessionId(res.headers.get('X-Session-Id'));

        const contentType = res.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();

          // Ticketing flow response
          if (data.type === 'ticketing') {
            this.renderTicketingResponse(bubble, data);
            return;
          }

          // Fallback non-streaming response (e.g. no API key)
          const answerHTML = formatMarkdownLite(data.answer || 'Maaf, AI tidak dapat menjawab saat ini.');
          const costUsd = data.cost_usd != null ? data.cost_usd : 0;
          bubble.innerHTML = answerHTML + `
            <div class="cbw-meta">🤖 AI Agent | Input: ${(data.tokens && data.tokens.input) || 0} tokens | Output: ${(data.tokens && data.tokens.output) || 0} tokens | Est: $${Number(costUsd).toFixed(6)}</div>
            <div class="cbw-action-row" style="margin-top:10px;" data-ai-action-row>
              <button class="cbw-thumb-btn" data-ai-thumb-up title="Jawaban membantu">👍</button>
              <button class="cbw-action-btn" data-ai-unhelpful>Hubungi CS</button>
            </div>
          `;
          this.attachAIUnhelpfulListener(bubble);
          this.attachAIThumbListener(bubble);
          this.scrollToBottom();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processChunk = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              if (weatherCardEl) {
                // Put meta + actions inside the weather card
                const metaRow = document.createElement('div');
                metaRow.style.cssText = 'padding:0 20px 14px;position:relative;z-index:1;';
                metaRow.innerHTML = `
                  <div class="cbw-meta" style="border-top-color:rgba(255,255,255,0.2);color:inherit;opacity:0.7;">🤖 AI Agent | Input: ${meta.input} tokens | Output: ${meta.output} tokens | Est: $${Number(meta.cost_usd).toFixed(6)}</div>
                  <div class="cbw-action-row" style="margin-top:8px;" data-ai-action-row>
                    <button class="cbw-thumb-btn" data-ai-thumb-up title="Jawaban membantu" style="border-color:rgba(255,255,255,0.3);color:inherit;">👍</button>
                    <button class="cbw-action-btn" data-ai-unhelpful style="border-color:rgba(255,255,255,0.3);color:inherit;">Hubungi CS</button>
                  </div>
                `;
                weatherCardEl.appendChild(metaRow);
                this.attachAIUnhelpfulListener(weatherCardEl);
                this.attachAIThumbListener(weatherCardEl);
                // Hide empty text bubble if no text was generated
                if (!answerText.trim()) {
                  const bubbleWrapper = bubble.closest('.cbw-message-wrapper');
                  if (bubbleWrapper) bubbleWrapper.style.display = 'none';
                }
              } else {
                const answerHTML = formatMarkdownLite(answerText);
                bubble.innerHTML = answerHTML + `
                  <div class="cbw-meta">🤖 AI Agent | Input: ${meta.input} tokens | Output: ${meta.output} tokens | Est: $${Number(meta.cost_usd).toFixed(6)}</div>
                  <div class="cbw-action-row" style="margin-top:10px;" data-ai-action-row>
                    <button class="cbw-thumb-btn" data-ai-thumb-up title="Jawaban membantu">👍</button>
                    <button class="cbw-action-btn" data-ai-unhelpful>Hubungi CS</button>
                  </div>
                `;
                this.attachAIUnhelpfulListener(bubble);
                this.attachAIThumbListener(bubble);
              }
              this.scrollToBottom();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            lines.forEach((line) => {
              const raw = line.replace(/^data:\s*/, '').trim();
              if (!raw) return;
              try {
                const parsed = JSON.parse(raw);
                if (parsed.type === 'text') {
                  answerText += parsed.chunk;
                  bubble.innerHTML = formatMarkdownLite(answerText);
                  this.scrollToBottom();
                } else if (parsed.type === 'weather' && !weatherCardEl) {
                  weatherCardEl = this.renderWeatherCard(parsed.data);
                } else if (parsed.type === 'done') {
                  meta.input = (parsed.tokens && parsed.tokens.input) || 0;
                  meta.output = (parsed.tokens && parsed.tokens.output) || 0;
                  meta.cost_usd = parsed.cost_usd != null ? parsed.cost_usd : 0;
                }
              } catch (e) {
                // ignore malformed JSON
              }
            });

            processChunk();
          }).catch((err) => {
            this.hideTyping();
            bubble.textContent = 'Maaf, AI Assistant sedang tidak tersedia. Silakan coba lagi nanti.';
          });
        };

        processChunk();
      } catch (err) {
        this.hideTyping();
        bubble.textContent = 'Maaf, AI Assistant sedang tidak tersedia. Silakan coba lagi nanti.';
      }
    }

    renderTicketingResponse(bubble, data) {
      const msg = formatMarkdownLite(data.message || '');
      const isAsking = data.step === 'ask_field';
      const isDone = data.step === 'done';
      const isCancelled = data.step === 'cancelled';

      this.inTicketingFlow = isAsking;

      let actionHtml = '';
      if (isAsking) {
        actionHtml = `<div class="cbw-action-row" data-ticket-action-row style="margin-top:10px;">
          <button class="cbw-action-btn" data-ticket-cancel>Batalkan</button>
        </div>`;
      }

      bubble.innerHTML = `<div>${msg}</div>${actionHtml}`;

      const cancelBtn = bubble.querySelector('[data-ticket-cancel]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          const row = bubble.querySelector('[data-ticket-action-row]');
          if (row) row.style.display = 'none';
          this.addUserMessage('batal');
          const nextBubble = this.addBotMessage('');
          this.askAIStream(nextBubble, 'batal');
        });
      }

      if (isDone || isCancelled) {
        this.inTicketingFlow = false;
      }
      this.scrollToBottom();
    }

    attachAIUnhelpfulListener(bubble) {
      const btn = bubble.querySelector('[data-ai-unhelpful]');
      if (btn) {
        btn.addEventListener('click', () => {
          this.logFeedback('feedback_negative');
          const row = bubble.querySelector('[data-ai-action-row]');
          if (row) row.style.display = 'none';
          this.addBotMessage('Maaf atas ketidaknyamanannya. Segera menghubungkan Anda dengan <strong>Customer Service</strong>...');
          this.enterCSMode();
          this.scrollToBottom();
        });
      }
    }

    attachAIThumbListener(bubble) {
      const btn = bubble.querySelector('[data-ai-thumb-up]');
      if (btn) {
        btn.addEventListener('click', () => {
          this.logFeedback('feedback_positive');
          const row = bubble.querySelector('[data-ai-action-row]');
          if (row) {
            row.innerHTML = '<span style="font-size:12px;color:var(--cbw-text-secondary);">Terima kasih atas feedback Anda! 👍</span>';
          }
          this.scrollToBottom();
        });
      }
    }

    loadSocketIO() {
      if (global.io) return Promise.resolve(global.io);
      if (this._ioLoading) return this._ioLoading;
      this._ioLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
        s.onload = () => resolve(global.io);
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return this._ioLoading;
    }

    loadGSAP() {
      if (global.gsap) return Promise.resolve(global.gsap);
      if (this._gsapLoading) return this._gsapLoading;
      this._gsapLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
        s.onload = () => resolve(global.gsap);
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return this._gsapLoading;
    }

    renderWeatherCard(data) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cbw-message-wrapper bot';
      wrapper.style.maxWidth = '100%';

      const card = document.createElement('div');
      card.className = 'cbw-weather-card';
      card.setAttribute('data-condition', data.condition_key);

      const bg = document.createElement('div');
      bg.className = 'cbw-weather-bg';

      const content = document.createElement('div');
      content.className = 'cbw-weather-content';
      content.innerHTML = `
        <div class="cbw-weather-city">📍 ${escapeHTML(data.city)}</div>
        <div class="cbw-weather-temp">${data.temperature}°C</div>
        <div class="cbw-weather-condition">${escapeHTML(data.condition)}</div>
        <div class="cbw-weather-details">
          <span>💧 ${data.humidity}%</span>
          <span>💨 ${data.wind_speed} km/h</span>
        </div>
      `;

      card.appendChild(bg);
      card.appendChild(content);
      wrapper.appendChild(card);
      this.messagesEl.appendChild(wrapper);
      this.scrollToBottom();
      this.animateWeatherCard(bg, data.condition_key);
      return card;
    }

    async animateWeatherCard(bgEl, conditionKey) {
      try {
        const gsap = await this.loadGSAP();
        if (!gsap) return;

        switch (conditionKey) {
          case 'sunny':
            this.animateSunny(bgEl, gsap);
            break;
          case 'rainy':
            this.animateRainy(bgEl, gsap);
            break;
          case 'stormy':
            this.animateStormy(bgEl, gsap);
            break;
          case 'cloudy':
            this.animateCloudy(bgEl, gsap);
            break;
          case 'foggy':
            this.animateFoggy(bgEl, gsap);
            break;
          case 'clear_night':
            this.animateNight(bgEl, gsap);
            break;
        }
      } catch (err) {
        console.warn('[ChatbotWidget] GSAP animation failed', err);
      }
    }

    animateSunny(bg, gsap) {
      const core = document.createElement('div');
      core.className = 'cbw-sun-core';
      bg.appendChild(core);
      gsap.to(core, { scale: 1.15, opacity: 0.4, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' });

      for (let i = 0; i < 8; i++) {
        const ray = document.createElement('div');
        ray.className = 'cbw-sun-ray';
        ray.style.transform = `rotate(${i * 45}deg)`;
        bg.appendChild(ray);
        gsap.to(ray, { opacity: 0.1, duration: 1.5, repeat: -1, yoyo: true, delay: i * 0.15, ease: 'sine.inOut' });
      }
    }

    animateRainy(bg, gsap) {
      for (let i = 0; i < 25; i++) {
        const drop = document.createElement('div');
        drop.className = 'cbw-raindrop';
        drop.style.left = (Math.random() * 100) + '%';
        drop.style.height = (10 + Math.random() * 10) + 'px';
        drop.style.opacity = 0.2 + Math.random() * 0.3;
        bg.appendChild(drop);
        gsap.fromTo(drop,
          { y: -20 },
          { y: 200, duration: 0.6 + Math.random() * 0.6, repeat: -1, delay: Math.random() * 1.5, ease: 'none' }
        );
      }
    }

    animateStormy(bg, gsap) {
      this.animateRainy(bg, gsap);
      const lightning = document.createElement('div');
      lightning.className = 'cbw-lightning';
      bg.appendChild(lightning);
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 3 + Math.random() * 4 });
      tl.to(lightning, { background: 'rgba(255,255,255,0.7)', duration: 0.05 })
        .to(lightning, { background: 'rgba(255,255,255,0)', duration: 0.1 })
        .to(lightning, { background: 'rgba(255,255,255,0.5)', duration: 0.05, delay: 0.15 })
        .to(lightning, { background: 'rgba(255,255,255,0)', duration: 0.2 });
    }

    animateCloudy(bg, gsap) {
      const clouds = [
        { w: 70, h: 28, top: 15, left: -70, speed: 12 },
        { w: 55, h: 22, top: 45, left: -55, speed: 16 },
        { w: 80, h: 32, top: 70, left: -80, speed: 20 },
        { w: 45, h: 18, top: 110, left: -45, speed: 14 },
      ];
      clouds.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'cbw-cloud';
        el.style.width = c.w + 'px';
        el.style.height = c.h + 'px';
        el.style.top = c.top + 'px';
        el.style.left = c.left + 'px';
        bg.appendChild(el);
        gsap.fromTo(el,
          { x: 0 },
          { x: 400, duration: c.speed, repeat: -1, ease: 'none' }
        );
      });
    }

    animateFoggy(bg, gsap) {
      for (let i = 0; i < 4; i++) {
        const fog = document.createElement('div');
        fog.className = 'cbw-fog-layer';
        fog.style.top = (30 + i * 35) + 'px';
        fog.style.opacity = 0.1 + Math.random() * 0.15;
        bg.appendChild(fog);
        gsap.fromTo(fog,
          { x: -40 },
          { x: 40, duration: 4 + i * 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }
        );
      }
    }

    animateNight(bg, gsap) {
      for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.className = 'cbw-star';
        star.style.left = (Math.random() * 100) + '%';
        star.style.top = (Math.random() * 100) + '%';
        star.style.width = (1 + Math.random() * 3) + 'px';
        star.style.height = star.style.width;
        bg.appendChild(star);
        gsap.fromTo(star,
          { opacity: 0.2 },
          { opacity: 1, duration: 0.8 + Math.random() * 1.5, repeat: -1, yoyo: true, delay: Math.random() * 2, ease: 'sine.inOut' }
        );
      }
    }

    async enterCSMode() {
      if (this.inCSMode) return;
      this.inCSMode = true;
      try {
        await this.initSocket();
        this.attachCsListeners();
      } catch (err) {
        console.error('[ChatbotWidget] CS socket failed', err);
      }
    }

    attachCsListeners() {
      if (!this.socket || this._csListenersAttached) return;
      this._csListenersAttached = true;

      this.socket.on('cs:picked_up', ({ agent_name }) => {
        this.addNotification(`${agent_name || 'Agent'} bergabung dalam percakapan.`);
      });
      this.socket.on('cs:agent_message', ({ message }) => {
        this.addBotMessage(formatMarkdownLite(message.content || ''));
      });
      this.socket.on('cs:session_closed', () => {
        this.inCSMode = false;
        this.sessionClosed = true;
        this.addNotification('Sesi Customer Service telah ditutup. Terima kasih.');
        const btnWrap = document.createElement('div');
        btnWrap.style.textAlign = 'center';
        btnWrap.style.margin = '8px 0';
        btnWrap.innerHTML = '<button class="cbw-action-btn" data-new-session>Mulai Sesi Baru</button>';
        this.messagesEl.appendChild(btnWrap);
        this.scrollToBottom();
        const btn = btnWrap.querySelector('[data-new-session]');
        if (btn) btn.addEventListener('click', () => {
          this.sessionClosed = false;
          this.resetSession();
        });
        if (this.inputEl) this.inputEl.disabled = true;
      });
    }

    async reconnectSocket() {
      if (this.socket) {
        try { this.socket.disconnect(); } catch {}
        this.socket = null;
        this._csListenersAttached = false;
      }
      await this.initSocket();
      if (this.inCSMode) this.attachCsListeners();
    }

    async logFeedback(intent) {
      try {
        await fetch(`${this.config.apiBase}/log-feedback`, {
          method: 'POST',
          headers: this.apiHeaders(),
          body: JSON.stringify({ intent }),
        });
      } catch (err) {
        // silent fail
      }
    }

    addUserMessage(text) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cbw-message-wrapper user';
      wrapper.innerHTML = `<div class="cbw-message user">${escapeHTML(text)}</div><div class="cbw-time">${getTimeString()}</div>`;
      this.messagesEl.appendChild(wrapper);
      this.scrollToBottom();
      return wrapper;
    }

    addBotMessage(html) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cbw-message-wrapper bot';
      const bubble = document.createElement('div');
      bubble.className = 'cbw-message bot';
      if (html) bubble.innerHTML = html;
      const time = document.createElement('div');
      time.className = 'cbw-time';
      time.textContent = getTimeString();
      wrapper.appendChild(bubble);
      wrapper.appendChild(time);
      this.messagesEl.appendChild(wrapper);
      this.scrollToBottom();
      return bubble;
    }

    addNotification(text) {
      const el = document.createElement('div');
      el.className = 'cbw-notification';
      el.textContent = text;
      this.messagesEl.appendChild(el);
      this.scrollToBottom();
    }

    showTyping() {
      if (this.typingEl) return;
      this.typingEl = document.createElement('div');
      this.typingEl.className = 'cbw-typing';
      this.typingEl.innerHTML = '<span></span><span></span><span></span>';
      this.messagesEl.appendChild(this.typingEl);
      this.scrollToBottom();
    }

    hideTyping() {
      if (!this.typingEl) return;
      this.typingEl.remove();
      this.typingEl = null;
    }

    scrollToBottom() {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    apiHeaders() {
      return {
        'Content-Type': 'application/json',
        'X-Session-Id': this.sessionId,
      };
    }

    updateSessionId(newId) {
      if (newId && newId !== this.sessionId) {
        this.sessionId = newId;
        localStorage.setItem('cbw_session_id', newId);
        this.reconnectSocket();
      }
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMarkdownLite(text) {
    return escapeHTML(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  global.ChatbotWidget = {
    init(config) {
      if (global.__chatbotWidgetInstance) {
        console.warn('ChatbotWidget already initialized');
        return global.__chatbotWidgetInstance;
      }
      global.__chatbotWidgetInstance = new ChatbotWidget(config);
      return global.__chatbotWidgetInstance;
    },
  };
})(window);
