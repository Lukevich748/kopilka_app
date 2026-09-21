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
    editingId: null,
    selectedDate: null,
    viewYear: null,
    viewMonth: null,
  };

  const el = {
    baseCurrencySelect: document.getElementById('baseCurrencySelect'),
    currencySelect: document.getElementById('currencySelect'),
    amountInput: document.getElementById('amountInput'),
    dateInputBtn: document.getElementById('dateInputBtn'),
    dateInputLabel: document.getElementById('dateInputLabel'),
    dateField: document.querySelector('.date-field'),
    datePicker: document.getElementById('datePicker'),
    datePickerTitle: document.getElementById('datePickerTitle'),
    datePickerGrid: document.getElementById('datePickerGrid'),
    datePrevMonth: document.getElementById('datePrevMonth'),
    dateNextMonth: document.getElementById('dateNextMonth'),
    dateTodayBtn: document.getElementById('dateTodayBtn'),
    addForm: document.getElementById('addForm'),
    formCard: document.querySelector('.form-card'),
    formTitle: document.getElementById('formTitle'),
    formError: document.getElementById('formError'),
    submitBtn: document.querySelector('.submit-btn'),
    submitBtnLabel: document.getElementById('submitBtnLabel'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
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

  function isoFromParts(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function updateDateLabel() {
    el.dateInputLabel.textContent = state.selectedDate === todayISO() ? 'Сегодня' : formatDate(state.selectedDate);
  }

  function renderDatePicker() {
    const title = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
      new Date(state.viewYear, state.viewMonth, 1)
    );
    el.datePickerTitle.textContent = title;

    const jsWeekday = new Date(state.viewYear, state.viewMonth, 1).getDay();
    const leadingCount = (jsWeekday + 6) % 7; // 0=Пн ... 6=Вс
    const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(state.viewYear, state.viewMonth, 0).getDate();

    const cells = [];
    for (let i = leadingCount - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const d = new Date(state.viewYear, state.viewMonth - 1, day);
      cells.push({ day, outside: true, iso: isoFromParts(d.getFullYear(), d.getMonth(), day) });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, outside: false, iso: isoFromParts(state.viewYear, state.viewMonth, day) });
    }
    const trailingCount = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= trailingCount; day++) {
      const d = new Date(state.viewYear, state.viewMonth + 1, day);
      cells.push({ day, outside: true, iso: isoFromParts(d.getFullYear(), d.getMonth(), day) });
    }

    const todayIso = todayISO();
    el.datePickerGrid.innerHTML = cells
      .map((cell) => {
        const classes = ['date-day'];
        if (cell.outside) classes.push('outside');
        if (cell.iso === todayIso) classes.push('today');
        if (cell.iso === state.selectedDate) classes.push('selected');
        const disabled = cell.iso > todayIso;
        return `<button type="button" class="${classes.join(' ')}" data-date="${cell.iso}"${disabled ? ' disabled' : ''}>${cell.day}</button>`;
      })
      .join('');
  }

  function handleDatePickerOutsideClick(e) {
    if (!e.target.closest('.date-field')) closeDatePicker();
  }

  function handleDatePickerKeydown(e) {
    if (e.key === 'Escape') closeDatePicker();
  }

  function openDatePicker() {
    const base = state.selectedDate || todayISO();
    const [y, m] = base.split('-').map(Number);
    state.viewYear = y;
    state.viewMonth = m - 1;
    renderDatePicker();
    el.datePicker.hidden = false;
    el.dateInputBtn.classList.add('open');
    el.dateInputBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleDatePickerOutsideClick);
    document.addEventListener('keydown', handleDatePickerKeydown);
  }

  function closeDatePicker() {
    el.datePicker.hidden = true;
    el.dateInputBtn.classList.remove('open');
    el.dateInputBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleDatePickerOutsideClick);
    document.removeEventListener('keydown', handleDatePickerKeydown);
  }

  // Прячем только цифры, сохраняя пробелы/разделители — силуэт числа
  // остаётся, а значение прочитать нельзя.
  function maskDigits(str) {
    return str.replace(/\d/g, '•');
  }

  // Разбивает целую часть по разрядам пробелами прямо во время ввода:
  // "1000000" -> "1 000 000". Разделитель дробной части (запятая или
  // точка) сохраняется таким, каким его набрал пользователь.
  function formatAmountString(raw) {
    let value = raw.replace(/[^\d.,]/g, '');

    const sepIndex = value.search(/[.,]/);
    let integerPart = value;
    let sep = '';
    let decimalPart = '';

    if (sepIndex !== -1) {
      sep = value[sepIndex];
      integerPart = value.slice(0, sepIndex);
      decimalPart = value.slice(sepIndex + 1).replace(/[.,]/g, '').slice(0, 2);
    }

    integerPart = integerPart.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
    const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    return sep ? `${grouped}${sep}${decimalPart}` : grouped;
  }

  function countDigits(str) {
    return (str.match(/\d/g) || []).length;
  }

  function cursorPositionForDigitCount(str, targetDigitCount) {
    if (targetDigitCount <= 0) return 0;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (/\d/.test(str[i])) {
        count += 1;
        if (count === targetDigitCount) return i + 1;
      }
    }
    return str.length;
  }

  // Как cursorPositionForDigitCount, но считает цифры только после
  // разделителя дробной части — иначе курсор, поставленный сразу после
  // запятой/точки, "откатывался" назад в целую часть.
  function cursorPositionAfterSeparator(str, decimalDigitsCount) {
    const sepIdx = str.search(/[.,]/);
    if (sepIdx === -1) return str.length;
    if (decimalDigitsCount <= 0) return sepIdx + 1;

    let count = 0;
    for (let i = sepIdx + 1; i < str.length; i++) {
      if (/\d/.test(str[i])) {
        count += 1;
        if (count === decimalDigitsCount) return i + 1;
      }
    }
    return str.length;
  }

  function reformatAmountInput(inputEl) {
    const prevValue = inputEl.value;
    const prevCursor = inputEl.selectionStart ?? prevValue.length;
    const beforeCursor = prevValue.slice(0, prevCursor);
    const sepPos = beforeCursor.search(/[.,]/);
    const cursorAfterSep = sepPos !== -1;
    const digitsBeforeCursor = cursorAfterSep
      ? countDigits(beforeCursor.slice(sepPos + 1))
      : countDigits(beforeCursor);

    const formatted = formatAmountString(prevValue);
    inputEl.value = formatted;

    const newCursor = cursorAfterSep
      ? cursorPositionAfterSeparator(formatted, digitsBeforeCursor)
      : cursorPositionForDigitCount(formatted, digitsBeforeCursor);
    inputEl.setSelectionRange(newCursor, newCursor);
  }

  // Из "1 000 000,50" (или с точкой) получаем обычное число 1000000.5
  function parseAmountInput(str) {
    const normalized = String(str).replace(/\s/g, '').replace(',', '.');
    return parseFloat(normalized);
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
        const isEditing = tx.id === state.editingId;
        return `<div class="history-item${isEditing ? ' editing' : ''}" data-id="${tx.id}">
          <div class="item-flag">${c ? c.flag : '💰'}</div>
          <div class="item-body">
            <div class="item-top">
              <span>${state.amountsHidden ? maskDigits(amountText) : amountText}</span>
              <span class="item-currency-code">${tx.currency}</span>
            </div>
            <div class="item-meta">${formatDate(tx.date)}</div>
          </div>
          <div class="item-actions">
            <button class="item-edit" type="button" title="Редактировать" aria-label="Редактировать запись">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="item-delete" type="button" title="Удалить" aria-label="Удалить запись">✕</button>
          </div>
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

  async function refreshTransactions() {
    state.transactions = await api('/transactions');
    renderHistory();
  }

  function enterEditMode(tx) {
    state.editingId = tx.id;
    el.amountInput.value = formatAmountString(String(tx.amount));
    el.currencySelect.value = tx.currency;
    state.selectedDate = tx.date;
    updateDateLabel();
    el.formTitle.textContent = 'Редактировать запись';
    el.submitBtnLabel.textContent = 'Сохранить изменения';
    el.cancelEditBtn.hidden = false;
    el.formError.textContent = '';
    renderHistory();
    el.formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.amountInput.focus();
  }

  function exitEditMode() {
    state.editingId = null;
    el.addForm.reset();
    state.selectedDate = todayISO();
    updateDateLabel();
    el.formTitle.textContent = 'Добавить накопление';
    el.submitBtnLabel.textContent = 'Положить в копилку';
    el.cancelEditBtn.hidden = true;
    el.formError.textContent = '';
    renderHistory();
  }

  el.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.formError.textContent = '';

    const amount = parseAmountInput(el.amountInput.value);
    const currency = el.currencySelect.value;
    const date = state.selectedDate || todayISO();

    if (!amount || amount <= 0) {
      el.formError.textContent = 'Введите сумму больше нуля';
      el.amountInput.focus();
      return;
    }

    const editingId = state.editingId;
    el.submitBtn.disabled = true;
    el.submitBtn.classList.add('dropping');

    try {
      if (editingId) {
        await api(`/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ amount, currency, date }),
        });

        await refreshTransactions();
        await refreshSummary();
        exitEditMode();
        showToast('Изменения сохранены');
      } else {
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
      }
    } catch (err) {
      el.formError.textContent = err.message;
      showToast(err.message, 'error');
    } finally {
      el.submitBtn.disabled = false;
      setTimeout(() => el.submitBtn.classList.remove('dropping'), 500);
    }
  });

  el.cancelEditBtn.addEventListener('click', () => {
    exitEditMode();
  });

  el.historyList.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.item-edit');
    if (editBtn) {
      const id = editBtn.closest('.history-item').dataset.id;
      const tx = state.transactions.find((t) => t.id === id);
      if (tx) enterEditMode(tx);
      return;
    }

    const deleteBtn = e.target.closest('.item-delete');
    if (!deleteBtn) return;
    const item = deleteBtn.closest('.history-item');
    const id = item.dataset.id;

    item.classList.add('removing');
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' });
      if (id === state.editingId) exitEditMode();
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

  el.amountInput.addEventListener('input', () => {
    reformatAmountInput(el.amountInput);
  });

  el.dateInputBtn.addEventListener('click', () => {
    if (el.datePicker.hidden) openDatePicker();
    else closeDatePicker();
  });

  el.datePrevMonth.addEventListener('click', () => {
    state.viewMonth -= 1;
    if (state.viewMonth < 0) {
      state.viewMonth = 11;
      state.viewYear -= 1;
    }
    renderDatePicker();
  });

  el.dateNextMonth.addEventListener('click', () => {
    state.viewMonth += 1;
    if (state.viewMonth > 11) {
      state.viewMonth = 0;
      state.viewYear += 1;
    }
    renderDatePicker();
  });

  el.datePickerGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.date-day');
    if (!btn || btn.disabled) return;
    state.selectedDate = btn.dataset.date;
    updateDateLabel();
    closeDatePicker();
  });

  el.dateTodayBtn.addEventListener('click', () => {
    state.selectedDate = todayISO();
    updateDateLabel();
    closeDatePicker();
  });

  state.selectedDate = todayISO();
  updateDateLabel();

  loadAll().catch((err) => {
    console.error(err);
    showToast('Не удалось загрузить данные с сервера', 'error');
  });
})();
