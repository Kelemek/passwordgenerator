// Small embedded wordlist. This will be replaced at runtime if a local
// `eff-wordlist.txt` file exists (one word per line). Use the provided
// `scripts/fetch_eff.sh` to download the official EFF large wordlist.
const words = [
    "able","about","acid","across","act","addition","adjustment","advertisement","after","again",
    "against","agreement","air","all","almost","among","amount","amusement","and","angle","angry",
    "animal","answer","ant","any","apparatus","apple","approval","arch","argument","arm","army",
    "art","as","at","attack","attempt","attention","attraction","authority","automatic","awake",
    "baby","back","bad","bag","balance","ball","band","base","basis","basket","bath","be","beautiful",
    "because","bed","bee","before","behaviour","belief","bell","bent","berry","between","bird","birth",
    "bit","bite","bitter","black","blade","blood","blow","blue","board","boat","body","boiling",
    "bone","book","boot","bottle","box","boy","brain","brake","branch","brass","bread","breath",
    "brick","bridge","bright","broken","brother","brown","brush","bucket","building","bulb","burn",
    "burst","business","but","butter","button","by","cake","camera","canvas","card","care","carriage",
    "cart","cat","cause","certain","chain","chalk","chance","change","cheap","cheese","chemical","chest",
    "chief","chin","church","circle","clean","clear","clock","cloth","cloud","coal","coat","cold","collar",
    "colour","comb","come","comfort","committee","common","company","comparison","competition","complete",
    "complex","condition","connection","consciousness","control","cook","copper","copy","cord","cork","corn",
    "correct","cost","cotton","cough","country","cover","cow","crack","credit","crime","cruel","crush",
    "cry","cup","cupboard","current","curve","cushion","damage","danger","dark","daughter","day","dead"
];

function randInt(max) {
    // Use cryptographically secure random number generation
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    // Convert to a value between 0 and max-1
    // Using modulo with rejection sampling to avoid bias
    const maxValid = Math.floor(0xFFFFFFFF / max) * max;
    let value = array[0];
    // Rejection sampling: if value is in the biased range, get a new random value
    while (value >= maxValid) {
        crypto.getRandomValues(array);
        value = array[0];
    }
    return value % max;
}

// Single safe symbol set (exclude quotes, backslash, angle-brackets and other often-problematic chars)
const SPECIALS = ['!', '@', '#', '$', '%', '^', '&', '*', '?', '~', '-', '_', '+', '=', ':', ';', ',', '.', '/'];


function pickWords(count) {
    const picked = [];
    for (let i = 0; i < count; i++) {
        picked.push(words[randInt(words.length)]);
    }
    return picked;
}

// Replace per-word random casing with a rule that randomly capitalizes the
// first letter of 1 or 2 words only (others are normalized to lowercase).
function randomizeFirstLetters(wordsArr) {
    // normalize all words to lowercase first
    for (let i = 0; i < wordsArr.length; i++) {
        wordsArr[i] = wordsArr[i].toLowerCase();
    }

    const maxCaps = Math.min(wordsArr.length, 2);
    const numToCap = 1 + randInt(maxCaps); // 1 or 2 (when maxCaps==2) or 1 when only 1 word
    const chosen = new Set();
    while (chosen.size < numToCap) {
        chosen.add(randInt(wordsArr.length));
    }

    chosen.forEach(idx => {
        const w = wordsArr[idx];
        if (w.length > 0) wordsArr[idx] = w.charAt(0).toUpperCase() + w.slice(1);
    });
}

function insertRandomDigitsIntoWords(wordsArr) {
    // Append 1 (or sometimes 2) random digits to the end of 1 or 2 randomly
    // chosen words. Never insert digits in the middle.
    if (wordsArr.length === 0) return;
    const maxTargets = Math.min(2, wordsArr.length);
    const numTargets = 1 + randInt(maxTargets); // 1 or 2 when possible
    const chosen = new Set();
    while (chosen.size < numTargets) {
        chosen.add(randInt(wordsArr.length));
    }

    chosen.forEach(idx => {
        const digitCount = 1 + randInt(2); // append 1 or 2 digits
        let digits = '';
        for (let d = 0; d < digitCount; d++) digits += String(randInt(10));
        wordsArr[idx] = wordsArr[idx] + digits;
    });
}

