'use strict';

/*
  Password Generator (client-side)
  - Secure RNG via crypto.getRandomValues
  - Passphrase & Character modes
  - Pre- and post-generation entropy & time-to-crack
  - No network, no storage, clipboard only on user action
*/

/* ---------------------------
   Utilities: secure RNG
   --------------------------- */
function secureRandomUint32() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0];
}

// Avoid modulo bias
function secureRandomInt(maxExclusive) {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
  const maxUint = 0xFFFFFFFF;
  const threshold = maxUint - (maxUint % maxExclusive);
  while (true) {
    const r = secureRandomUint32();
    if (r < threshold) return r % maxExclusive;
  }
}

function secureChoice(arr) {
  return arr[secureRandomInt(arr.length)];
}

// Wordlist loader: tries external JSON then falls back to small built-in list
let WORDLIST = null;

async function loadWordlist() {
  try {
    const resp = await fetch('assets/wordlist.json', { cache: 'no-cache' });
    if (resp.ok) {
      const arr = await resp.json();
      if (Array.isArray(arr) && arr.length >= 10) { // minimal sanity check
        WORDLIST = arr;
        console.info(`Loaded external wordlist (${WORDLIST.length} words)`);
      } else {
        throw new Error('wordlist.json invalid or too small');
      }
    } else {
      throw new Error('fetch failed');
    }
  } catch (err) {
    console.warn('External wordlist not loaded — using embedded fallback.', err);
    // fallback: keep your small built-in array here (200 words)
    WORDLIST = ["apple","anchor","amber","atlas","axiom","beacon","breeze","brisk","cobalt","copper","crimson","crest","dawn","delta","ember","echo",
      "forge","fable","garnet","glade","hollow","harbor","iris","ivory","jolt","jade","keystone","kismet","lumen","lunar","mosaic","matrix",
      "nebula","native","opal","oracle","pinnacle","pioneer","quartz","quiet","rift","ranger","sable","solar","spruce","titan","tracer","umbra",
      "union","vapor","valiant","woven","whistle","xenon","yearn","yonder","zephyr","zenith","azure","crest","marble","canyon","willow","orchid",
      "violet","sage","cinder","flint","cobalt","saffron","harvest","meadow","glimmer","fusion","harbor","legend","mongoose","poppy","copper",
      "thrive","riddle","cobalt","raven","dune","copper","stride","haven","ember","basil","cascade","dapper","evolve","frank","grove","haven",
      "ignite","juno","latch","mirth","nimbus","opal","prism","quest","ripple","sable","terra","uplift","verve","wisp","yarrow","zeal",
      "arcade","bravo","caper","drift","elixir","flute","gale","halt","ion","jewel","knack","lodge","muse","noir","opal","paragon","quietus",
      "resin","sprout","tango","undertow","vivid","wax","yacht","zest","bloom","citrine","dock","ember","flare","grotto","harbor","isle",
      "jolt","kale","lagoon","mantle","niche","oath","pixel","quill","rover","solace","thimble","umbel","vigil","waltz","xerox","yodel","zeppelin",
      "apex","brook","crest","delta","eon","forge","glisten","hush","iris","jade","koi","lore","maze","nest","olive","peak","quip","rush","sprig",
      "thaw","ultra","vortex","wane","yearn","zen"];
      console.info(`Using fallback wordlist (${WORDLIST.length} words).`);
  }
}

// Call loadWordlist before init
loadWordlist().then(() => {
  preGenerationEstimate();
  if (typeof init === 'function') init();
});


/* ---------------=p=------------
   Leet map for substitutions
   --------------------------- */
const LEET_MAP = {
  a: ['4','@'],
  b: ['8'],
  e: ['3'],
  g: ['9'],
  i: ['1','!'],
  l: ['1','|'],
  o: ['0'],
  s: ['5','$'],
  t: ['7'],
  z: ['2']
};

/* ---------------------------
   Symbol set
   --------------------------- */
const SYMBOLS = ['!','@','#','$','%','^','&','*','(',')','-','_','=','+','[',']','{','}',';',':',',','.','/','?','<','>','~'];

/* ---------------------------
   DOM references
   --------------------------- */
const modeSelect = document.getElementById('modeSelect');
const numWordsEl = document.getElementById('numWords');
const separatorEl = document.getElementById('separator');
const personalInput = document.getElementById('personalInput');
const enableCapEl = document.getElementById('enableCap');
const enableLeetEl = document.getElementById('enableLeet');
const enableInsertExtrasEl = document.getElementById('enableInsertExtras');

