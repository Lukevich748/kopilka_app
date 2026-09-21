(() => {
  const state = {
    currencies: [],
    currencyMap: new Map(),
    settings: { baseCurrency: 'USD' },
    transactions: [],
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

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
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
    const currency = state.currencyMap.get(summary.baseCurrency);
    el.grandTotalValue.textContent = formatNumber(summary.grandTotal);
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
            return `<div class="chip">
              <span class="chip-flag">${c ? c.flag : ''}</span>
              <span class="chip-amount">${formatNumber(amount)} ${c ? c.symbol : ''}</span>
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
        return `<div class="history-item" data-id="${tx.id}">
          <div class="item-flag">${c ? c.flag : '💰'}</div>
          <div class="item-body">
            <div class="item-top">
              <span>+${formatNumber(tx.amount)} ${c ? c.symbol : ''}</span>
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
    const [currencies, settings, transactions, summary] = await Promise.all([
      api('/currencies'),
      api('/settings'),
      api('/transactions'),
      api('/summary'),
    ]);

    state.currencies = currencies;
    state.currencyMap = new Map(currencies.map((c) => [c.code, c]));
    state.settings = settings;
    state.transactions = transactions;

    renderCurrencySelects();
    renderHistory();
    renderSummary(summary);
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

  el.dateInput.value = todayISO();
  el.dateInput.max = todayISO();

  loadAll().catch((err) => {
    console.error(err);
    showToast('Не удалось загрузить данные с сервера', 'error');
  });
})();