function insertRandomSpecialCharsIntoWords(wordsArr) {
    // Insert a single special character at the beginning or end of 1 or 2 randomly
    // chosen words. Never insert in the middle of a word.
    if (wordsArr.length === 0) return;
    const maxTargets = Math.min(2, wordsArr.length);
    const numTargets = 1 + randInt(maxTargets); // 1 or 2 when possible
    const chosen = new Set();
    while (chosen.size < numTargets) {
        chosen.add(randInt(wordsArr.length));
    }

    chosen.forEach(idx => {
        const sym = SPECIALS[randInt(SPECIALS.length)];
        // decide to place at start or end (50/50)
        const placeAtStart = randInt(2) === 0;
        wordsArr[idx] = placeAtStart ? (sym + wordsArr[idx]) : (wordsArr[idx] + sym);
    });
}

function createPassphrase(count = 4, separator = "-") {
    const picked = pickWords(count);
    randomizeFirstLetters(picked);
    insertRandomDigitsIntoWords(picked);
    return picked.join(separator);
}

function generatePassphrase() {
    const countInput = document.getElementById("wordCount");
    const sepInput = document.getElementById("separator");
    const count = Math.max(1, Math.min(12, parseInt(countInput.value) || 4));
    const sep = sepInput.value || "-";
    // If user supplied a maximum total length, attempt to satisfy it by
    // generating several candidates. If impossible with the requested word
    // count, try reducing word count until a candidate fits.
    const maxEl = document.getElementById('maxLength');
    const maxVal = maxEl ? parseInt(maxEl.value, 10) : 0;
    const limitEnabled = Number.isFinite(maxVal) && maxVal > 0;
    const MAX_TOTAL = limitEnabled ? maxVal : Infinity;
    const addSymbols = !!document.getElementById('addSymbol') && document.getElementById('addSymbol').checked;

    // helper: try to create a passphrase with `c` words up to a limited number of attempts
    function tryWithCount(c, attempts = 300) {
        for (let a = 0; a < attempts; a++) {
            const picked = pickWords(c);
            randomizeFirstLetters(picked);
            insertRandomDigitsIntoWords(picked);
            if (addSymbols) insertRandomSpecialCharsIntoWords(picked);
            const candidate = picked.join(sep);
            if (!limitEnabled || candidate.length <= MAX_TOTAL) return { pass: candidate, usedCount: c };
        }
        return null;
    }

    let result = null;
    if (limitEnabled) {
        // try starting from the requested count down to 1
        for (let c = count; c >= 1; c--) {
            result = tryWithCount(c, 300);
            if (result) break;
        }
    } else {
        result = tryWithCount(count, 1); // single attempt is fine without limit
    }

    // fallback: if no candidate found (very unlikely), generate unconstrained once
    if (!result) {
        const picked = pickWords(count);
        randomizeFirstLetters(picked);
        insertRandomDigitsIntoWords(picked);
        if (addSymbols) insertRandomSpecialCharsIntoWords(picked);
        result = { pass: picked.join(sep), usedCount: count };
    }

    const pass = result.pass;
    const usedCount = result.usedCount;
    const out = document.getElementById("password1");
    out.textContent = pass;
    fitTextToContainer(out, 14, 20);

    // update metadata: character length and actual word count used
    const meta = document.getElementById('passInfo');
    if (meta) {
        const bits = estimateEntropy(usedCount, addSymbols, SPECIALS.length);
        const label = strengthLabel(bits);
        const suffix = usedCount !== count && limitEnabled ? ` (reduced from ${count} words)` : '';
        meta.textContent = `${pass.length} characters · ${usedCount} words${suffix} · ${Math.round(bits)} bits (${label})`;
    }
}