const charLengthEl = document.getElementById('charLength');
const includeLowerEl = document.getElementById('includeLower');
const includeUpperEl = document.getElementById('includeUpper');
const includeDigitsEl = document.getElementById('includeDigits');
const includeSymbolsEl = document.getElementById('includeSymbols');

const guessRateEl = document.getElementById('guessRate');

const estimateBtn = document.getElementById('estimateBtn');
const generateBtn = document.getElementById('generateBtn');
const regenBtn = document.getElementById('regenBtn');

const preBitsEl = document.getElementById('preBits');
const preCrackEl = document.getElementById('preCrack');
const postBitsEl = document.getElementById('postBits');
const postCrackEl = document.getElementById('postCrack');

const passwordOutput = document.getElementById('passwordOutput');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const showHideBtn = document.getElementById('showHideBtn');
const historyList = document.getElementById('historyList');

const passphraseOptions = document.getElementById('passphraseOptions');
const characterOptions = document.getElementById('characterOptions');

const presetEasy = document.getElementById('presetEasy');
const presetMedium = document.getElementById('presetMedium');
const presetHard = document.getElementById('presetHard');

/* ---------------------------
   UI wiring
   --------------------------- */
modeSelect.addEventListener('change', () => {
  if (modeSelect.value === 'passphrase') {
    passphraseOptions.style.display = '';
    characterOptions.style.display = 'none';
  } else {
    passphraseOptions.style.display = 'none';
    characterOptions.style.display = '';
  }
});

presetEasy.addEventListener('click', () => {
  if (modeSelect.value === 'passphrase') numWordsEl.value = 3;
  else charLengthEl.value = 10;
});
presetMedium.addEventListener('click', () => {
  if (modeSelect.value === 'passphrase') numWordsEl.value = 4;
  else charLengthEl.value = 14;
});
presetHard.addEventListener('click', () => {
  if (modeSelect.value === 'passphrase') numWordsEl.value = 5;
  else charLengthEl.value = 20;
});

/* ---------------------------
   Math helpers for combinatorics in log2 space
   --------------------------- */
function log2(n) { return Math.log2(n); }

// log2 of binomial coefficient C(n,k), using multiplicative formula in logs.
function log2_nCr(n, k) {
  if (k < 0 || k > n) return -Infinity;
  k = Math.min(k, n - k);
  let sum = 0;
  for (let i = 1; i <= k; i++) {
    sum += Math.log2((n - k + i) / i);
  }
  return sum;
}

/* ---------------------------
   Entropy and time-to-crack calculations
   - For character mode: bits = length * log2(poolSize)
   - For passphrase: bits = numWords * log2(W) + transform bits calculated from choices
   --------------------------- */

function charPoolSize(opts) {
  let size = 0;
  if (opts.lower) size += 26;
  if (opts.upper) size += 26;
  if (opts.digits) size += 10;
  if (opts.symbols) size += SYMBOLS.length;
  return size;
}

function bitsForCharacterMode(length, poolSize) {
  if (poolSize <= 0) return 0;
  return length * Math.log2(poolSize);
}

// For passphrase: compute bits based on word selection and applied transformations.
// We compute exact bits for a generated password given we know how many letters, how many leet options used etc.
function bitsForPassphraseModel(numWords, wordlistSize, transforms) {
  // Base word choices:
  let bits = numWords * Math.log2(wordlistSize);

  // Capitalisation: each alphabetic character could be upper/lower (if randomCap was enabled)
  if (transforms.capitalisation && transforms.lettersCount) {
    bits += transforms.lettersCount * 1.0; // *log2(2) = 1
  }

  // Leet: for each letter where we could have substituted, we add log2(alternatives)
  if (transforms.leet && transforms.leetChoices && transforms.leetChoices.length) {
    for (const c of transforms.leetChoices) {
      // c is number of alternatives for that character (including keeping original)
      bits += Math.log2(c);
    }
  }

  // Insertions (digits/symbols):
  if (transforms.insertions && transforms.insertions.count) {
    const k = transforms.insertions.count;
    const choiceSize = transforms.insertions.choiceSize; // e.g., 10 for digits, SYMBOLS.length for symbols, or combined
    // digits/symbols selection bits = k * log2(choiceSize)
    bits += k * Math.log2(choiceSize);

    // positions: choose k insertion positions among (baseLen + k) slots.
    const positionsLog2 = log2_nCr(transforms.baseLen + k, k);
    bits += positionsLog2;
  }

  // If we mixed anything else, add here.

  return bits;
}

