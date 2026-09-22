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

  const RATE_NOMINALS_KEY = 'kopilka:rateNominals';

  function loadRateNominals() {
    try {
      const raw = JSON.parse(localStorage.getItem(RATE_NOMINALS_KEY));
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  function saveRateNominals(nominals) {
    try {
      localStorage.setItem(RATE_NOMINALS_KEY, JSON.stringify(nominals));
    } catch {
      /* приватный режим браузера — просто не сохраняем предпочтение */
    }
  }

  const CHART_COLLAPSED_KEY = 'kopilka:chartCollapsed';

  function loadChartCollapsedPref() {
    try {
      return localStorage.getItem(CHART_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function saveChartCollapsedPref(collapsed) {
    try {
      localStorage.setItem(CHART_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* приватный режим браузера — просто не сохраняем предпочтение */
    }
  }

  const state = {
    currencies: [],
    currencyMap: new Map(),
    settings: { baseCurrency: 'USD', enabledCurrencies: ['USD', 'EUR', 'PLN', 'RUB', 'BYN'] },
    ratesSnapshot: null,
    rateNominals: loadRateNominals(),
    transactions: [],
    summary: null,
    chartData: null,
    chartGeometry: null,
    chartCollapsed: loadChartCollapsedPref(),
    amountsHidden: loadHiddenPref(),
    transactionType: 'deposit',
    editingId: null,
    totalVisible: true,
    pendingTotalText: null,
    selectedDate: null,
    viewYear: null,
    viewMonth: null,
  };

  const el = {
    app: document.getElementById('app'),
    loginScreen: document.getElementById('loginScreen'),
    loginSubtitle: document.getElementById('loginSubtitle'),
    loginHint: document.getElementById('loginHint'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    loginError: document.getElementById('loginError'),
    logoutBtn: document.getElementById('logoutBtn'),
    baseCurrencySelect: document.getElementById('baseCurrencySelect'),
    currencySelect: document.getElementById('currencySelect'),
    amountInput: document.getElementById('amountInput'),
    commentInput: document.getElementById('commentInput'),
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
    typeDepositBtn: document.getElementById('typeDepositBtn'),
    typeWithdrawBtn: document.getElementById('typeWithdrawBtn'),
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
    ratesPanel: document.querySelector('.rates-panel'),
    ratesFlip: document.getElementById('ratesFlip'),
    ratesFaceFront: document.querySelector('.rates-face-front'),
    ratesFaceBack: document.querySelector('.rates-face-back'),
    ratesList: document.getElementById('ratesList'),
    ratesUpdated: document.getElementById('ratesUpdated'),
    ratesRefreshBtn: document.getElementById('ratesRefreshBtn'),
    ratesNominalBtn: document.getElementById('ratesNominalBtn'),
    ratesNominalCloseBtn: document.getElementById('ratesNominalCloseBtn'),
    ratesNominalList: document.getElementById('ratesNominalList'),
    visibilityToggle: document.getElementById('visibilityToggle'),
    chartCollapseBtn: document.getElementById('chartCollapseBtn'),
    chartBody: document.getElementById('chartBody'),
    chartWrap: document.getElementById('chartWrap'),
    chartSvg: document.getElementById('chartSvg'),
    chartGrid: document.getElementById('chartGrid'),
    chartArea: document.getElementById('chartArea'),
    chartLine: document.getElementById('chartLine'),
    chartCrosshair: document.getElementById('chartCrosshair'),
    chartHoverPulseRing: document.getElementById('chartHoverPulseRing'),
    chartHoverDot: document.getElementById('chartHoverDot'),
    chartEndDot: document.getElementById('chartEndDot'),
    chartEndLabel: document.getElementById('chartEndLabel'),
    chartXLabels: document.getElementById('chartXLabels'),
    chartTooltip: document.getElementById('chartTooltip'),
    chartTooltipMonth: document.getElementById('chartTooltipMonth'),
    chartTooltipTotal: document.getElementById('chartTooltipTotal'),
    chartTooltipAdded: document.getElementById('chartTooltipAdded'),
    chartEmpty: document.getElementById('chartEmpty'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    settingsCloseBtn: document.getElementById('settingsCloseBtn'),
    currencyToggleList: document.getElementById('currencyToggleList'),
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

  // CSS text-transform:capitalize would also uppercase the trailing "г." in
  // "сентябрь 2026 г." — capitalize just the first letter instead.
  function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    el.datePickerTitle.textContent = capitalizeFirst(title);

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

  // ---------- "Барабан" для анимации итоговой суммы (как в Revolut) ----------
  // Каждая цифра — лента 0-9 в окошке высотой 1em, которая переезжает
  // transform'ом к нужной цифре. Меняются transform'ом только те разряды,
  // которые реально изменились с прошлого рендера.
  const ODOMETER_DIGITS = '0123456789';
  const ODOMETER_SETTLE_EM_FRACTION = 0.3; // остаток < 30% высоты ОДНОЙ ячейки — целевая цифра уже явно доминирует в окошке
  const ODOMETER_SETTLE_TIMEOUT_MS = 1200; // страховка на случай, если движение почему-то не завершится

  // Порог "доехало" должен быть долей высоты ОДНОЙ ячейки (em), а не долей
  // всего пути разряда: если мерить в процентах от пути, разряд, едущий на
  // несколько позиций (например с '9' на '0'), на моменте "90% пройдено"
  // всё ещё физически показывает в окошке СОСЕДНЮЮ цифру (остаток больше
  // полуячейки) — то есть не смазанный ноль, а чужую цифру целиком. Порог же
  // в долях одной ячейки не зависит от того, сколько позиций проехала лента.
  function waitForStripsSettled(pending, onSettled) {
    const startedAt = performance.now();

    // emPx и целевая позиция за время анимации не меняются — считаем их
    // один раз здесь, а не внутри check(): getBoundingClientRect() форсирует
    // layout, и повторять это ежекадрово для каждого разряда до самого
    // конца анимации — лишняя работа без всякой пользы.
    const gauges = pending.map(({ strip, target }) => {
      const emPx = strip.parentElement.getBoundingClientRect().height || 1;
      return {
        strip,
        targetY: -ODOMETER_DIGITS.indexOf(target) * emPx,
        epsilon: emPx * ODOMETER_SETTLE_EM_FRACTION,
      };
    });

    function isSettled({ strip, targetY, epsilon }) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
      return Math.abs(matrix.m42 - targetY) < epsilon;
    }

    function check() {
      const timedOut = performance.now() - startedAt > ODOMETER_SETTLE_TIMEOUT_MS;
      if (timedOut || gauges.every(isSettled)) {
        onSettled();
        return;
      }
      requestAnimationFrame(check);
    }

    requestAnimationFrame(check);
  }

  function buildOdometerStrip(startDigit) {
    const strip = document.createElement('span');
    strip.className = 'odometer-strip';
    strip.innerHTML = ODOMETER_DIGITS.split('')
      .map((d) => `<span class="odometer-cell">${d}</span>`)
      .join('');
    setOdometerStripDigit(strip, startDigit);
    return strip;
  }

  function createStaticSpan(ch) {
    const span = document.createElement('span');
    span.className = 'odometer-static';
    span.textContent = ch;
    return span;
  }

  // Для перерисовки "с нуля", где анимация не нужна вообще (первая отрисовка
  // при загрузке страницы, переключение маски приватности).
  function createOdometerDigit(digitChar) {
    const wrap = document.createElement('span');
    wrap.className = 'odometer-digit';
    const strip = buildOdometerStrip(digitChar);
    strip.classList.add('no-anim');
    wrap.appendChild(strip);

    // Снимаем no-anim на следующий кадр, чтобы первая расстановка не ехала,
    // а все последующие обновления уже анимировались.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => strip.classList.remove('no-anim'));
    });

    return wrap;
  }

  // Для роста числа разрядов: лента сразу готова ехать (без no-anim), просто
  // стартует с startDigit — переезд к целевой цифре запускается отдельно.
  function createOdometerDigitAnimatable(startDigit) {
    const wrap = document.createElement('span');
    wrap.className = 'odometer-digit';
    const strip = buildOdometerStrip(startDigit);
    wrap.appendChild(strip);
    return { wrap, strip };
  }

  function setOdometerStripDigit(strip, digitChar) {
    const index = ODOMETER_DIGITS.indexOf(digitChar);
    strip.style.transform = `translateY(-${index < 0 ? 0 : index}em)`;
  }

  function odometerSignature(text) {
    return text.replace(/\d/g, 'D');
  }

  function hasMaskChar(text) {
    return text.indexOf('•') !== -1;
  }

  function updateOdometerInPlace(container, prevText, text) {
    const children = container.children;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === prevText[i]) continue; // не изменилось — не трогаем, без анимации
      if (/\d/.test(ch)) {
        setOdometerStripDigit(children[i].querySelector('.odometer-strip'), ch);
      } else {
        children[i].textContent = ch;
      }
    }
  }

  function rebuildOdometer(container, text) {
    container.innerHTML = '';
    for (const ch of text) {
      container.appendChild(/\d/.test(ch) ? createOdometerDigit(ch) : createStaticSpan(ch));
    }
  }

  // Общая раскладка для изменения КОЛИЧЕСТВА разрядов (рост или уменьшение) —
  // выравниваем по правому краю относительно более ДЛИННОЙ из двух строк:
  //
  //  - при росте (0 -> 100, 1 000 -> 10 000)  длиннее НОВОЕ значение:
  //    существующие разряды доезжают до новых цифр, а новые старшие разряды
  //    слева "въезжают" с нуля — как в реальном механическом одометре;
  //  - при уменьшении (100 -> 0, 10 000 -> 1 000) длиннее СТАРОЕ значение:
  //    держим старое количество разрядов, пока едет анимация, лишние старшие
  //    разряды слева докручиваются до '0', а по завершении переезда лент их
  //    тихо убирают из DOM (см. shrinking-ветку ниже) — без видимого скачка.
  function rebuildOdometerAligned(container, prevText, text, shrinking) {
    const oldChars = prevText.split('');
    const newChars = text.split('');
    const domChars = shrinking ? oldChars : newChars; // раскладка DOM на время самой анимации
    const otherChars = shrinking ? newChars : oldChars;
    const diff = domChars.length - otherChars.length;

    container.innerHTML = '';
    const pending = [];

    domChars.forEach((domCh, i) => {
      if (!/\d/.test(domCh)) {
        container.appendChild(createStaticSpan(domCh));
        return;
      }
      const otherCh = i >= diff ? otherChars[i - diff] : null;
      const fallback = otherCh && /\d/.test(otherCh) ? otherCh : '0';
      const startDigit = shrinking ? domCh : fallback;
      const targetDigit = shrinking ? fallback : domCh;
      const { wrap, strip } = createOdometerDigitAnimatable(startDigit);
      container.appendChild(wrap);
      pending.push({ strip, target: targetDigit });
    });

    void container.offsetHeight; // форсируем layout со стартовыми позициями

    const token = (container._odometerShrinkToken = (container._odometerShrinkToken || 0) + 1);

    requestAnimationFrame(() => {
      pending.forEach(({ strip, target }) => setOdometerStripDigit(strip, target));
      if (!shrinking) return;
      waitForStripsSettled(pending, () => {
        if (container._odometerShrinkToken === token) rebuildOdometer(container, text);
      });
    });
  }

  function rebuildOdometerGrowth(container, prevText, text) {
    rebuildOdometerAligned(container, prevText, text, false);
  }

  function rebuildOdometerShrink(container, prevText, text) {
    rebuildOdometerAligned(container, prevText, text, true);
  }

  function renderOdometerValue(container, text) {
    const prevText = container.dataset.odometerText;

    // Инвалидируем незавершённый опрос "доехала ли лента" от предыдущего
    // сокращения разрядности, если до его завершения прилетел новый рендер.
    container._odometerShrinkToken = (container._odometerShrinkToken || 0) + 1;

    if (prevText === undefined) {
      rebuildOdometer(container, text);
      container.dataset.odometerText = text;
      return;
    }
    if (prevText === text) return;

    const sameLayout = prevText.length === text.length && odometerSignature(prevText) === odometerSignature(text);
    const maskFree = !hasMaskChar(prevText) && !hasMaskChar(text);

    if (sameLayout) {
      updateOdometerInPlace(container, prevText, text);
    } else if (text.length > prevText.length && maskFree) {
      rebuildOdometerGrowth(container, prevText, text);
    } else if (text.length < prevText.length && maskFree) {
      rebuildOdometerShrink(container, prevText, text);
    } else {
      rebuildOdometer(container, text);
    }

    container.dataset.odometerText = text;
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

  function enabledCurrencyList() {
    const enabled = new Set(state.settings.enabledCurrencies || []);
    return state.currencies.filter((c) => enabled.has(c.code));
  }

  function currencyOptionsHTML(list) {
    return list.map((c) => `<option value="${c.code}">${c.flag} ${c.code} — ${c.symbol}</option>`).join('');
  }

  function renderCurrencySelects() {
    const options = currencyOptionsHTML(enabledCurrencyList());
    el.currencySelect.innerHTML = options;
    el.baseCurrencySelect.innerHTML = options;
    el.baseCurrencySelect.value = state.settings.baseCurrency;
  }

  function renderSummary(summary) {
    state.summary = summary;

    const currency = state.currencyMap.get(summary.baseCurrency);
    const totalText = formatNumber(summary.grandTotal);
    const displayText = state.amountsHidden ? maskDigits(totalText) : totalText;

    // Пока сумма не появилась на экране (проматали ниже — к форме, истории),
    // не проигрываем "барабан" вслепую — просто запоминаем целевое значение
    // и покажем его с анимацией, когда пользователь долистает до суммы.
    if (state.totalVisible) {
      renderOdometerValue(el.grandTotalValue, displayText);
      state.pendingTotalText = null;
    } else {
      state.pendingTotalText = displayText;
    }
    el.grandTotalCurrency.textContent = currency ? currency.code : summary.baseCurrency;

    el.txCountHint.textContent = summary.transactionsCount
      ? `${summary.transactionsCount} ${pluralizeEntries(summary.transactionsCount)} · пересчитано ориентировочно`
      : 'Пока нет ни одной операции';

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
    if (mod10 === 1 && mod100 !== 11) return 'операция';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'операции';
    return 'операций';
  }

  // Номинал — во сколько единиц валюты показывать курс (по умолчанию 1,
  // но для мелких валют вроде RUB удобнее видеть курс за 10 или 100).
  function getRateNominal(code) {
    const n = state.rateNominals[code];
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function visibleRates() {
    if (!state.ratesSnapshot) return [];
    const enabled = new Set(state.settings.enabledCurrencies || []);
    return state.ratesSnapshot.rates.filter((r) => r.code !== 'USD' && enabled.has(r.code));
  }

  // Лицевая сторона карточки — сам список курсов + статус обновления.
  // Вынесена отдельно от renderRates, чтобы пересчитывать её на каждый ввод
  // номинала, не трогая при этом поля ввода на обратной стороне (иначе
  // пересборка их DOM-узлов на каждое нажатие клавиши сбивала бы фокус).
  function renderRatesFront() {
    if (!state.ratesSnapshot) return;
    const usd = state.ratesSnapshot.rates.find((r) => r.code === 'USD');
    const usdSymbol = usd ? usd.symbol : '$';

    el.ratesList.innerHTML = visibleRates()
      .map((r) => {
        const nominal = getRateNominal(r.code);
        return `<div class="rate-row">
          <span class="rate-pair">${r.flag} ${nominal} ${r.code}</span>
          <span class="rate-value">${formatRateValue(r.rateToUSD * nominal)} ${usdSymbol}</span>
        </div>`;
      })
      .join('');

    const isLive = state.ratesSnapshot.source === 'live';
    let statusText;
    if (isLive) {
      statusText = `Обновлено ${formatDateTime(state.ratesSnapshot.updatedAt)}`;
      if (state.ratesSnapshot.lastError) statusText += ' · последнее обновление не удалось';
    } else {
      statusText = 'Курс приблизительный — нет связи с сервером курсов';
    }
    el.ratesUpdated.textContent = statusText;
    el.ratesUpdated.classList.toggle('stale', !isLive);
  }

  function renderRatesNominalList() {
    // EUR по курсу близок к USD — менять для него номинал не имеет смысла,
    // поэтому на обратной стороне его не показываем (в отличие от лицевой).
    el.ratesNominalList.innerHTML = visibleRates()
      .filter((r) => r.code !== 'EUR')
      .map(
        (r) => `<div class="rate-nominal-row">
          <span class="rate-pair">${r.flag} ${r.code}</span>
          <input type="text" inputmode="numeric" class="rate-nominal-input" data-code="${r.code}" value="${getRateNominal(r.code)}">
        </div>`
      )
      .join('');
  }

  // Высота подстраивается под ТЕКУЩУЮ видимую сторону, а не под большую из
  // двух — иначе на более короткой стороне снизу оставался пустой отступ
  // до высоты более длинной.
  // Сторона позиционирована absolute внутри .rates-flip, поэтому её
  // scrollHeight отражает уже применённую (текущую) высоту .rates-flip,
  // а не то, сколько реально нужно контенту. offsetTop/offsetHeight, в
  // отличие от getBoundingClientRect(), считаются по раскладке ДО
  // применения transform — а значит не "плывут", пока ещё доигрывают
  // входные CSS-анимации карточки (.summary-card/.rates-panel), в отличие
  // от первой версии этой функции.
  function measureFaceHeight(face) {
    const lastChild = face.lastElementChild;
    if (!lastChild) return 0;
    const paddingBottom = parseFloat(getComputedStyle(face).paddingBottom) || 0;
    return Math.ceil(lastChild.offsetTop + lastChild.offsetHeight + paddingBottom);
  }

  // .rates-flip всегда точно по размеру видимой стороны (без пустого
  // отступа снизу на более короткой), а вот .rates-panel — "слот" вокруг
  // неё — держим равным большей из двух сторон, иначе вся строка
  // .summary-card уменьшалась бы вместе с карточкой при перевороте на
  // более короткую сторону (обе стороны при этом лежат в DOM всегда,
  // измерить можно независимо от того, какая сейчас видна).
  function syncRatesFlipHeight() {
    if (!el.ratesFlip) return;
    const frontH = measureFaceHeight(el.ratesFaceFront);
    const backH = measureFaceHeight(el.ratesFaceBack);
    const flipped = el.ratesFlip.classList.contains('flipped');
    el.ratesFlip.style.height = `${flipped ? backH : frontH}px`;
    el.ratesPanel.style.height = `${Math.max(frontH, backH)}px`;
  }

  function renderRates(snapshot) {
    state.ratesSnapshot = snapshot;
    renderRatesFront();
    renderRatesNominalList();
    syncRatesFlipHeight();
  }

  function setRatesFlipped(flipped) {
    el.ratesFlip.classList.toggle('flipped', flipped);
    el.ratesNominalBtn.setAttribute('aria-pressed', String(flipped));
    syncRatesFlipHeight();
  }

  async function refreshRates() {
    const snapshot = await api('/rates/refresh', { method: 'POST' });
    renderRates(snapshot);
    return snapshot;
  }

  // ---------- Chart (динамика накоплений по месяцам) ----------
  const CHART_W = 640;
  const CHART_H = 240;
  const CHART_MARGIN = { left: 50, right: 16, top: 20, bottom: 28 };

  function niceCeil(value) {
    if (value <= 0) return 100;
    const exponent = Math.floor(Math.log10(value));
    const magnitude = Math.pow(10, exponent);
    const fraction = value / magnitude;
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * magnitude;
  }

  function monthLabel(monthKey, { short } = {}) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const text = new Intl.DateTimeFormat('ru-RU', short ? { month: 'short' } : { month: 'long', year: 'numeric' }).format(d);
    return short ? text : capitalizeFirst(text);
  }

  function renderChart(data) {
    state.chartData = data;
    const points = data.points;

    if (points.length < 2) {
      state.chartGeometry = null;
      el.chartWrap.hidden = true;
      el.chartEmpty.hidden = false;
      return;
    }
    el.chartWrap.hidden = false;
    el.chartEmpty.hidden = true;

    // ViewBox is set to the SVG's own rendered pixel size (measured after
    // un-hiding it above) so 1 viewBox unit == 1 CSS px in both directions.
    // Without this, a fixed viewBox stretched to a much wider card via
    // preserveAspectRatio would scale X and Y differently and visibly
    // distort the line and every label.
    const width = el.chartSvg.clientWidth || CHART_W;
    const height = el.chartSvg.clientHeight || CHART_H;
    el.chartSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const currency = state.currencyMap.get(data.baseCurrency);
    const symbol = currency ? currency.symbol : '';

    const { left, right, top, bottom } = CHART_MARGIN;
    const plotLeft = left;
    const plotRight = width - right;
    const plotTop = top;
    const plotBottom = height - bottom;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    const maxTotal = Math.max(...points.map((p) => p.total), 0);
    const yMax = niceCeil((maxTotal || 100) * 1.08);

    const xAt = (i) => plotLeft + (i / (points.length - 1)) * plotWidth;
    const yAt = (v) => plotBottom - (v / yMax) * plotHeight;

    state.chartGeometry = { points, xAt, yAt, plotTop, plotBottom, symbol };

    const tickFractions = [0, 0.5, 1];
    el.chartGrid.innerHTML = tickFractions
      .map((f) => {
        const y = plotBottom - f * plotHeight;
        const valueText = formatNumber(f * yMax);
        const label = state.amountsHidden ? maskDigits(valueText) : valueText;
        return `<line class="chart-gridline" x1="${plotLeft}" y1="${y.toFixed(2)}" x2="${plotRight}" y2="${y.toFixed(2)}"></line>
          <text class="chart-tick-label" x="${plotLeft - 8}" y="${(y + 4).toFixed(2)}" text-anchor="end">${label}</text>`;
      })
      .join('');

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.total).toFixed(2)}`).join(' ');
    el.chartLine.setAttribute('d', linePath);
    const areaPath = `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${plotBottom} L ${xAt(0).toFixed(2)} ${plotBottom} Z`;
    el.chartArea.setAttribute('d', areaPath);

    const lastIndex = points.length - 1;
    const lastX = xAt(lastIndex);
    const lastY = yAt(points[lastIndex].total);
    el.chartEndDot.setAttribute('cx', lastX.toFixed(2));
    el.chartEndDot.setAttribute('cy', lastY.toFixed(2));

    const endValueText = formatNumber(points[lastIndex].total);
    el.chartEndLabel.textContent = `${state.amountsHidden ? maskDigits(endValueText) : endValueText} ${symbol}`;
    el.chartEndLabel.setAttribute('text-anchor', 'end');
    el.chartEndLabel.setAttribute('x', (lastX - 8).toFixed(2));
    el.chartEndLabel.setAttribute('y', Math.max(lastY - 12, 12).toFixed(2));

    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(points.length / maxLabels));
    el.chartXLabels.innerHTML = points
      .map((p, i) => {
        if (i % step !== 0 && i !== points.length - 1) return '';
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
        return `<text class="chart-x-label" x="${xAt(i).toFixed(2)}" y="${height - 8}" style="text-anchor:${anchor}">${monthLabel(p.month, { short: true })}</text>`;
      })
      .join('');
  }

  async function refreshChart() {
    const data = await api('/history-chart');
    renderChart(data);
  }

  // Сворачивает/разворачивает тело карточки графика (сам график + пустое
  // состояние) плавным изменением высоты. Двойной rAF — тот же приём, что
  // и в collapseHistoryListToEmptyState: одного forced reflow не всегда
  // достаточно, чтобы браузер гарантированно зафиксировал стартовое
  // состояние отдельным кадром перед стартом transition.
  function setChartCollapsed(collapsed, { animate = true } = {}) {
    state.chartCollapsed = collapsed;
    saveChartCollapsedPref(collapsed);
    el.chartCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
    el.chartCollapseBtn.classList.toggle('collapsed', collapsed);

    const body = el.chartBody;

    if (!animate) {
      body.style.height = collapsed ? '0px' : '';
      body.style.opacity = collapsed ? '0' : '';
      body.style.overflow = collapsed ? 'hidden' : '';
      return;
    }

    const startHeight = body.getBoundingClientRect().height;
    body.style.overflow = 'hidden';
    body.style.height = `${startHeight}px`;
    body.style.opacity = collapsed ? '1' : '0';
    void body.offsetHeight; // форсируем layout с исходной высотой

    let targetHeight = 0;
    if (!collapsed) {
      body.style.height = 'auto';
      targetHeight = body.getBoundingClientRect().height;
      body.style.height = `${startHeight}px`;
      void body.offsetHeight;
    }

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      body.style.transition = '';
      body.style.height = collapsed ? '0px' : '';
      body.style.overflow = collapsed ? 'hidden' : '';
    };

    requestAnimationFrame(() => {
      void body.offsetHeight;
      body.style.transition = 'height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease';
      requestAnimationFrame(() => {
        body.style.height = `${collapsed ? 0 : targetHeight}px`;
        body.style.opacity = collapsed ? '0' : '1';
      });
    });

    body.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 450);
  }

  function svgCoordsFromEvent(evt) {
    const rect = el.chartSvg.getBoundingClientRect();
    const viewBox = el.chartSvg.viewBox.baseVal;
    return {
      x: ((evt.clientX - rect.left) / rect.width) * viewBox.width,
      rect,
      viewBox,
    };
  }

  function handleChartPointerMove(evt) {
    if (!state.chartGeometry) return;
    const { x, rect, viewBox } = svgCoordsFromEvent(evt);
    const { points, xAt, yAt, plotTop, plotBottom, symbol } = state.chartGeometry;

    let nearest = 0;
    let minDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - x);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });

    const p = points[nearest];
    const px = xAt(nearest);
    const py = yAt(p.total);

    el.chartCrosshair.setAttribute('x1', px.toFixed(2));
    el.chartCrosshair.setAttribute('x2', px.toFixed(2));
    el.chartCrosshair.setAttribute('y1', plotTop);
    el.chartCrosshair.setAttribute('y2', plotBottom);
    el.chartCrosshair.setAttribute('visibility', 'visible');

    el.chartHoverDot.setAttribute('cx', px.toFixed(2));
    el.chartHoverDot.setAttribute('cy', py.toFixed(2));
    el.chartHoverDot.setAttribute('visibility', 'visible');

    el.chartHoverPulseRing.setAttribute('cx', px.toFixed(2));
    el.chartHoverPulseRing.setAttribute('cy', py.toFixed(2));
    el.chartHoverPulseRing.setAttribute('visibility', 'visible');

    const pxPixels = (px / viewBox.width) * rect.width;
    const pyPixels = (py / viewBox.height) * rect.height;
    el.chartTooltip.style.left = `${pxPixels}px`;
    el.chartTooltip.style.top = `${Math.max(pyPixels - 10, 10)}px`;
    el.chartTooltip.hidden = false;

    el.chartTooltipMonth.textContent = monthLabel(p.month);
    const totalText = formatNumber(p.total);
    el.chartTooltipTotal.textContent = `${state.amountsHidden ? maskDigits(totalText) : totalText} ${symbol}`;

    if (p.added > 0) {
      const addedText = formatNumber(p.added);
      el.chartTooltipAdded.textContent = `+${state.amountsHidden ? maskDigits(addedText) : addedText} ${symbol} за месяц`;
      el.chartTooltipAdded.hidden = false;
    } else {
      el.chartTooltipAdded.hidden = true;
    }
  }

  function handleChartPointerLeave() {
    el.chartCrosshair.setAttribute('visibility', 'hidden');
    el.chartHoverPulseRing.setAttribute('visibility', 'hidden');
    el.chartHoverDot.setAttribute('visibility', 'hidden');
    el.chartTooltip.hidden = true;
  }

  el.chartSvg.addEventListener('pointermove', handleChartPointerMove);
  el.chartSvg.addEventListener('pointerleave', handleChartPointerLeave);

  const HISTORY_ITEM_TEMPLATE = `
    <div class="item-flag"></div>
    <div class="item-body">
      <div class="item-top">
        <span class="item-amount"></span>
        <span class="item-currency-code"></span>
      </div>
      <div class="item-meta"></div>
      <div class="item-comment"></div>
    </div>
    <div class="item-actions">
      <button class="item-edit" type="button" title="Редактировать" aria-label="Редактировать запись">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
      <button class="item-delete" type="button" title="Удалить" aria-label="Удалить запись"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      <button class="item-delete-confirm" type="button" title="Подтвердить удаление" aria-label="Подтвердить удаление">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </button>
    </div>`;

  // Обновляет только то, что реально зависит от суммы/маски приватности —
  // используется и при первой отрисовке записи, и при переключении глазика,
  // без пересоздания DOM-узла.
  function updateHistoryItemAmount(itemEl, tx) {
    const c = state.currencyMap.get(tx.currency);
    const isWithdrawal = tx.type === 'withdrawal';
    const amountText = `${isWithdrawal ? '−' : '+'}${formatNumber(tx.amount)} ${c ? c.symbol : ''}`;
    const amountEl = itemEl.querySelector('.item-amount');
    amountEl.textContent = state.amountsHidden ? maskDigits(amountText) : amountText;
    amountEl.classList.toggle('negative', isWithdrawal);
  }

  function createHistoryItemElement(tx) {
    const c = state.currencyMap.get(tx.currency);
    const isWithdrawal = tx.type === 'withdrawal';
    const itemEl = document.createElement('div');
    itemEl.className = `history-item${tx.id === state.editingId ? ' editing' : ''}${isWithdrawal ? ' withdrawal' : ''}`;
    itemEl.dataset.id = tx.id;
    itemEl.innerHTML = HISTORY_ITEM_TEMPLATE;
    const flagEl = itemEl.querySelector('.item-flag');
    if (c) {
      flagEl.textContent = c.flag;
    } else {
      flagEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/></svg>';
    }
    itemEl.querySelector('.item-currency-code').textContent = tx.currency;
    itemEl.querySelector('.item-meta').textContent = formatDate(tx.date);
    const commentEl = itemEl.querySelector('.item-comment');
    if (tx.comment) {
      commentEl.textContent = tx.comment;
    } else {
      commentEl.remove();
    }
    updateHistoryItemAmount(itemEl, tx);
    return itemEl;
  }

  function showEmptyHistoryState() {
    // На случай, если плейсхолдер до этого использовался в ручном
    // crossfade-переходе (collapseHistoryListToEmptyState) и остался с
    // зафиксированными инлайн-style opacity/animation — сбрасываем их,
    // чтобы здесь снова сработала обычная CSS-анимация появления "rise".
    el.emptyState.style.opacity = '';
    el.emptyState.style.animation = '';
    el.historyList.innerHTML = '';
    el.historyList.appendChild(el.emptyState);
  }

  // Полная перерисовка — только когда список данных реально пересобрали
  // целиком (первая загрузка, перечитывание после сохранения правки).
  // Точечные операции (добавление/удаление одной записи, смена маски,
  // подсветка редактируемой строки) не должны трогать остальные узлы —
  // иначе все строки одновременно переигрывают анимацию появления и
  // список на секунду "подвисает".
  function renderHistory() {
    el.historyCount.textContent = state.transactions.length ? `${state.transactions.length}` : '';

    if (!state.transactions.length) {
      showEmptyHistoryState();
      return;
    }

    const fragment = document.createDocumentFragment();
    state.transactions.forEach((tx) => fragment.appendChild(createHistoryItemElement(tx)));
    el.historyList.innerHTML = '';
    el.historyList.appendChild(fragment);
  }

  // Добавляет одну новую запись в начало списка без пересборки остальных.
  function prependHistoryItem(tx) {
    if (!el.historyList.querySelector('.history-item')) {
      el.historyList.innerHTML = '';
    }
    el.historyList.insertBefore(createHistoryItemElement(tx), el.historyList.firstChild);
    el.historyCount.textContent = state.transactions.length ? `${state.transactions.length}` : '';
  }

  // Специально для удаления ПОСЛЕДНЕЙ записи: плейсхолдер "пусто" заметно
  // выше одной строки истории, поэтому схлопывать запись до нуля, а потом
  // скачком вырастать под плейсхолдер (как было раньше) — выглядит как два
  // отдельных рывка. Вместо этого одним непрерывным переходом меняем высоту
  // контейнера от текущей к целевой, пока сама запись быстро растворяется,
  // а плейсхолдер проявляется чуть с отставанием — без прыжка по высоте.
  function collapseHistoryListToEmptyState(itemEl) {
    const startHeight = el.historyList.getBoundingClientRect().height;

    itemEl.classList.add('leaving-fade');
    el.historyList.style.height = `${startHeight}px`;
    el.historyList.style.overflow = 'hidden';
    void el.historyList.offsetHeight; // форсируем layout с исходной высотой

    itemEl.remove();
    el.emptyState.style.animation = 'none'; // проявление ведём вручную transition'ом, а не CSS-анимацией "rise"
    el.historyList.appendChild(el.emptyState);
    el.emptyState.style.opacity = '0';
    const endHeight = el.historyList.scrollHeight;

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      el.historyList.style.transition = '';
      el.historyList.style.height = '';
      el.historyList.style.overflow = '';
      el.emptyState.style.transition = '';
      // opacity/animation плейсхолдера НЕ сбрасываем: он уже проявлен (opacity:1),
      // а сброс animation вернул бы CSS-анимацию "rise" и она переиграла бы
      // проявление заново поверх уже показанного плейсхолдера. showEmptyHistoryState()
      // сама сбросит эти инлайн-стили, когда плейсхолдер понадобится с нуля.
    };

    // Двойной rAF — тот же приём, что и в анимации "барабана" суммы: одного
    // forced reflow не всегда достаточно, чтобы браузер гарантированно
    // зафиксировал стартовое состояние отдельным кадром перед стартом
    // transition. Без этого начальная и целевая высота могут схлопнуться
    // в один кадр — тогда вместо плавного роста получается мгновенный скачок
    // с паузой перед проявлением плейсхолдера (это и происходило раньше).
    requestAnimationFrame(() => {
      void el.historyList.offsetHeight;
      el.historyList.style.transition = 'height 0.32s ease';
      el.emptyState.style.transition = 'opacity 0.3s ease 0.05s';
      requestAnimationFrame(() => {
        el.historyList.style.height = `${endHeight}px`;
        el.emptyState.style.opacity = '1';
      });
    });

    el.historyList.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 500); // страховка, если transitionend почему-то не пришёл
  }

  // Плавно убирает одну запись: схлопывает её высоту/отступы вместе с fade,
  // остальные строки просто "подъезжают" за счёт обычного flow вёрстки —
  // никакой пересборки соседних узлов и повторной анимации появления.
  function removeHistoryItemAnimated(id) {
    el.historyCount.textContent = state.transactions.length ? `${state.transactions.length}` : '';

    const itemEl = el.historyList.querySelector(`.history-item[data-id="${id}"]`);
    if (!itemEl) {
      if (!state.transactions.length) showEmptyHistoryState();
      return;
    }

    if (!state.transactions.length) {
      collapseHistoryListToEmptyState(itemEl);
      return;
    }

    const rect = itemEl.getBoundingClientRect();
    itemEl.style.height = `${rect.height}px`;
    void itemEl.offsetHeight; // форсируем layout с явной высотой перед стартом transition
    itemEl.classList.add('leaving');
    itemEl.style.height = '0px';
    itemEl.style.paddingTop = '0px';
    itemEl.style.paddingBottom = '0px';

    let finished = false;
    const finalize = () => {
      if (finished) return;
      finished = true;
      itemEl.remove();
    };
    itemEl.addEventListener('transitionend', finalize, { once: true });
    setTimeout(finalize, 400); // страховка, если transitionend почему-то не пришёл
  }

  // Подсвечивает редактируемую запись точечно, без пересборки списка.
  function setEditingHighlight(id) {
    el.historyList.querySelectorAll('.history-item.editing').forEach((node) => {
      if (node.dataset.id !== id) node.classList.remove('editing');
    });
    if (!id) return;
    const node = el.historyList.querySelector(`.history-item[data-id="${id}"]`);
    if (node) node.classList.add('editing');
  }

  // Точечно обновляет отображение сумм при переключении маски приватности.
  function updateHistoryMasking() {
    state.transactions.forEach((tx) => {
      const node = el.historyList.querySelector(`.history-item[data-id="${tx.id}"]`);
      if (node) updateHistoryItemAmount(node, tx);
    });
  }

  async function loadAll() {
    const [currencies, settings, transactions, summary, rates, chart] = await Promise.all([
      api('/currencies'),
      api('/settings'),
      api('/transactions'),
      api('/summary'),
      api('/rates'),
      api('/history-chart'),
    ]);

    state.currencies = currencies;
    state.currencyMap = new Map(currencies.map((c) => [c.code, c]));
    state.settings = settings;
    state.transactions = transactions;

    renderCurrencySelects();
    renderHistory();
    renderSummary(summary);
    renderRates(rates);
    renderChart(chart);
  }

  async function refreshSummary() {
    const [summary, chart] = await Promise.all([api('/summary'), api('/history-chart')]);
    renderSummary(summary);
    renderChart(chart);
  }

  async function refreshTransactions() {
    state.transactions = await api('/transactions');
    renderHistory();
  }

  // Переключатель "Пополнить / Снять": управляет заголовком формы, текстом
  // и иконкой кнопки отправки, а также визуальным состоянием самих табов.
  function updateFormChrome() {
    const isWithdrawal = state.transactionType === 'withdrawal';
    el.typeDepositBtn.classList.toggle('active', !isWithdrawal);
    el.typeWithdrawBtn.classList.toggle('active', isWithdrawal);
    el.typeDepositBtn.setAttribute('aria-selected', String(!isWithdrawal));
    el.typeWithdrawBtn.setAttribute('aria-selected', String(isWithdrawal));
    el.submitBtn.classList.toggle('withdraw-mode', isWithdrawal);

    if (state.editingId) {
      el.formTitle.textContent = 'Редактировать запись';
      el.submitBtnLabel.textContent = 'Сохранить изменения';
    } else {
      el.formTitle.textContent = isWithdrawal ? 'Снять из копилки' : 'Добавить накопление';
      el.submitBtnLabel.textContent = isWithdrawal ? 'Снять из копилки' : 'Положить в копилку';
    }
  }

  function setTransactionType(type) {
    state.transactionType = type === 'withdrawal' ? 'withdrawal' : 'deposit';
    updateFormChrome();
  }

  el.typeDepositBtn.addEventListener('click', () => setTransactionType('deposit'));
  el.typeWithdrawBtn.addEventListener('click', () => setTransactionType('withdrawal'));

  function enterEditMode(tx) {
    state.editingId = tx.id;
    state.transactionType = tx.type === 'withdrawal' ? 'withdrawal' : 'deposit';
    el.amountInput.value = formatAmountString(String(tx.amount));
    el.commentInput.value = tx.comment || '';

    // Валюта записи могла быть отключена в настройках после её создания —
    // временно добавляем её в список, чтобы не потерять/не подменить молча.
    if (!el.currencySelect.querySelector(`option[value="${tx.currency}"]`)) {
      const c = state.currencyMap.get(tx.currency);
      const label = c ? `${c.flag} ${c.code} — ${c.symbol} (отключена)` : `${tx.currency} (отключена)`;
      el.currencySelect.insertAdjacentHTML('beforeend', `<option value="${tx.currency}">${label}</option>`);
    }
    el.currencySelect.value = tx.currency;
    state.selectedDate = tx.date;
    updateDateLabel();
    updateFormChrome();
    el.cancelEditBtn.hidden = false;
    el.formError.textContent = '';
    setEditingHighlight(tx.id);
    el.formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.amountInput.focus({ preventScroll: true });
  }

  function exitEditMode() {
    state.editingId = null;
    state.transactionType = 'deposit';
    el.addForm.reset();
    renderCurrencySelects(); // сбрасывает временный пункт с отключённой валютой, если он был добавлен
    state.selectedDate = todayISO();
    updateDateLabel();
    updateFormChrome();
    el.cancelEditBtn.hidden = true;
    el.formError.textContent = '';
    setEditingHighlight(null);
  }

  el.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.formError.textContent = '';

    const amount = parseAmountInput(el.amountInput.value);
    const currency = el.currencySelect.value;
    const date = state.selectedDate || todayISO();
    const comment = el.commentInput.value.trim();

    if (!amount || amount <= 0) {
      el.formError.textContent = 'Введите сумму больше нуля';
      el.amountInput.focus({ preventScroll: true });
      return;
    }

    const editingId = state.editingId;
    const type = state.transactionType;
    el.submitBtn.disabled = true;
    el.submitBtn.classList.add('dropping');

    try {
      if (editingId) {
        await api(`/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ amount, currency, date, type, comment }),
        });

        await refreshTransactions();
        await refreshSummary();
        exitEditMode();
        showToast('Изменения сохранены');
      } else {
        const tx = await api('/transactions', {
          method: 'POST',
          body: JSON.stringify({ amount, currency, date, type, comment }),
        });

        state.transactions.unshift(tx);
        prependHistoryItem(tx);
        await refreshSummary();

        const c = state.currencyMap.get(tx.currency);
        const verb = type === 'withdrawal' ? 'Снято' : 'Добавлено';
        showToast(`${verb} ${formatNumber(tx.amount)} ${c ? c.symbol : ''}`);

        el.amountInput.value = '';
        el.commentInput.value = '';
        el.amountInput.focus({ preventScroll: true });
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

  // Удаление подтверждается прямо в строке: клик по крестику "открывает"
  // соседнюю кнопку-галочку (клик по ней удаляет), повторный клик по
  // крестику, клик вне записи или Escape — отменяют, без модалки.
  function handleDeleteConfirmOutsideClick(e) {
    const confirming = el.historyList.querySelector('.history-item.confirming-delete');
    if (confirming && !confirming.contains(e.target)) cancelPendingDelete();
  }

  function handleDeleteConfirmKeydown(e) {
    if (e.key === 'Escape') cancelPendingDelete();
  }

  function stopWatchingDeleteConfirm() {
    document.removeEventListener('click', handleDeleteConfirmOutsideClick);
    document.removeEventListener('keydown', handleDeleteConfirmKeydown);
  }

  function cancelPendingDelete() {
    const confirming = el.historyList.querySelector('.history-item.confirming-delete');
    if (confirming) confirming.classList.remove('confirming-delete');
    stopWatchingDeleteConfirm();
  }

  function toggleDeleteConfirm(itemEl) {
    const alreadyConfirming = itemEl.classList.contains('confirming-delete');
    cancelPendingDelete();
    if (alreadyConfirming) return;

    itemEl.classList.add('confirming-delete');
    document.addEventListener('click', handleDeleteConfirmOutsideClick);
    document.addEventListener('keydown', handleDeleteConfirmKeydown);
  }

  async function deleteTransaction(id, confirmBtn) {
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' });
      if (id === state.editingId) exitEditMode();
      state.transactions = state.transactions.filter((t) => t.id !== id);
      removeHistoryItemAnimated(id);
      await refreshSummary();
    } catch (err) {
      confirmBtn.disabled = false;
      showToast(err.message, 'error');
    }
  }

  el.historyList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.item-edit');
    if (editBtn) {
      const id = editBtn.closest('.history-item').dataset.id;
      const tx = state.transactions.find((t) => t.id === id);
      if (tx) enterEditMode(tx);
      return;
    }

    const confirmBtn = e.target.closest('.item-delete-confirm');
    if (confirmBtn) {
      if (confirmBtn.disabled) return;
      confirmBtn.disabled = true;
      const id = confirmBtn.closest('.history-item').dataset.id;
      stopWatchingDeleteConfirm();
      deleteTransaction(id, confirmBtn);
      return;
    }

    const deleteBtn = e.target.closest('.item-delete');
    if (deleteBtn) {
      toggleDeleteConfirm(deleteBtn.closest('.history-item'));
    }
  });

  el.baseCurrencySelect.addEventListener('change', async () => {
    try {
      state.settings = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ baseCurrency: el.baseCurrencySelect.value }),
      });
      await refreshSummary();
      if (state.ratesSnapshot) renderRates(state.ratesSnapshot);
      if (!el.settingsBackdrop.hidden) renderCurrencyToggleList();
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

  el.ratesNominalBtn.addEventListener('click', () => {
    setRatesFlipped(!el.ratesFlip.classList.contains('flipped'));
  });

  el.ratesNominalCloseBtn.addEventListener('click', () => setRatesFlipped(false));

  el.ratesNominalList.addEventListener('input', (e) => {
    const input = e.target.closest('.rate-nominal-input');
    if (!input) return;
    const raw = Number(input.value.replace(',', '.'));
    const nominal = Number.isFinite(raw) && raw > 0 ? raw : 1;
    state.rateNominals[input.dataset.code] = nominal;
    saveRateNominals(state.rateNominals);
    renderRatesFront();
  });

  el.ratesNominalList.addEventListener('change', (e) => {
    const input = e.target.closest('.rate-nominal-input');
    if (!input) return;
    input.value = String(getRateNominal(input.dataset.code));
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
    if (state.chartData) renderChart(state.chartData);
    updateHistoryMasking();
  });

  // ---------- Настройки: управление списком доступных валют ----------
  function renderCurrencyToggleList() {
    const enabled = new Set(state.settings.enabledCurrencies || []);
    el.currencyToggleList.innerHTML = state.currencies
      .map((c) => {
        const isEnabled = enabled.has(c.code);
        const isBase = c.code === state.settings.baseCurrency;
        const isLastEnabled = isEnabled && enabled.size === 1;
        const isLocked = isBase || isLastEnabled;
        let hint = '';
        if (isBase) hint = 'Используется как базовая валюта';
        else if (isLastEnabled) hint = 'Должна остаться хотя бы одна валюта';

        return `<label class="currency-toggle-row${isLocked ? ' disabled' : ''}">
          <span class="currency-toggle-info">
            <span class="currency-toggle-flag">${c.flag}</span>
            <span class="currency-toggle-name">${c.name}</span>
            <span class="currency-toggle-code">${c.code}</span>
            ${hint ? `<span class="currency-toggle-hint">${hint}</span>` : ''}
          </span>
          <span class="toggle-switch">
            <input type="checkbox" data-code="${c.code}" ${isEnabled ? 'checked' : ''} ${isLocked ? 'disabled' : ''} />
            <span class="toggle-track"></span>
          </span>
        </label>`;
      })
      .join('');
  }

  function handleSettingsKeydown(e) {
    if (e.key === 'Escape') closeSettingsModal();
  }

  function openSettingsModal() {
    renderCurrencyToggleList();
    el.settingsBackdrop.hidden = false;
    document.addEventListener('keydown', handleSettingsKeydown);
  }

  function closeSettingsModal() {
    el.settingsBackdrop.hidden = true;
    document.removeEventListener('keydown', handleSettingsKeydown);
  }

  el.settingsBtn.addEventListener('click', openSettingsModal);
  el.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  el.settingsBackdrop.addEventListener('click', (e) => {
    if (e.target === el.settingsBackdrop) closeSettingsModal();
  });

  el.currencyToggleList.addEventListener('change', async (e) => {
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (!checkbox) return;

    const code = checkbox.dataset.code;
    const enabled = new Set(state.settings.enabledCurrencies || []);
    if (checkbox.checked) enabled.add(code);
    else enabled.delete(code);

    checkbox.disabled = true;
    try {
      state.settings = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ enabledCurrencies: [...enabled] }),
      });
      renderCurrencyToggleList();
      renderCurrencySelects();
      if (state.ratesSnapshot) renderRates(state.ratesSnapshot);
      showToast(checkbox.checked ? `Валюта ${code} включена` : `Валюта ${code} отключена`);
    } catch (err) {
      showToast(err.message, 'error');
      renderCurrencyToggleList();
    }
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
  updateFormChrome();

  el.chartCollapseBtn.addEventListener('click', () => {
    setChartCollapsed(!state.chartCollapsed);
  });
  setChartCollapsed(state.chartCollapsed, { animate: false });

  if (window.ResizeObserver) {
    let resizeFrame = null;
    const chartResizeObserver = new ResizeObserver(() => {
      if (!state.chartData) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => renderChart(state.chartData));
    });
    chartResizeObserver.observe(el.chartWrap);
  }

  // Ширина карточки курсов меняется на брейкпоинте 720px (переход в
  // одну колонку) — из-за этого может измениться перенос строк внутри
  // сторон карточки, а с ним и нужная высота флип-контейнера.
  window.addEventListener('resize', syncRatesFlipHeight);

  if (window.IntersectionObserver) {
    const totalVisibilityObserver = new IntersectionObserver(
      (entries) => {
        state.totalVisible = entries[entries.length - 1].isIntersecting;
        if (state.totalVisible && state.pendingTotalText !== null) {
          renderOdometerValue(el.grandTotalValue, state.pendingTotalText);
          state.pendingTotalText = null;
        }
      },
      { threshold: 0.6 }
    );
    totalVisibilityObserver.observe(el.grandTotalValue);
  }

  let isRegisterMode = false;

  function applyLoginMode(hasAccount) {
    isRegisterMode = !hasAccount;
    el.loginSubtitle.textContent = isRegisterMode ? 'Создайте аккаунт' : 'Вход в приложение';
    el.loginSubmitBtn.textContent = isRegisterMode ? 'Зарегистрироваться' : 'Войти';
    el.loginHint.hidden = !isRegisterMode;
    el.loginPassword.setAttribute('autocomplete', isRegisterMode ? 'new-password' : 'current-password');
  }

  function showApp() {
    el.loginScreen.hidden = true;
    el.app.hidden = false;
  }

  function showLogin() {
    el.app.hidden = true;
    el.loginScreen.hidden = false;
    el.loginUsername.focus({ preventScroll: true });
  }

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.loginError.textContent = '';
    el.loginSubmitBtn.disabled = true;

    try {
      const res = await fetch(isRegisterMode ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: el.loginUsername.value, password: el.loginPassword.value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Не удалось выполнить вход');
      }
      el.loginForm.reset();
      showApp();
      await loadAll();
    } catch (err) {
      el.loginError.textContent = err.message;
    } finally {
      el.loginSubmitBtn.disabled = false;
    }
  });

  el.logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* сеть недоступна — куку всё равно сбросим локальной перезагрузкой */
    }
    location.reload();
  });

  fetch('/api/auth/status')
    .then((res) => res.json())
    .then(({ authenticated, hasAccount }) => {
      applyLoginMode(hasAccount);
      if (!authenticated) return showLogin();
      showApp();
      return loadAll().catch((err) => {
        console.error(err);
        showToast('Не удалось загрузить данные с сервера', 'error');
      });
    })
    .catch((err) => {
      console.error(err);
      showLogin();
    });
})();