function estimateEntropy(count, symbolsEnabled = false, symbolSetSize = 10) {
    // Words entropy based on current wordlist size
    const listSize = Math.max(1, words.length);
    const bitsPerWord = Math.log2(listSize);
    const wordsBits = count * bitsPerWord;

    // Capitalization: choose 1 or 2 words to capitalize (depending on count)
    const maxCaps = Math.min(count, 2);
    let capChoices = 0;
    for (let k = 1; k <= maxCaps; k++) {
        // combinations C(count, k)
        let comb = 1;
        for (let i = 0; i < k; i++) comb *= (count - i) / (i + 1);
        capChoices += comb;
    }
    const capBits = capChoices > 1 ? Math.log2(capChoices) : 0;

    // Digits: generator appends 1 or 2 digits to 1 or 2 targets.
    // Expected number of targets = 1 when count==1, else 1.5
    const targetsAvg = count === 1 ? 1 : 1.5;
    // expected digits per target = average of (1 or 2) => 1.5
    const digitsAvg = targetsAvg * 1.5;
    const digitsBits = digitsAvg * Math.log2(10);

    // symbols: optional single special char appended/prepended to 1 or 2 targets
    const symbolsBits = symbolsEnabled ? (targetsAvg * Math.log2(Math.max(2, symbolSetSize))) : 0;

    return wordsBits + capBits + digitsBits + symbolsBits;
}

function strengthLabel(bits) {
    if (bits >= 80) return 'Very strong';
    if (bits >= 64) return 'Strong';
    if (bits >= 48) return 'Moderate';
    return 'Weak';
}

// Compute a detailed entropy breakdown used by the modal
function computeEntropyBreakdown(count, symbolsEnabled = false, symbolSetSize = 10) {
    const listSize = Math.max(1, words.length);
    const bitsPerWord = Math.log2(listSize);
    const wordsBits = count * bitsPerWord;

    // Capitalization breakdown (1 or 2 words may be capitalized)
    const maxCaps = Math.min(count, 2);
    let capChoices = 0;
    for (let k = 1; k <= maxCaps; k++) {
        let comb = 1;
        for (let i = 0; i < k; i++) comb *= (count - i) / (i + 1);
        capChoices += comb;
    }
    const capBits = capChoices > 1 ? Math.log2(capChoices) : 0;

    // Digits: expected targets and digits per target as in estimateEntropy
    const targetsAvg = count === 1 ? 1 : 1.5;
    const digitsAvg = targetsAvg * 1.5; // average 1.5 digits per target
    const digitsBits = digitsAvg * Math.log2(10);

    const symbolsBits = symbolsEnabled ? (targetsAvg * Math.log2(Math.max(2, symbolSetSize))) : 0;

    const total = wordsBits + capBits + digitsBits + symbolsBits;
    return {
        wordsBits,
        capBits,
        digitsBits,
        symbolsBits,
        total,
        listSize
    };
}

function computeRecommendation(bd, count) {
    const bits = bd.total;
    const listSize = bd.listSize || Math.max(1, words.length);
    const bitsPerWord = Math.log2(Math.max(1, listSize));

    if (bits >= 80) return 'Excellent — sufficient entropy.';

    // Choose a sensible next target: 48->Moderate, 64->Strong, 80->Very strong
    let target;
    if (bits < 48) target = 48;
    else if (bits < 64) target = 64;
    else target = 80;

    if (bitsPerWord <= 0) return 'Increase wordlist size or add more words.';

    const needed = Math.max(0, Math.ceil((target - bits) / bitsPerWord));
    if (needed <= 0) return `Meets ${strengthLabel(bits)} threshold.`;

    const wordLabel = needed === 1 ? 'word' : 'words';
    return `Add ${needed} ${wordLabel} (or increase digits/caps) to approach ${target} bits (${target === 80 ? 'Very strong' : target === 64 ? 'Strong' : 'Moderate'}).`;
}