// Convert bits to human-friendly crack time at given guesses per second.
// Avoid huge numbers by working in log10 domain.
function formatCrackTimeFromBits(bits, guessesPerSec) {
  if (bits <= 0) return { label: '<1 second', seconds: 0 };

  const log10Guesses = bits * Math.log10(2);
  const log10Seconds = log10Guesses - Math.log10(guessesPerSec);
  if (log10Seconds < 0) {
    return { label: '<1 second', seconds: Math.pow(10, log10Seconds) };
  }

  const SECS_PER_YEAR = 31557600; // average

  const log10Years = log10Seconds - Math.log10(SECS_PER_YEAR);

  // If years < 1e6 show numeric, else show scientific
  if (log10Years < 6) {
    const years = Math.pow(10, log10Years);
    if (years < 60) {
      const days = (Math.pow(10, log10Seconds) / 86400);
      if (days < 1) {
        const hours = (Math.pow(10, log10Seconds) / 3600);
        if (hours < 1) {
          const minutes = (Math.pow(10, log10Seconds) / 60);
          return { label: `${minutes.toFixed(2)} minutes`, seconds: Math.pow(10, log10Seconds) };
        }
        return { label: `${hours.toFixed(2)} hours`, seconds: Math.pow(10, log10Seconds) };
      }
      return { label: `${days.toFixed(2)} days`, seconds: Math.pow(10, log10Seconds) };
    } else {
      return { label: `${years.toFixed(2)} years`, seconds: Math.pow(10, log10Seconds) };
    }
  } else {
    // Large number: show scientific
    const exponentYears = Math.floor(log10Years);
    const mantissa = Math.pow(10, log10Years - exponentYears);
    const sci = `${mantissa.toFixed(2)}e${exponentYears} years`;
    return { label: `≈ ${sci}`, seconds: null };
  }
}

/* ---------------------------
   Password generators
   --------------------------- */

function generateCharacterPassword(length, poolCfg) {
  const pool = [];
  if (poolCfg.lower) for (let i=0;i<26;i++) pool.push(String.fromCharCode(97+i));
  if (poolCfg.upper) for (let i=0;i<26;i++) pool.push(String.fromCharCode(65+i));
  if (poolCfg.digits) for (let i=0;i<10;i++) pool.push(String.fromCharCode(48+i));
  if (poolCfg.symbols) SYMBOLS.forEach(s=>pool.push(s));
  if (pool.length === 0) return { password: '', transforms: {} };

  let pwd = '';
  for (let i=0;i<length;i++){
    pwd += secureChoice(pool);
  }

  const bits = bitsForCharacterMode(length, pool.length);
  const transforms = { poolSize: pool.length, length };
  return { password: pwd, bits, transforms };
}

function randomizeCapitalization(text) {
  let out = '';
  let lettersCount = 0;
  for (let ch of text) {
    if (/[a-zA-Z]/.test(ch)) {
      lettersCount++;
      // flip with 50% chance
      if ((secureRandomInt(2)) === 1) out += ch.toUpperCase();
      else out += ch.toLowerCase();
    } else out += ch;
  }
  return { text: out, lettersCount };
}

function applyLeet(text) {
  // For each char that has leet options, choose to replace or not.
  // Count alternatives per applicable char (including the choice to leave as-is)
  const choices = []; // store number of options for each considered char
  let out = '';
  for (let ch of text) {
    const low = ch.toLowerCase();
    if (LEET_MAP[low]) {
      // options = [original, ...alternatives]
      const opts = [ch, ...LEET_MAP[low]];
      // pick one randomly
      const pick = secureChoice(opts);
      out += pick;
      choices.push(opts.length);
    } else out += ch;
  }
  return { text: out, choices };
}

