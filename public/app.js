(() => {
  const HIDDEN_PREF_KEY = 'kopilka:amountsHidden';

  function loadHiddenPref() {
    try {
      return localStorage.getItem(HIDDEN_PREF_KEY) === '1';
    } catch {
      return false;
    }
  }

  function saveHiddenPref(hidden) {
    try {
      localStorage.setItem(HIDDEN_PREF_KEY, hidden ? '1' : '0');
    } catch {
      /* приватный режим браузера — просто не сохраняем предпочтение */
    }
  }

  const state = {
    currencies: [],
    currencyMap: new Map(),
    settings: { baseCurrency: 'USD' },
    transactions: [],
    summary: null,
    amountsHidden: loadHiddenPref(),
  };

  const el = {
    baseCurrencySelect: document.getElementById('baseCurrencySelect'),
    currencySelect: document.getElementById('currencySelect'),
    amountInput: document.getElementById('amountInput'),
    dateInput: document.getElementById('dateInput'),
    addForm: document.getElementById('addForm'),
    formError: document.getElementById('formError'),
    submitBtn: document.querySelector('.submit-btn'),
    grandTotalValue: document.querySelector('#grandTotal .amount-value'),
    grandTotalCurrency: document.getElementById('grandTotalCurrency'),
    txCountHint: document.getElementById('txCountHint'),
    currencyChips: document.getElementById('currencyChips'),
    historyList: document.getElementById('historyList'),
    historyCount: document.getElementById('historyCount'),
    emptyState: document.getElementById('emptyState'),
    toast: document.getElementById('toast'),
    ratesList: document.getElementById('ratesList'),
    ratesUpdated: document.getElementById('ratesUpdated'),
    ratesRefreshBtn: document.getElementById('ratesRefreshBtn'),
    visibilityToggle: document.getElementById('visibilityToggle'),
  };

  const numberFormatCache = new Map();
  function formatNumber(value) {
    if (!numberFormatCache.has('n')) {
      numberFormatCache.set('n', new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    }
    return numberFormatCache.get('n').format(value);
  }

  function formatDate(isoDate) {
    const d = new Date(`${isoDate}T00:00:00`);
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }

  function formatRateValue(value) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  }

  function formatDateTime(isoString) {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(isoString)
    );
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // Прячем только цифры, сохраняя пробелы/разделители — силуэт числа
  // остаётся, а значение прочитать нельзя.
  function maskDigits(str) {
    return str.replace(/\d/g, '•');
  }

  async function api(path, options) {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Что-то пошло не так');
    }
    return res.status === 204 ? null : res.json();
  }

  function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = `toast show${type === 'error' ? ' error' : ''}`;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2600);
  }

  function currencyOptionsHTML() {
    return state.currencies
      .map((c) => `<option value="${c.code}">${c.flag} ${c.code} — ${c.symbol}</option>`)
      .join('');
  }

  function renderCurrencySelects() {
    el.currencySelect.innerHTML = currencyOptionsHTML();
    el.baseCurrencySelect.innerHTML = currencyOptionsHTML();
    el.baseCurrencySelect.value = state.settings.baseCurrency;
  }

  function renderSummary(summary) {
    state.summary = summary;

    const currency = state.currencyMap.get(summary.baseCurrency);
    const totalText = formatNumber(summary.grandTotal);
    el.grandTotalValue.textContent = state.amountsHidden ? maskDigits(totalText) : totalText;
    el.grandTotalCurrency.textContent = currency ? `${currency.symbol} ${currency.code}` : summary.baseCurrency;

    el.txCountHint.textContent = summary.transactionsCount
      ? `${summary.transactionsCount} ${pluralizeEntries(summary.transactionsCount)} · пересчитано ориентировочно`
      : 'Пока нет ни одного пополнения';

    const entries = Object.entries(summary.totalsByCurrency);
    el.currencyChips.innerHTML = entries.length
      ? entries
          .sort((a, b) => b[1] - a[1])
          .map(([code, amount]) => {
            const c = state.currencyMap.get(code);
            const amountText = `${formatNumber(amount)} ${c ? c.symbol : ''}`;
            return `<div class="chip">
              <span class="chip-flag">${c ? c.flag : ''}</span>
              <span class="chip-amount">${state.amountsHidden ? maskDigits(amountText) : amountText}</span>
              <span class="chip-code">${code}</span>
            </div>`;
          })
          .join('')
      : '';
  }

  function pluralizeEntries(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'пополнение';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'пополнения';
    return 'пополнений';
  }

  function renderRates(snapshot) {
    const usd = snapshot.rates.find((r) => r.code === 'USD');
    const usdSymbol = usd ? usd.symbol : '$';

    el.ratesList.innerHTML = snapshot.rates
      .filter((r) => r.code !== 'USD')
      .map(
        (r) => `<div class="rate-row">
          <span class="rate-pair">${r.flag} 1 ${r.code}</span>
          <span class="rate-value">${formatRateValue(r.rateToUSD)} ${usdSymbol}</span>
        </div>`
      )
      .join('');

    const isLive = snapshot.source === 'live';
    let statusText;
    if (isLive) {
      statusText = `Обновлено ${formatDateTime(snapshot.updatedAt)}`;
      if (snapshot.lastError) statusText += ' · последнее обновление не удалось';
    } else {
      statusText = 'Курс приблизительный — нет связи с сервером курсов';
    }
    el.ratesUpdated.textContent = statusText;
    el.ratesUpdated.classList.toggle('stale', !isLive);
  }

  async function refreshRates() {
    const snapshot = await api('/rates/refresh', { method: 'POST' });
    renderRates(snapshot);
    return snapshot;
  }

  function renderHistory() {
    el.historyCount.textContent = state.transactions.length ? `${state.transactions.length}` : '';

    if (!state.transactions.length) {
      el.historyList.innerHTML = '';
      el.historyList.appendChild(el.emptyState);
      return;
    }

    el.historyList.innerHTML = state.transactions
      .map((tx) => {
        const c = state.currencyMap.get(tx.currency);
        const amountText = `+${formatNumber(tx.amount)} ${c ? c.symbol : ''}`;
        return `<div class="history-item" data-id="${tx.id}">
          <div class="item-flag">${c ? c.flag : '💰'}</div>
          <div class="item-body">
            <div class="item-top">
              <span>${state.amountsHidden ? maskDigits(amountText) : amountText}</span>
              <span class="item-currency-code">${tx.currency}</span>
            </div>
            <div class="item-meta">${formatDate(tx.date)}</div>
          </div>
          <button class="item-delete" type="button" title="Удалить" aria-label="Удалить запись">✕</button>
        </div>`;
      })
      .join('');
  }

  async function loadAll() {
    const [currencies, settings, transactions, summary, rates] = await Promise.all([
      api('/currencies'),
      api('/settings'),
      api('/transactions'),
      api('/summary'),
      api('/rates'),
    ]);

    state.currencies = currencies;
    state.currencyMap = new Map(currencies.map((c) => [c.code, c]));
    state.settings = settings;
    state.transactions = transactions;

    renderCurrencySelects();
    renderHistory();
    renderSummary(summary);
    renderRates(rates);
  }

  async function refreshSummary() {
    const summary = await api('/summary');
    renderSummary(summary);
  }

  el.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.formError.textContent = '';

    const amount = parseFloat(el.amountInput.value);
    const currency = el.currencySelect.value;
    const date = el.dateInput.value || todayISO();

    if (!amount || amount <= 0) {
      el.formError.textContent = 'Введите сумму больше нуля';
      el.amountInput.focus();
      return;
    }

    el.submitBtn.disabled = true;
    el.submitBtn.classList.add('dropping');

    try {
      const tx = await api('/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount, currency, date }),
      });

      state.transactions.unshift(tx);
      renderHistory();
      await refreshSummary();

      const c = state.currencyMap.get(tx.currency);
      showToast(`Добавлено ${formatNumber(tx.amount)} ${c ? c.symbol : ''}`);

      el.amountInput.value = '';
      el.amountInput.focus();
    } catch (err) {
      el.formError.textContent = err.message;
      showToast(err.message, 'error');
    } finally {
      el.submitBtn.disabled = false;
      setTimeout(() => el.submitBtn.classList.remove('dropping'), 500);
    }
  });

  el.historyList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.item-delete');
    if (!btn) return;
    const item = btn.closest('.history-item');
    const id = item.dataset.id;

    item.classList.add('removing');
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' });
      setTimeout(async () => {
        state.transactions = state.transactions.filter((t) => t.id !== id);
        renderHistory();
        await refreshSummary();
      }, 220);
    } catch (err) {
      item.classList.remove('removing');
      showToast(err.message, 'error');
    }
  });

  el.baseCurrencySelect.addEventListener('change', async () => {
    try {
      state.settings = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ baseCurrency: el.baseCurrencySelect.value }),
      });
      await refreshSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  el.ratesRefreshBtn.addEventListener('click', async () => {
    el.ratesRefreshBtn.disabled = true;
    el.ratesRefreshBtn.classList.add('spinning');
    try {
      const snapshot = await refreshRates();
      await refreshSummary();
      if (snapshot.lastError) {
        showToast(`Не удалось обновить курсы: ${snapshot.lastError}`, 'error');
      } else {
        showToast('Курсы обновлены');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      el.ratesRefreshBtn.disabled = false;
      el.ratesRefreshBtn.classList.remove('spinning');
    }
  });

  function updateVisibilityToggleUI() {
    el.visibilityToggle.setAttribute('aria-pressed', state.amountsHidden ? 'true' : 'false');
    const label = state.amountsHidden ? 'Показать суммы' : 'Скрыть суммы';
    el.visibilityToggle.title = label;
    el.visibilityToggle.setAttribute('aria-label', label);
  }

  el.visibilityToggle.addEventListener('click', () => {
    state.amountsHidden = !state.amountsHidden;
    saveHiddenPref(state.amountsHidden);
    updateVisibilityToggleUI();
    if (state.summary) renderSummary(state.summary);
    renderHistory();
  });

  updateVisibilityToggleUI();

  el.dateInput.value = todayISO();
  el.dateInput.max = todayISO();

  loadAll().catch((err) => {
    console.error(err);
    showToast('Не удалось загрузить данные с сервера', 'error');
  });
})();