function showBreakdownModal() {
    const meta = document.getElementById('passInfo');
    const modal = document.getElementById('breakdownModal');
    if (!modal || !meta) return;

    // derive current count from control
    const countInput = document.getElementById('wordCount');
    const count = Math.max(1, Math.min(12, parseInt(countInput.value) || 4));
    const addSymbols = !!document.getElementById('addSymbol') && document.getElementById('addSymbol').checked;
    const bd = computeEntropyBreakdown(count, addSymbols, SPECIALS.length);

    const f = (v) => (Math.round(v * 10) / 10).toFixed(1) + ' bits';
    document.getElementById('bdWords').textContent = f(bd.wordsBits);
    document.getElementById('bdCaps').textContent = f(bd.capBits);
    document.getElementById('bdDigits').textContent = f(bd.digitsBits);
    const symbolsEl = document.getElementById('bdSymbols');
    if (symbolsEl) symbolsEl.textContent = bd.symbolsBits ? (Math.round(bd.symbolsBits*10)/10).toFixed(1) + ' bits' : '0.0 bits';
    document.getElementById('bdRecommendation').textContent = computeRecommendation(bd, count);
    document.getElementById('bdTotal').textContent = f(bd.total);
    document.getElementById('bdListSize').textContent = String(bd.listSize);

    modal.removeAttribute('hidden');
    // focus the close button for accessibility
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
}

function closeBreakdownModal() {
    const modal = document.getElementById('breakdownModal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
}

// Wire up modal open/close handlers
document.addEventListener('DOMContentLoaded', () => {
    const meta = document.getElementById('passInfo');
    if (meta) meta.addEventListener('click', showBreakdownModal);

    const modal = document.getElementById('breakdownModal');
    if (!modal) return;

    // close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeBreakdownModal);

    // clicking outside the modal content closes it
    modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeBreakdownModal();
    });

    // Esc key closes
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeBreakdownModal();
    });

    // Load saved options from localStorage (if any) and wire change handlers
    loadOptions();

    // Platform detection: add a class for Windows so we can target Windows-specific styling
    try {
        const isWin = navigator.platform && /Win/.test(navigator.platform) || (navigator.userAgent && /Windows/.test(navigator.userAgent));
        if (isWin) document.documentElement.classList.add('platform-windows');
    } catch (e) {
        // ignore
    }

    // save options when controls change
    const wc = document.getElementById('wordCount');
    const sep = document.getElementById('separator');
    const addSym = document.getElementById('addSymbol');
    const max = document.getElementById('maxLength');
    if (wc) wc.addEventListener('change', saveOptions);
    if (sep) sep.addEventListener('input', saveOptions);
    if (addSym) addSym.addEventListener('change', saveOptions);
    if (max) {
        // sanitize input to digits only so non-numeric characters are removed
        max.addEventListener('input', (ev) => {
            const el = ev.target;
            // allow empty value; otherwise strip non-digits
            const cleaned = (el.value || '').replace(/[^0-9]/g, '');
            if (cleaned !== el.value) el.value = cleaned;
            saveOptions();
        });

        // Prevent non-digit keys (allow navigation/editing keys)
        max.addEventListener('keydown', (ev) => {
            const allowed = ["Backspace","Tab","Enter","Escape","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Delete"];
            if (allowed.includes(ev.key)) return;
            // Allow digits only
            if (/^[0-9]$/.test(ev.key)) return;
            // block everything else (including 'e', '+', '-', '.')
            ev.preventDefault();
        });

        // Sanitize pasted content
        max.addEventListener('paste', (ev) => {
            try {
                const txt = (ev.clipboardData || window.clipboardData).getData('text') || '';
                const cleaned = txt.replace(/[^0-9]/g, '');
                if (cleaned !== txt) {
                    ev.preventDefault();
                    // insert cleaned text at the cursor position
                    const el = ev.target;
                    const start = el.selectionStart || 0;
                    const end = el.selectionEnd || 0;
                    const val = el.value || '';
                    el.value = val.slice(0, start) + cleaned + val.slice(end);
                    // move cursor after inserted text
                    const pos = start + cleaned.length;
                    el.setSelectionRange(pos, pos);
                    // trigger input handler
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (e) {
                // ignore clipboard errors and allow default behavior
            }
        });
    }

    // Do not auto-generate on load. Leave the passphrase blank so users must
    // explicitly generate one each session. Clear any previous display.
    const out = document.getElementById('password1');
    if (out) {
        out.textContent = '';
        // ensure measurement/fit logic runs to reset any state
        fitTextToContainer(out);
        out.removeAttribute('title');
    }
    const metaEl = document.getElementById('passInfo');
    if (metaEl) metaEl.textContent = '\u00A0';
});