function insertExtras(text, opts) {
  // Insert digits and/or symbols. We choose a random count (1..maxInsert)
  const baseLen = text.length;
  const inserts = [];
  // decide count: 1 or 2 typically, or up to Math.ceil(baseLen/6)
  const maxInsert = Math.min(4, Math.max(1, Math.ceil(baseLen / 6)));
  const count = 1 + secureRandomInt(maxInsert); // 1..maxInsert
  for (let i=0;i<count;i++){
    const pickType = opts.symbols && opts.digits ? secureRandomInt(2) : (opts.symbols ? 1 : 0);
    if (pickType === 1) inserts.push(secureChoice(SYMBOLS));
    else inserts.push(String.fromCharCode(48 + secureRandomInt(10)));
  }
  // Insert each symbol/digit at random unique positions among baseLen + i
  let arr = text.split('');
  for (let i=0;i<inserts.length;i++){
    const pos = secureRandomInt(arr.length + 1); // 0..arr.length
    arr.splice(pos, 0, inserts[i]);
  }
  const final = arr.join('');
  const choiceSize = (opts.symbols && opts.digits) ? (SYMBOLS.length + 10) : (opts.symbols ? SYMBOLS.length : 10);
  return { text: final, count: inserts.length, choiceSize, baseLen };
}

function generatePassphrase(opts) {
  const wordChoices = [];
  const wl = WORDLIST;
  const W = wl.length;
  // choose words randomly
  for (let i=0;i<opts.numWords;i++){
    // allow inserting personal hint as one of the words sometimes
    if (opts.personal && opts.personal.length > 1 && secureRandomInt(5) === 0) {
      // mix the personal hint: maybe case-changed or truncated
      const p = opts.personal.replace(/\s+/g, '').slice(0, 12);
      wordChoices.push(p.toLowerCase());
    } else {
      wordChoices.push(secureChoice(wl));
    }
  }

  // join with separator
  let password = wordChoices.join(opts.separator);

  // Collect transforms info for entropy calculation
  const transforms = { capitalisation: false, lettersCount: 0, leet: false, leetChoices: [], insertions: null, baseLen: password.length };

  // capitalisation
  if (opts.enableCap) {
    const res = randomizeCapitalization(password);
    password = res.text;
    transforms.capitalisation = true;
    transforms.lettersCount = res.lettersCount;
  }

  // leet substitution
  if (opts.enableLeet) {
    const res = applyLeet(password);
    password = res.text;
    transforms.leet = true;
    transforms.leetChoices = res.choices; // array of alternatives counts
  }

  // insert extras (digits & symbols)
  if (opts.enableInsertExtras) {
    const res = insertExtras(password, { digits: true, symbols: true });
    password = res.text;
    transforms.insertions = { count: res.count, choiceSize: res.choiceSize };
    transforms.baseLen = res.baseLen;
  }

  // Bits from word choices + transforms
  const bits = bitsForPassphraseModel(opts.numWords, W, transforms);

  return { password, bits, transforms, words: wordChoices };
}

/* ---------------------------
   UI: estimate & generate
   --------------------------- */

function getOptionsFromUI() {
  const mode = modeSelect.value;
  const guessRate = Number(guessRateEl.value) || 1e10;
  if (mode === 'character') {
    return {
      mode,
      length: Number(charLengthEl.value) || 16,
      pool: {
        lower: includeLowerEl.checked,
        upper: includeUpperEl.checked,
        digits: includeDigitsEl.checked,
        symbols: includeSymbolsEl.checked
      },
      guessRate
    };
  } else {
    return {
      mode,
      numWords: Math.min(8, Math.max(2, Number(numWordsEl.value) || 4)),
      separator: separatorEl.value,
      personal: personalInput.value.trim(),
      enableCap: enableCapEl.checked,
      enableLeet: enableLeetEl.checked,
      enableInsertExtras: enableInsertExtrasEl.checked,
      guessRate
    };
  }
}

