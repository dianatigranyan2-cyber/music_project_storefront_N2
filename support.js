(() => {
  const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const API_URL = localHost
    ? 'http://localhost:3000/api/support/public'
    : 'https://music-project-blue-mu.vercel.app/api/support/public';
  const STORAGE_KEY = 'melo-support-chat-token';
  const launcher = document.querySelector('#support-launcher');
  const panel = document.querySelector('#support-panel');
  const form = document.querySelector('#support-form');
  const textarea = form.elements.message;
  const closeButton = document.querySelector('#support-close');
  const messagesElement = document.querySelector('#support-messages');
  const statusElement = document.querySelector('#support-status');
  const languageText = {
    ru: { sending: 'Отправляем…', send: 'Отправить', sendError: 'Не удалось отправить сообщение. Попробуйте ещё раз.', loadError: 'Не удалось загрузить переписку. Проверьте соединение.' },
    hy: { sending: 'Ուղարկվում է…', send: 'Ուղարկել', sendError: 'Չհաջողվեց ուղարկել հաղորդագրությունը։ Փորձեք կրկին։', loadError: 'Չհաջողվեց բեռնել նամակագրությունը։ Ստուգեք կապը։' },
    en: { sending: 'Sending…', send: 'Send', sendError: 'Could not send the message. Please try again.', loadError: 'Could not load the conversation. Check your connection.' },
  };
  let token = null;
  let timer = null;
  let sending = false;

  const words = () => languageText[document.documentElement.lang] || languageText.ru;
  const makeToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const setStatus = (message = '') => { statusElement.textContent = message; };

  async function request(action, body = {}) {
    const response = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token, ...body }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  }

  function render(messages) {
    const stayAtBottom = messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight < 60;
    messagesElement.replaceChildren();
    messages.forEach((message) => {
      const bubble = document.createElement('article');
      bubble.className = `support-message${message.sender_role === 'admin' ? ' support-admin-message' : ''}`;
      const body = document.createElement('span');
      body.textContent = message.body;
      const time = document.createElement('time');
      time.textContent = new Intl.DateTimeFormat(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at));
      bubble.append(body, time);
      messagesElement.append(bubble);
    });
    if (stayAtBottom) messagesElement.scrollTop = messagesElement.scrollHeight;
  }

  async function refresh() {
    if (!token || sending || panel.hidden) return;
    try {
      const result = await request('read');
      render(result.messages || []);
      setStatus();
    } catch {
      setStatus(words().loadError);
    }
  }

  function startPolling() {
    if (timer) window.clearInterval(timer);
    void refresh();
    timer = window.setInterval(() => void refresh(), 4000);
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    setStatus();
    try { token = localStorage.getItem(STORAGE_KEY); } catch { token = null; }
    if (token) startPolling();
    else textarea.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton.addEventListener('click', closePanel);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) closePanel(); });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content || sending) return;
    const firstMessage = !token;
    if (firstMessage) token = makeToken();
    sending = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = words().sending;
    try {
      await request(firstMessage ? 'start' : 'send', { content });
      if (firstMessage) {
        try { localStorage.setItem(STORAGE_KEY, token); } catch { /* Keep this conversation available for the current tab. */ }
      }
      textarea.value = '';
      sending = false;
      await refresh();
      startPolling();
    } catch {
      if (firstMessage) token = null;
      setStatus(words().sendError);
    } finally {
      sending = false;
      submit.disabled = false;
      submit.textContent = words().send;
    }
  });
})();