// LocalStorage helpers for persisting user options
const LS_KEY = 'passgen_options_v1';

function getOptionsFromDOM() {
    const wc = document.getElementById('wordCount');
    const sep = document.getElementById('separator');
    const addSym = document.getElementById('addSymbol');
    return {
        wordCount: wc ? wc.value : null,
        separator: sep ? sep.value : null,
        addSymbol: addSym ? !!addSym.checked : null
        ,maxLength: (function(){
            const m = document.getElementById('maxLength');
            if (!m) return null;
            const v = m.value;
            if (v === null || v === undefined || v === '') return null;
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : null;
        })()
    };
}

function applyOptionsToDOM(opts) {
    if (!opts) return;
    const wc = document.getElementById('wordCount');
    const sep = document.getElementById('separator');
    const addSym = document.getElementById('addSymbol');
    if (wc && opts.wordCount != null) wc.value = String(opts.wordCount);
    if (sep && opts.separator != null) sep.value = String(opts.separator);
    if (addSym && opts.addSymbol != null) addSym.checked = !!opts.addSymbol;
    const max = document.getElementById('maxLength');
    if (max && opts.maxLength != null) max.value = String(opts.maxLength);
}

function saveOptions() {
    try {
        const opts = getOptionsFromDOM();
        localStorage.setItem(LS_KEY, JSON.stringify(opts));
    } catch (err) {
        console.warn('Could not save options to localStorage', err);
    }
}

function loadOptions() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const opts = JSON.parse(raw);
        applyOptionsToDOM(opts);
    } catch (err) {
        console.warn('Could not load options from localStorage', err);
    }
}

function copyText(e) {
    const el = e.target;
    const clickedText = el.textContent;
    if (!clickedText) return;

    const original = clickedText;
    // Try modern clipboard API first, fallback to execCommand for file:// or older browsers
    (async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(clickedText);
            } else {
                // fallback: create a temporary textarea, select and exec copy
                const ta = document.createElement('textarea');
                ta.value = clickedText;
                ta.setAttribute('readonly', '');
                ta.style.position = 'absolute';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }

            el.textContent = 'Copied to clipboard!';
            fitTextToContainer(el);
            setTimeout(() => {
                el.textContent = original;
                fitTextToContainer(el);
            }, 1500);
        } catch (err) {
            console.warn('Copy failed', err);
            el.textContent = 'Copy failed';
            fitTextToContainer(el);
            setTimeout(() => {
                el.textContent = original;
                fitTextToContainer(el);
            }, 1500);
        }
    })();
}

// Copy using the current passphrase (used by the explicit button) with robust fallbacks
async function copyCurrentPassphrase() {
    const out = document.getElementById('password1');
    if (!out) return;
    const text = out.textContent || '';
    if (!text) return;
    const originalText = out.textContent;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // textarea fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            document.execCommand('copy');
            document.body.removeChild(ta);
        }

        // small animation/feedback by temporarily replacing the passphrase text
        out.textContent = 'Copied to clipboard!';
        fitTextToContainer(out);
        setTimeout(() => {
            out.textContent = originalText;
            fitTextToContainer(out);
        }, 1200);
    } catch (err) {
        console.warn('Copy failed', err);
        out.textContent = 'Copy failed';
        fitTextToContainer(out);
        setTimeout(() => {
            out.textContent = originalText;
            fitTextToContainer(out);
        }, 1500);
    }
}