function preGenerationEstimate() {
  const opts = getOptionsFromUI();
  if (opts.mode === 'character') {
    const poolSize = charPoolSize(opts.pool);
    const bits = bitsForCharacterMode(opts.length, poolSize);
    const time = formatCrackTimeFromBits(bits, opts.guessRate);
    preBitsEl.textContent = `Bits of entropy: ${bits.toFixed(2)} (pool: ${poolSize})`;
    preCrackEl.textContent = `Estimated time to crack at ${opts.guessRate.toLocaleString()} guesses/sec: ${time.label}`;
  } else {
    // passphrase pre-estimate: compute base bits and add estimates for transforms
    const baseBits = opts.numWords * Math.log2(WORDLIST.length);
    // estimate transform bits conservatively:
    let extraBits = 0;
    if (opts.enableCap) {
      // estimate letters count = average 5 letters per word
      const avgLetters = 5;
      extraBits += avgLetters * opts.numWords * 1.0; // each letter could be upper/lower
    }
    if (opts.enableLeet) {
      // assume for letters with possible leet (approx 30% of letters) average 1.5 alternatives
      const approxAlternatives = 1.5;
      extraBits += opts.numWords * 3 * Math.log2(approxAlternatives);
    }
    if (opts.enableInsertExtras) {
      const k = Math.min(3, Math.max(1, Math.ceil(opts.numWords / 2)));
      const choiceSize = 10 + SYMBOLS.length;
      extraBits += k * Math.log2(choiceSize) + log2_nCr(opts.numWords * 5 + k, k);
    }

    const bits = baseBits + extraBits;
    const time = formatCrackTimeFromBits(bits, opts.guessRate);
    preBitsEl.textContent = `Bits of entropy (estimate): ${bits.toFixed(2)} (words: ${opts.numWords} × ${WORDLIST.length})`;
    preCrackEl.textContent = `Estimated time to crack at ${opts.guessRate.toLocaleString()} guesses/sec: ${time.label}`;
  }
}

let lastGenerated = null;

function postGenerationDisplay(result, opts) {
  passwordOutput.value = result.password;
  passwordOutput.type = 'text';
  copyBtn.disabled = false;
  downloadBtn.disabled = false;
  showHideBtn.disabled = false;
  regenBtn.disabled = false;

  // bits
  const bits = result.bits;
  postBitsEl.textContent = `Bits of entropy: ${bits.toFixed(2)}`;
  const time = formatCrackTimeFromBits(bits, opts.guessRate);
  postCrackEl.textContent = `Estimated time to crack at ${opts.guessRate.toLocaleString()} guesses/sec: ${time.label}`;

  // add to history
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleString()}: generated (${opts.mode}) — ${bits.toFixed(1)} bits`;
  if (historyList.childElementCount >= 6) historyList.removeChild(historyList.lastChild);
  historyList.insertBefore(li, historyList.firstChild);

  lastGenerated = { result, opts };
}

generateBtn.addEventListener('click', () => {
  const opts = getOptionsFromUI();
  if (opts.mode === 'character') {
    const res = generateCharacterPassword(opts.length, opts.pool);
    postGenerationDisplay(res, opts);
  } else {
    const res = generatePassphrase({
      numWords: opts.numWords,
      separator: opts.separator,
      personal: opts.personal,
      enableCap: opts.enableCap,
      enableLeet: opts.enableLeet,
      enableInsertExtras: opts.enableInsertExtras
    });
    postGenerationDisplay(res, opts);
  }
});

estimateBtn.addEventListener('click', preGenerationEstimate);

regenBtn.addEventListener('click', () => {
  if (!lastGenerated) return;
  // regenerate using the same options
  const opts = lastGenerated.opts;
  if (opts.mode === 'character') {
    const res = generateCharacterPassword(opts.length, opts.pool);
    postGenerationDisplay(res, opts);
  } else {
    const res = generatePassphrase({
      numWords: opts.numWords,
      separator: opts.separator,
      personal: opts.personal,
      enableCap: opts.enableCap,
      enableLeet: opts.enableLeet,
      enableInsertExtras: opts.enableInsertExtras
    });
    postGenerationDisplay(res, opts);
  }
});

/* ---------------------------
   Clipboard, download, show/hide
   --------------------------- */

copyBtn.addEventListener('click', async () => {
  const txt = passwordOutput.value;
  if (!txt) return;
  try {
    await navigator.clipboard.writeText(txt);
    alert('Password copied to clipboard (user-initiated).');
  } catch (e) {
    alert('Copy failed: use Ctrl+C (or allow clipboard permission).');
  }
});

downloadBtn.addEventListener('click', () => {
  const txt = passwordOutput.value;
  if (!txt) return;
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'password.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
});

let shown = true;
showHideBtn.addEventListener('click', () => {
  if (shown) {
    passwordOutput.type = 'password';
    showHideBtn.textContent = 'Show';
    shown = false;
  } else {
    passwordOutput.type = 'text';
    showHideBtn.textContent = 'Hide';
    shown = true;
  }
});

/* ---------------------------
   Init: set defaults & pre-calc
   --------------------------- */
(function init(){
  preGenerationEstimate();
})();
