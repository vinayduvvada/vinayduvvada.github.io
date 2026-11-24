// Mortgage Payoff Planner — static, client-side only.
// Fixed + Adjustable-rate (ARM). No data leaves the browser.
// ARM model: initial rate for the fixed phase, then rate = index + margin,
// held at the entered index (no index forecasting), capped at each adjustment
// by the initial / periodic cap, and by the lifetime cap over the initial rate.
// Payment is re-amortized over the remaining term at each adjustment.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var els = {
        form: $('plannerForm'), balance: $('balance'), rate: $('rate'), termYears: $('termYears'),
        extraMonthly: $('extraMonthly'), startMonth: $('startMonth'), targetYears: $('targetYears'),
        loanType: $('loanType'), armFields: $('armFields'),
        fixedYears: $('fixedYears'), indexRate: $('indexRate'), margin: $('margin'),
        initialCap: $('initialCap'), periodicCap: $('periodicCap'), lifetimeCap: $('lifetimeCap'),
        adjInterval: $('adjInterval'),
        error: $('formError'),
        payment: $('resultPayment'), paymentSub: $('resultPaymentSub'),
        payoff: $('resultPayoff'), payoffSub: $('resultPayoffSub'),
        interest: $('resultInterest'), interestSub: $('resultInterestSub'),
        saved: $('resultSaved'), savedSub: $('resultSavedSub'),
        targetBox: $('targetBox'), targetText: $('targetText'),
        armBox: $('armBox'), armText: $('armText'),
        balanceChart: $('balanceChart'), piChart: $('piChart'),
        paymentChart: $('paymentChart'), cumChart: $('cumChart'),
        scheduleBody: $('scheduleBody'), toggleScheduleBtn: $('toggleScheduleBtn'),
        exportCsvBtn: $('exportCsvBtn'), copyLinkBtn: $('copyLinkBtn'), copyNote: $('copyNote')
    };
    var state = { monthly: [], yearly: [], showMonthly: false, last: null };
    var STORAGE_KEY = 'mortgage-planner-v2';
    function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
    function moneyCents(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function monthsLabel(n) {
        var y = Math.floor(n / 12), m = n % 12;
        if (y === 0) return m + (m === 1 ? ' month' : ' months');
        if (m === 0) return y + (y === 1 ? ' year' : ' years');
        return y + (y === 1 ? ' yr ' : ' yrs ') + m + (m === 1 ? ' mo' : ' mos');
    }
    function addMonths(date, n) {
        var d = new Date(date.getFullYear(), date.getMonth() + n, 1);
        return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }
    function parseStart() {
        var v = els.startMonth.value || '2026-11';
        var p = v.split('-');
        return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
    }
    function standardPayment(principal, monthlyRate, months) {
        if (months <= 0) return principal;
        if (monthlyRate === 0) return principal / months;
        var f = Math.pow(1 + monthlyRate, months);
        return principal * monthlyRate * f / (f - 1);
    }
    function getArm() {
        if (!els.loanType || els.loanType.value !== 'arm') return null;
        return {
            fixedYears: parseFloat(els.fixedYears.value) || 5,
            indexRate: parseFloat(els.indexRate.value),
            margin: parseFloat(els.margin.value),
            initialCap: parseFloat(els.initialCap.value),
            periodicCap: parseFloat(els.periodicCap.value),
            lifetimeCap: parseFloat(els.lifetimeCap.value),
            adjYears: parseFloat(els.adjInterval.value) || 1
        };
    }
    function armRateAt(monthIndex, initialRate, arm) {
        var fixedMonths = Math.round(arm.fixedYears * 12);
        if (monthIndex < fixedMonths) return initialRate;
        var adjMonths = Math.max(1, Math.round(arm.adjYears * 12));
        var fullyIndexed = arm.indexRate + arm.margin;
        var rate = initialRate;
        var adjustments = Math.floor((monthIndex - fixedMonths) / adjMonths) + 1;
        for (var i = 0; i < adjustments; i++) {
            var cap = i === 0 ? arm.initialCap : arm.periodicCap;
            var next = Math.max(rate - cap, Math.min(rate + cap, fullyIndexed));
            next = Math.min(next, initialRate + arm.lifetimeCap);
            next = Math.max(next, Math.max(0, initialRate - arm.lifetimeCap));
            rate = next;
        }
        return rate;
    }
    function simulate(principal, initialRate, termMonths, extra, arm) {
        var rows = [], balance = principal, totalInterest = 0, month = 0;
        var adjustments = [];
        var currentRate = initialRate, currentBase = 0, currentTotal = 0;
        while (balance > 0.005 && month < 1200) {
            var fixedMonths = arm ? Math.round(arm.fixedYears * 12) : 0;
            var adjMonths = arm ? Math.max(1, Math.round(arm.adjYears * 12)) : 0;
            var isAdjustment = month === 0 || (arm && month >= fixedMonths && (month - fixedMonths) % adjMonths === 0);
            if (arm) {
                var r = armRateAt(month, initialRate, arm);
                if (r !== currentRate || month === 0) {
                    if (month !== 0) adjustments.push({ month: month + 1, rate: r });
                    currentRate = r;
                }
            }
            if (isAdjustment || month === 0) {
                var newBase = standardPayment(balance, currentRate / 100 / 12, termMonths - month);
                var newTotal = newBase + extra;
                // Hold the total payment: a lender re-calculating the required
                // payment over the remaining term would otherwise turn extra
                // payments into lower future payments instead of an earlier
                // payoff. So the total never drops below the previous total —
                // the borrower keeps paying the same amount, and the extra
                // keeps going to principal. A rate rise still raises it.
                if (currentTotal > 0 && newTotal < currentTotal) {
                    currentBase = currentTotal - extra;
                } else {
                    currentBase = newBase; currentTotal = newTotal;
                }
            }
            month += 1;
            var monthlyRate = currentRate / 100 / 12;
            var interest = balance * monthlyRate;
            var principalPaid = currentBase - interest + extra;
            var payment = currentBase + extra;
            if (principalPaid >= balance) { principalPaid = balance; payment = interest + balance; }
            if (currentBase <= interest && monthlyRate > 0 && extra === 0) {
                return { months: month, totalInterest: totalInterest, totalPaid: principal + totalInterest, rows: rows, adjustments: adjustments, error: 'Payment does not cover monthly interest.' };
            }
            balance -= principalPaid;
            totalInterest += interest;
            rows.push({ month: month, payment: payment, principal: principalPaid, interest: interest, balance: Math.max(0, balance), rate: currentRate });
        }
        return { months: month, totalInterest: totalInterest, totalPaid: principal + totalInterest, rows: rows, adjustments: adjustments };
    }
    function yearlyRows(monthlyRows) {
        var out = [];
        for (var i = 0; i < monthlyRows.length; i += 12) {
            var chunk = monthlyRows.slice(i, i + 12);
            out.push({
                label: 'Year ' + (Math.floor(i / 12) + 1),
                payment: chunk.reduce(function (s, r) { return s + r.payment; }, 0),
                principal: chunk.reduce(function (s, r) { return s + r.principal; }, 0),
                interest: chunk.reduce(function (s, r) { return s + r.interest; }, 0),
                balance: chunk[chunk.length - 1].balance,
                rate: chunk[0].rate,
                firstPayment: chunk[0].payment
            });
        }
        return out;
    }
    function setupCanvas(canvas) {
        if (!canvas || !canvas.getContext) return null;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return ctx;
    }
    function gridlines(ctx, W, H, padT, padB, padL, padR) {
        ctx.strokeStyle = 'rgba(128,128,128,0.25)'; ctx.lineWidth = 1;
        [0.25, 0.5, 0.75].forEach(function (f) { var gy = padT + (1 - f) * (H - padT - padB); ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke(); });
    }
    function drawBalanceChart(standardRows, extraRows, principal) {
        var ctx = setupCanvas(els.balanceChart); if (!ctx) return;
        var W = els.balanceChart.width, H = els.balanceChart.height, padL = 8, padR = 8, padT = 12, padB = 12;
        var maxMonths = Math.max(standardRows.length, extraRows.length, 1);
        function x(m) { return padL + (m / maxMonths) * (W - padL - padR); }
        function y(b) { return padT + (1 - b / principal) * (H - padT - padB); }
        gridlines(ctx, W, H, padT, padB, padL, padR);
        function line(rows, color, width) {
            ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
            ctx.moveTo(x(0), y(principal));
            rows.forEach(function (r) { ctx.lineTo(x(r.month), y(r.balance)); });
            ctx.stroke();
        }
        line(standardRows, '#8c8c8c', 2);
        line(extraRows, '#e50914', 2.5);
    }
    function drawPiChart(yearly) {
        var ctx = setupCanvas(els.piChart); if (!ctx) return;
        var W = els.piChart.width, H = els.piChart.height, pad = 12;
        var max = 0; yearly.forEach(function (y) { max = Math.max(max, y.principal + y.interest); });
        if (!max) return;
        var n = yearly.length, bw = (W - pad * 2) / n;
        yearly.forEach(function (y, i) {
            var ph = (y.principal / max) * (H - pad * 2);
            var ih = (y.interest / max) * (H - pad * 2);
            var bx = pad + i * bw + bw * 0.2, bwid = bw * 0.6;
            ctx.fillStyle = '#8c8c8c'; ctx.fillRect(bx, H - pad - ih - ph, bwid, ih);
            ctx.fillStyle = '#e50914'; ctx.fillRect(bx, H - pad - ph, bwid, ph);
        });
    }
    function drawPaymentChart(monthly) {
        var ctx = setupCanvas(els.paymentChart); if (!ctx) return;
        var W = els.paymentChart.width, H = els.paymentChart.height, padL = 8, padR = 8, padT = 12, padB = 12;
        var max = 0, min = Infinity;
        monthly.forEach(function (r) { max = Math.max(max, r.payment); min = Math.min(min, r.payment); });
        if (!isFinite(min)) return;
        if (max === min) { max = min * 1.1 + 1; min = min * 0.9; }
        var maxMonths = Math.max(monthly.length, 1);
        gridlines(ctx, W, H, padT, padB, padL, padR);
        ctx.strokeStyle = '#e50914'; ctx.lineWidth = 2.5; ctx.beginPath();
        monthly.forEach(function (r, i) {
            var px = padL + (r.month / maxMonths) * (W - padL - padR);
            var py = padT + (1 - (r.payment - min) / (max - min)) * (H - padT - padB);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }
    function drawCumChart(yearly) {
        var ctx = setupCanvas(els.cumChart); if (!ctx) return;
        var W = els.cumChart.width, H = els.cumChart.height, padL = 8, padR = 8, padT = 12, padB = 12;
        var cum = 0, pts = yearly.map(function (y) { cum += y.interest; return cum; });
        var max = Math.max.apply(null, pts.concat([1]));
        gridlines(ctx, W, H, padT, padB, padL, padR);
        ctx.strokeStyle = '#e50914'; ctx.lineWidth = 2.5; ctx.beginPath();
        pts.forEach(function (v, i) {
            var px = padL + ((i + 1) / pts.length) * (W - padL - padR);
            var py = padT + (1 - v / max) * (H - padT - padB);
            if (i === 0) ctx.moveTo(padL, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }
    function renderSchedule() {
        var rows = state.showMonthly ? state.monthly : state.yearly;
        els.toggleScheduleBtn.textContent = state.showMonthly ? 'Show yearly' : 'Show monthly';
        els.scheduleBody.innerHTML = rows.map(function (r) {
            var label = state.showMonthly ? 'Month ' + r.month : r.label;
            var extra = state.showMonthly && r.rate != null ? ' (' + r.rate.toFixed(2) + '%)' : '';
            return '<tr><td>' + label + extra + '</td><td>' + moneyCents(r.payment) + '</td><td>' + moneyCents(r.principal) + '</td><td>' + moneyCents(r.interest) + '</td><td>' + moneyCents(r.balance) + '</td></tr>';
        }).join('');
    }
    function showError(msg) { els.error.textContent = msg; els.error.hidden = !msg; }
    function calculate() {
        var principal = parseFloat(els.balance.value);
        var initialRate = parseFloat(els.rate.value);
        var termYears = parseFloat(els.termYears.value);
        var extra = parseFloat(els.extraMonthly.value) || 0;
        var targetYears = parseFloat(els.targetYears.value) || null;
        var arm = getArm();
        if (!principal || principal <= 0) return showError('Enter a loan balance greater than $0.');
        if (isNaN(initialRate) || initialRate < 0 || initialRate > 30) return showError('Enter an annual rate between 0% and 30%.');
        if (!termYears || termYears < 1 || termYears > 50) return showError('Enter a remaining term between 1 and 50 years.');
        if (extra < 0) return showError('Extra monthly payment cannot be negative.');
        if (arm) {
            if (isNaN(arm.indexRate) || arm.indexRate < 0 || arm.indexRate > 30) return showError('Enter an index rate between 0% and 30%.');
            if (isNaN(arm.margin) || arm.margin < 0 || arm.margin > 10) return showError('Enter a margin between 0% and 10%.');
            if (isNaN(arm.initialCap) || arm.initialCap < 0 || arm.initialCap > 10) return showError('Enter an initial cap between 0% and 10%.');
            if (isNaN(arm.periodicCap) || arm.periodicCap < 0 || arm.periodicCap > 10) return showError('Enter a periodic cap between 0% and 10%.');
            if (isNaN(arm.lifetimeCap) || arm.lifetimeCap < 0 || arm.lifetimeCap > 15) return showError('Enter a lifetime cap between 0% and 15%.');
            if (arm.fixedYears < 1 || arm.fixedYears >= termYears) return showError('Fixed phase must be at least 1 year and less than the remaining term.');
        }
        showError('');
        var termMonths = Math.round(termYears * 12);
        var standard = simulate(principal, initialRate, termMonths, 0, arm);
        if (standard.error) return showError(standard.error);
        var withExtra = simulate(principal, initialRate, termMonths, extra, arm);
        if (withExtra.error) return showError(withExtra.error);
        var start = parseStart();
        var firstBase = standard.rows.length ? standard.rows[0].payment : 0;
        els.payment.textContent = moneyCents(withExtra.rows.length ? withExtra.rows[0].payment : firstBase);
        els.paymentSub.textContent = arm
            ? 'initial payment, ' + initialRate.toFixed(2) + '% fixed for ' + arm.fixedYears + ' yrs' + (extra > 0 ? ' + ' + moneyCents(extra) + ' extra' : '')
            : (extra > 0 ? moneyCents(firstBase) + ' standard + ' + moneyCents(extra) + ' extra' : 'standard, no extra');
        els.payoff.textContent = addMonths(start, withExtra.months);
        els.payoffSub.textContent = monthsLabel(withExtra.months) + ' from start' + (extra > 0 ? ' — ' + (standard.months - withExtra.months) + ' months sooner' : '');
        els.interest.textContent = money(withExtra.totalInterest);
        els.interestSub.textContent = 'total paid ' + money(withExtra.totalPaid);
        var saved = standard.totalInterest - withExtra.totalInterest;
        els.saved.textContent = money(saved);
        els.savedSub.textContent = extra > 0 ? 'vs ' + money(standard.totalInterest) + ' interest on the standard schedule' : 'Add an extra payment to see savings';
        if (arm && els.armBox) {
            var fully = arm.indexRate + arm.margin;
            var firstAdjRate = withExtra.adjustments.length ? withExtra.adjustments[0].rate : fully;
            els.armBox.hidden = false;
            els.armText.innerHTML = 'ARM: <strong>' + initialRate.toFixed(2) + '% fixed for ' + arm.fixedYears + ' years</strong>, then ' +
                'index ' + arm.indexRate.toFixed(2) + '% + margin ' + arm.margin.toFixed(2) + '% = ' + fully.toFixed(2) + '% fully indexed. ' +
                'First adjustment to <strong>' + firstAdjRate.toFixed(2) + '%</strong>' +
                (withExtra.adjustments.length > 1 ? ', then up to ' + withExtra.adjustments[withExtra.adjustments.length - 1].rate.toFixed(2) + '%' : '') +
                ' (caps: initial ' + arm.initialCap.toFixed(2) + '%, periodic ' + arm.periodicCap.toFixed(2) + '%, lifetime ' + arm.lifetimeCap.toFixed(2) + '%). ' +
                'Index is held constant in this projection — it does not forecast future index moves. ' +
                'Your total payment never drops at an adjustment, so extra payments keep shortening the term instead of just lowering the next payment.';
        } else if (els.armBox) els.armBox.hidden = true;
        if (targetYears) {
            var targetMonths = Math.round(targetYears * 12);
            var lo = 0, hi = principal, neededExtra = null;
            for (var i = 0; i < 40; i++) {
                var mid = (lo + hi) / 2;
                var sim = simulate(principal, initialRate, termMonths, mid, arm);
                if (sim.months <= targetMonths) { neededExtra = mid; hi = mid; } else lo = mid;
            }
            els.targetBox.hidden = false;
            if (neededExtra != null) {
                var neededSim = simulate(principal, initialRate, termMonths, neededExtra, arm);
                var neededTotal = neededSim.rows.length ? neededSim.rows[0].payment : 0;
                els.targetText.innerHTML = 'To pay off in <strong>' + targetYears + ' years</strong> you need about <strong>' +
                    moneyCents(neededTotal) + '/month at first</strong> — that is <strong>' + moneyCents(neededExtra) +
                    '/month extra</strong> over your standard ' + moneyCents(firstBase) + ' payment' +
                    (arm ? ' (ARM payment will change at adjustments)' : '') + '.';
            } else {
                els.targetText.textContent = 'That target cannot be reached even by paying the full balance up front in this model — check the target years.';
            }
        } else els.targetBox.hidden = true;
        state.monthly = withExtra.rows;
        state.yearly = yearlyRows(withExtra.rows);
        renderSchedule();
        drawBalanceChart(standard.rows, withExtra.rows, principal);
        drawPiChart(state.yearly);
        drawPaymentChart(withExtra.rows);
        drawCumChart(state.yearly);
        state.last = { principal: principal, initialRate: initialRate, termYears: termYears, extra: extra, targetYears: targetYears, startMonth: els.startMonth.value, loanType: els.loanType ? els.loanType.value : 'fixed', arm: arm };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.last));
            var url = new URL(window.location.href);
            url.searchParams.set('balance', principal); url.searchParams.set('rate', initialRate);
            url.searchParams.set('term', termYears); url.searchParams.set('extra', extra);
            url.searchParams.set('type', state.last.loanType);
            if (targetYears) url.searchParams.set('target', targetYears); else url.searchParams.delete('target');
            if (arm) {
                url.searchParams.set('fixed', arm.fixedYears); url.searchParams.set('index', arm.indexRate);
                url.searchParams.set('margin', arm.margin); url.searchParams.set('icap', arm.initialCap);
                url.searchParams.set('pcap', arm.periodicCap); url.searchParams.set('lcap', arm.lifetimeCap);
                url.searchParams.set('adj', arm.adjYears);
            }
            window.history.replaceState(null, '', url);
        } catch (e) {}
    }
    function loadFromUrlOrStorage() {
        var params = new URLSearchParams(window.location.search);
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mortgage-planner-v1') || 'null'); } catch (e) { saved = null; }
        function pick(key, fallback) {
            if (params.has(key)) return params.get(key);
            if (saved && saved[key] != null) return saved[key];
            if (saved && saved.arm && saved.arm[key] != null) return saved.arm[key];
            return fallback;
        }
        els.balance.value = pick('balance', els.balance.value);
        els.rate.value = pick('rate', els.rate.value);
        els.termYears.value = pick('term', els.termYears.value);
        els.extraMonthly.value = pick('extra', els.extraMonthly.value);
        if (els.loanType) els.loanType.value = pick('type', saved && saved.loanType ? saved.loanType : 'fixed');
        if (params.has('target') || (saved && saved.targetYears)) els.targetYears.value = pick('target', saved ? saved.targetYears : '');
        if (saved && saved.startMonth) els.startMonth.value = saved.startMonth;
        if (els.fixedYears) {
            els.fixedYears.value = pick('fixed', saved && saved.arm ? saved.arm.fixedYears : 5);
            els.indexRate.value = pick('index', saved && saved.arm ? saved.arm.indexRate : 4);
            els.margin.value = pick('margin', saved && saved.arm ? saved.arm.margin : 2.25);
            els.initialCap.value = pick('icap', saved && saved.arm ? saved.arm.initialCap : 2);
            els.periodicCap.value = pick('pcap', saved && saved.arm ? saved.arm.periodicCap : 1);
            els.lifetimeCap.value = pick('lcap', saved && saved.arm ? saved.arm.lifetimeCap : 5);
            els.adjInterval.value = pick('adj', saved && saved.arm ? saved.arm.adjYears : 1);
        }
        toggleArm();
    }
    function toggleArm() {
        if (!els.armFields || !els.loanType) return;
        els.armFields.hidden = els.loanType.value !== 'arm';
    }
    function exportCsv() {
        if (!state.monthly.length) return;
        var lines = ['Month,Payment,Principal,Interest,Rate,Balance'];
        state.monthly.forEach(function (r) {
            lines.push([r.month, r.payment.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.rate.toFixed(2), r.balance.toFixed(2)].join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'mortgage-payoff-schedule.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    document.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var preset = btn.getAttribute('data-preset');
            if (preset === 'mine') { els.balance.value = 1000000; els.rate.value = 6; els.termYears.value = 30; els.extraMonthly.value = 0; els.targetYears.value = ''; }
            else if (preset === 'seven') { els.targetYears.value = 7; }
            else if (preset === 'reset') { els.balance.value = 1000000; els.rate.value = 6; els.termYears.value = 30; els.extraMonthly.value = 0; els.targetYears.value = ''; }
            else if (preset === 'arm') { if (els.loanType) els.loanType.value = 'arm'; toggleArm(); els.balance.value = 1000000; els.rate.value = 6; els.termYears.value = 30; els.fixedYears.value = 5; els.indexRate.value = 4; els.margin.value = 2.25; }
            calculate();
            els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
    els.form.addEventListener('submit', function (e) { e.preventDefault(); calculate(); });
    ['balance', 'rate', 'termYears', 'extraMonthly', 'targetYears', 'startMonth', 'fixedYears', 'indexRate', 'margin', 'initialCap', 'periodicCap', 'lifetimeCap', 'adjInterval'].forEach(function (id) {
        var el = $(id); if (el) el.addEventListener('change', calculate);
    });
    if (els.loanType) els.loanType.addEventListener('change', function () { toggleArm(); calculate(); });
    els.toggleScheduleBtn.addEventListener('click', function () { state.showMonthly = !state.showMonthly; renderSchedule(); });
    els.exportCsvBtn.addEventListener('click', exportCsv);
    els.copyLinkBtn.addEventListener('click', function () {
        calculate();
        var url = window.location.href;
        function done() { els.copyNote.hidden = false; setTimeout(function () { els.copyNote.hidden = true; }, 3000); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else { var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
    });
    loadFromUrlOrStorage();
    calculate();
})();