// Adjust font-size down until the text fits within the element's width.
function fitTextToContainer(el, minPx = 14, maxPx = 20) {
    if (!el) return;
    el.classList.remove('allow-scroll');

    // Run measurement on next frame to ensure DOM has updated
    requestAnimationFrame(() => {
        const style = window.getComputedStyle(el);
        const padLeft = parseFloat(style.paddingLeft) || 0;
        const padRight = parseFloat(style.paddingRight) || 0;
        // subtract a small safety margin to avoid off-by-one/rounding overflow
        const availableWidth = Math.max(0, el.clientWidth - padLeft - padRight - 4);

        // create or reuse an offscreen measurer
        let meas = document.getElementById('__passphrase_measure');
        if (!meas) {
            meas = document.createElement('span');
            meas.id = '__passphrase_measure';
            meas.style.position = 'absolute';
            meas.style.left = '-9999px';
            meas.style.top = '-9999px';
            meas.style.visibility = 'hidden';
            meas.style.whiteSpace = 'nowrap';
            document.body.appendChild(meas);
        }

        // copy relevant font metrics so measured width matches
        meas.style.fontFamily = style.fontFamily;
        meas.style.fontWeight = style.fontWeight;
        meas.style.fontStyle = style.fontStyle;
        meas.style.letterSpacing = style.letterSpacing;

        const text = el.textContent || '';

        // Binary search for largest font-size that fits
        let low = Math.floor(minPx);
        let high = Math.ceil(maxPx);
        let best = low;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            meas.style.fontSize = mid + 'px';
            meas.textContent = text;
            // use subpixel measurement for better accuracy
            const measured = Math.ceil(meas.getBoundingClientRect().width);
            if (measured <= availableWidth) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        el.style.fontSize = best + 'px';

        // If it still doesn't fit at minimum, allow horizontal scroll and tooltip
        meas.style.fontSize = minPx + 'px';
        meas.textContent = text;
        const minMeasured = Math.ceil(meas.getBoundingClientRect().width);
        if (minMeasured > availableWidth) {
            el.classList.add('allow-scroll');
            el.title = text;
            el.style.fontSize = minPx + 'px';
            el.scrollLeft = 0;
            // set fade classes based on scroll position and add listener to update them
            updateFade(el);
            // attach scroll handler if not already attached
            if (!el._passphrase_scroll_handler) {
                el._passphrase_scroll_handler = () => updateFade(el);
                el.addEventListener('scroll', el._passphrase_scroll_handler);
            }
        } else {
            el.classList.remove('allow-scroll');
            el.removeAttribute('title');
            // remove any fade classes and scroll handler
            el.classList.remove('fade-left', 'fade-right');
            if (el._passphrase_scroll_handler) {
                el.removeEventListener('scroll', el._passphrase_scroll_handler);
                el._passphrase_scroll_handler = null;
            }
        }
    });
}

function updateFade(el) {
    if (!el) return;
    // Only show fades when there's meaningful overflow (avoid fades when only a pixel or two overflow).
    const rightOverflow = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    const leftOverflow = el.scrollLeft;
    const threshold = 8; // pixels of overflow required to show a fade
    const canScrollRight = rightOverflow > threshold;
    const canScrollLeft = leftOverflow > threshold;
    el.classList.toggle('fade-right', canScrollRight);
    el.classList.toggle('fade-left', canScrollLeft);
}


// Refit on window resize
window.addEventListener('resize', () => {
    const out = document.getElementById('password1');
    if (out) fitTextToContainer(out);
});

// --- EFF wordlist loader (optional) ---
let effLoaded = false;
let effLoadPromise = null;

async function loadEFFWordlist() {
    if (effLoadPromise) return effLoadPromise;
    effLoadPromise = (async () => {
        try {
            const res = await fetch('eff-wordlist.txt');
            if (!res.ok) throw new Error('eff-wordlist.txt not found');
            const text = await res.text();
            // EFF wordlists include a numeric index column. Take the final token on each line
            // so we only keep the actual word (e.g. "11111 aardvark" -> "aardvark").
            const list = text.split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                    const parts = line.split(/\s+/);
                    return parts[parts.length - 1];
                })
                .filter(Boolean);
            if (list.length > 0) {
                // Replace embedded words with the loaded list
                words.length = 0;
                words.push(...list);
                effLoaded = true;
                console.log('Loaded local EFF wordlist with', words.length, 'words');
            }
        } catch (err) {
            console.warn('Could not load local EFF wordlist; using embedded list.');
        }
    })();
    return effLoadPromise;
}

// Kick off loading in background; generatePassphrases will await this if needed.
loadEFFWordlist();


