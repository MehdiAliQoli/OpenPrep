/* ─── FLASHCARD DATA ──────────────────────────────── */
const cards = [
  {
    q: "A train travels 120 km in 2 hours, then 180 km in the next 3 hours. What is its average speed for the entire journey?",
    a: "<strong>60 km/h</strong><br><br>Total distance = 120 + 180 = 300 km. Total time = 2 + 3 = 5 hours. Average speed = 300 ÷ 5 = 60 km/h.",
    subject: "IBA · Quantitative"
  },
  {
    q: "Choose the word most similar in meaning to AMELIORATE.",
    a: "<strong>Improve</strong><br><br>Ameliorate means to make something bad or unsatisfactory better. Synonyms include improve, enhance, better, and alleviate.",
    subject: "IBA · Verbal"
  },
  {
    q: "If all Ps are Qs, and some Qs are Rs, which conclusion must be true?",
    a: "<strong>Some Ps may be Rs — but it is not guaranteed.</strong><br><br>The premises only tell us P⊆Q and Q∩R≠∅. We cannot conclude P∩R≠∅ definitively.",
    subject: "IBA · Analytical"
  },
  {
    q: "The mitochondria produce ATP through a process called:",
    a: "<strong>Cellular respiration</strong> (specifically oxidative phosphorylation in the inner mitochondrial membrane).<br><br>This is the key energy production pathway tested in MDCAT biology.",
    subject: "MDCAT · Biology"
  },
  {
    q: "A resistor of 5Ω is connected in parallel with a 10Ω resistor. What is the equivalent resistance?",
    a: "<strong>3.33 Ω</strong><br><br>1/R = 1/5 + 1/10 = 2/10 + 1/10 = 3/10<br>R = 10/3 ≈ 3.33 Ω",
    subject: "ECAT · Physics"
  }
];

/* ─── FLASHCARD STATE ─────────────────────────────── */
let currentCard = 0;
let isFlipped = false;

/* ─── RENDER CURRENT CARD ─────────────────────────── */
function renderCard() {
  const card = cards[currentCard];

  document.getElementById('qText').textContent    = card.q;
  document.getElementById('aText').innerHTML      = card.a;
  document.getElementById('qSubject').textContent = card.subject;
  document.getElementById('aSubject').textContent = card.subject;
  document.getElementById('qNum').textContent     = currentCard + 1;
  document.getElementById('fcCount').textContent  = (currentCard + 1) + ' / ' + cards.length;

  const progress = ((currentCard + 1) / cards.length * 100) + '%';
  document.getElementById('fcBar').style.width = progress;

  document.getElementById('prevBtn').disabled = currentCard === 0;
  document.getElementById('nextBtn').disabled = currentCard === cards.length - 1;

  /* reset flip when moving to a new card */
  if (isFlipped) {
    document.getElementById('fcWrap').classList.remove('flipped');
    isFlipped = false;
  }
}

/* ─── FLIP ────────────────────────────────────────── */
function flipCard() {
  isFlipped = !isFlipped;
  document.getElementById('fcWrap').classList.toggle('flipped', isFlipped);
}

/* ─── NAVIGATION ──────────────────────────────────── */
function nextCard() {
  if (currentCard < cards.length - 1) {
    currentCard++;
    renderCard();
  }
}

function prevCard() {
  if (currentCard > 0) {
    currentCard--;
    renderCard();
  }
}

/* ─── TABS ────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(t) {
        t.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
}

/* ─── INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  renderCard();
  initTabs();
});
