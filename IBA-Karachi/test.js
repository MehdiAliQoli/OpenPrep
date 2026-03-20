/* ── SUPABASE CONFIG ─────────────────────────────────────────── */
const SUPABASE_URL = window.SUPABASE_URL
const SUPABASE_KEY = window.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase config. Create root supabase.js (gitignored) and define window.SUPABASE_URL + window.SUPABASE_KEY.')
}

const supabaseClient = window.__openprepSupabaseClient || (() => {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase SDK not loaded. Add https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 before this script.')
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  window.__openprepSupabaseClient = client
  return client
})()

async function guardPage() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
      window.location.replace('../Signup/auth.html')
      return false
    }
    return true
  } catch (_) {
    window.location.replace('../Signup/auth.html')
    return false
  }
}
/* ── STATE ───────────────────────────────────────────────────── */
let questions    = []
let answers      = {}
let currentIndex = 0
let timerInterval
let secondsLeft  = 7200    // fixed 2 hours (no duration col in DB)
let paperData    = null
let reviewMode   = false
let hasSubmitted = false
let submitInProgress = false

function ensureToastStyles() {
  if (document.getElementById('saveToastStyles')) return
  const style = document.createElement('style')
  style.id = 'saveToastStyles'
  style.textContent = `
    .save-toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #ffffff;
      z-index: 9999;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
    }
    .save-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .save-toast.success { background: #1e7f4f; }
    .save-toast.error { background: #b63a3a; }
  `
  document.head.appendChild(style)
}

function showSaveToast(message, type = 'success') {
  ensureToastStyles()
  const toast = document.createElement('div')
  toast.className = `save-toast ${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    toast.classList.add('show')
  })

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 250)
  }, 2500)
}

/* ── INIT ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const isAllowed = await guardPage()
  if (!isAllowed) return
  loadQuestions()
})

/* ── GET HEADERS FOR SUPABASE ────────────────────────────────── */
async function getHeaders() {
  const { data: { session } } = await supabaseClient.auth.getSession()
  const token = session ? session.access_token : SUPABASE_KEY

  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

/* ── GET PAPER ID FROM URL ───────────────────────────────────── */
function getPaperId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('paper')
}

function normalizeQuestionRow(row, index) {
  const mappedQuestion   = row.question ?? row.queston ?? ''
  const mappedCorrectRaw = String(row.correct ?? row.cor ?? '').trim().toLowerCase()
  const mappedCorrect    = mappedCorrectRaw ? mappedCorrectRaw[0] : ''
  const mappedExplanation = String(row.explanation ?? '').trim()

  return {
    ...row,
    question: mappedQuestion,
    subject:  row.subject || 'General',
    number:   row.number ?? index + 1,
    correct:  mappedCorrect,
    explanation: mappedExplanation,
  }
}

async function parseErrorBody(response) {
  try {
    const payload = await response.json()
    if (payload?.message) return payload.message
  } catch (_) {}
  return `${response.status} ${response.statusText}`.trim()
}

/* ── FETCH FROM "test" TABLE ─────────────────────────────────── */
async function fetchQuestionsForPaper(paperId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/test?paper_id=eq.${encodeURIComponent(paperId)}&order=id.asc&select=*`,
    { headers: await getHeaders() }
  )

  if (response.ok) {
    const rows = await response.json()
    return rows.map((row, idx) => normalizeQuestionRow(row, idx))
  }

  const errMsg = await parseErrorBody(response)
  throw new Error(`Could not load questions: ${errMsg}`)
}

async function isAnyQuestionVisible() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/test?limit=1&select=id`,
    { headers: await getHeaders() }
  )

  if (!response.ok) return false
  const rows = await response.json()
  return rows.length > 0
}

/* ── LOAD FROM SUPABASE ──────────────────────────────────────── */
async function loadQuestions() {
  const paperId = getPaperId()
  showState('loading')

  if (!paperId) {
    showState('error')
    document.getElementById('errorMsg').textContent =
      'No paper selected. Go back and click a paper to start.'
    return
  }

  try {
    // 1. Fetch paper info (only id + title now)
    try {
      const paperRes = await fetch(
        `${SUPABASE_URL}/rest/v1/papers?id=eq.${encodeURIComponent(paperId)}&select=id,title`,
        { headers: await getHeaders() }
      )
      if (paperRes.ok) {
        const papers = await paperRes.json()
        if (papers.length) paperData = papers[0]
      }
    } catch (_) {
      paperData = null
    }

    // 2. Fetch questions from "test" table
    questions = await fetchQuestionsForPaper(paperId)

    if (!questions.length) {
      const anyVisible = await isAnyQuestionVisible()
      if (!anyVisible) {
        throw new Error(
          'No rows visible in the "test" table. If RLS is enabled, add a SELECT policy for authenticated users.'
        )
      }
      throw new Error(
        `No questions found for paper "${paperId}". Check that paper_id values in the "test" table match this URL parameter.`
      )
    }

    // 3. Set up UI
    const resolvedTitle = paperData?.title || `Paper ${paperId}`
    document.getElementById('paperTitle').textContent = resolvedTitle
    document.title = `OpenPrep — ${resolvedTitle}`
    document.getElementById('qTotal').textContent     = questions.length
    document.getElementById('remainingCount').textContent = questions.length

    secondsLeft = paperData?.duration || 7200
    startTimer()
    buildGrid()
    renderQuestion()
    showState('content')

  } catch (err) {
    showState('error')
    document.getElementById('errorMsg').textContent = err.message
  }
}

/* ── UI HELPERS ──────────────────────────────────────────────── */
function showState(state) {
  document.getElementById('loadingState').style.display = state === 'loading' ? 'flex' : 'none'
  document.getElementById('errorState').style.display = state === 'error' ? 'block' : 'none'
  document.getElementById('questionContent').style.display = state === 'content' ? 'block' : 'none'
}

function buildGrid() {
  const grid = document.getElementById('qGrid')
  grid.innerHTML = ''
  questions.forEach((_, i) => {
    const dot = document.createElement('button')
    dot.className = 'q-dot'
    dot.type = 'button'
    dot.textContent = i + 1
    dot.onclick = () => jumpTo(i)
    dot.id = `dot-${i}`
    grid.appendChild(dot)
  })
}

function renderQuestion() {
  const q = questions[currentIndex]
  if (!q) return

  // meta
  document.getElementById('qNum').textContent = currentIndex + 1
  document.getElementById('qSubject').textContent = q.subject || 'General'
  document.getElementById('qText').textContent = q.question

  // progress by position
  const pct = ((currentIndex + 1) / questions.length * 100).toFixed(1)
  document.getElementById('topProgressFill').style.width = pct + '%'

  // options
  const opts = document.getElementById('optionsList')
  opts.innerHTML = ''
  const keys = ['a', 'b', 'c', 'd']
  const labels = ['A', 'B', 'C', 'D']
  const selected = answers[currentIndex]

  keys.forEach((key, i) => {
    const value = q[`option_${key}`] || ''
    if (!value) return

    const optionEl = document.createElement('div')
    optionEl.className = 'option'

    if (reviewMode) {
      if (key === q.correct) {
        optionEl.classList.add('correct')
      } else if (key === selected && key !== q.correct) {
        optionEl.classList.add('wrong')
      }
    } else if (key === selected) {
      optionEl.classList.add('selected')
    }

    if (!reviewMode) {
      optionEl.addEventListener('click', () => selectAnswer(key))
    }

    const letterEl = document.createElement('div')
    letterEl.className = 'option-letter'
    letterEl.textContent = labels[i]

    const textEl = document.createElement('div')
    textEl.className = 'option-text'
    textEl.textContent = value

    optionEl.appendChild(letterEl)
    optionEl.appendChild(textEl)
    opts.appendChild(optionEl)
  })

  let explanationEl = document.getElementById('explanationBox')
  if (!explanationEl) {
    explanationEl = document.createElement('div')
    explanationEl.id = 'explanationBox'
    explanationEl.className = 'explanation-box'
    opts.insertAdjacentElement('afterend', explanationEl)
  }
  if (reviewMode) {
    const correctLabel = String(q.correct || '').toUpperCase() || 'N/A'
    const explanationText = q.explanation || 'No explanation available for this question.'
    explanationEl.innerHTML = `<strong>Correct Answer:</strong> ${correctLabel}<br><strong>Explanation:</strong> ${explanationText}`
    explanationEl.classList.add('show')
  } else {
    explanationEl.classList.remove('show')
  }

  const prevBtn = document.getElementById('prevBtn')
  const nextBtn = document.getElementById('nextBtn')
  prevBtn.disabled = currentIndex === 0
  nextBtn.disabled = false
  nextBtn.textContent = currentIndex === questions.length - 1 ? 'Finish →' : 'Next →'

  updateGrid()
  updateStats()
}

function selectAnswer(key) {
  if (reviewMode) return
  // Toggle: green->white when clicking the same selected option again
  if (answers[currentIndex] === key) {
    delete answers[currentIndex]
  } else {
    answers[currentIndex] = key
  }
  renderQuestion()
}

function updateGrid() {
  questions.forEach((_, i) => {
    const dot = document.getElementById(`dot-${i}`)
    if (!dot) return
    dot.className = 'q-dot'
    if (i === currentIndex) dot.classList.add('current')
    else if (answers[i]) dot.classList.add('answered')
  })
}

function updateStats() {
  const answered = Object.keys(answers).length
  const total = questions.length
  const remaining = total - answered

  document.getElementById('answeredCount').textContent = answered
  document.getElementById('skippedCount').textContent = remaining
  document.getElementById('remainingCount').textContent = remaining
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--
    renderQuestion()
  }
}

function nextQuestion() {
  if (hasSubmitted && !reviewMode) return
  if (currentIndex < questions.length - 1) {
    currentIndex++
    renderQuestion()
  } else {
    submitTest()
  }
}

function jumpTo(index) {
  currentIndex = index
  renderQuestion()
}

function startTimer() {
  updateTimerDisplay()
  timerInterval = setInterval(() => {
    if (hasSubmitted) return
    secondsLeft--
    updateTimerDisplay()
    if (secondsLeft <= 0) {
      clearInterval(timerInterval)
      submitTest()
    }
  }, 1000)
}

function updateTimerDisplay() {
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  document.getElementById('timerDisplay').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`

  const timer = document.getElementById('timer')
  timer.className = 'timer'
  if (secondsLeft <= 300) timer.classList.add('danger')
  else if (secondsLeft <= 900) timer.classList.add('warning')
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function calculateResult() {
  let correct = 0
  let wrong = 0
  let skipped = 0

  questions.forEach((q, idx) => {
    const selected = String(answers[idx] || '').trim().toLowerCase()
    const right = String(q.correct || '').trim().toLowerCase()
    if (!selected) skipped++
    else if (selected === right) correct++
    else wrong++
  })

  const attempted = correct + wrong
  const total = questions.length || 1
  const score = Math.round((correct / total) * 100)

  return { correct, wrong, skipped, attempted, score }
}

function getLocalStatsStoreKey(userId) {
  return `openprep_user_stats_v1_${userId}`
}

function readLocalStats(userId) {
  try {
    const raw = localStorage.getItem(getLocalStatsStoreKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch (_) {
    return {}
  }
}

function writeLocalStats(userId, map) {
  try {
    localStorage.setItem(getLocalStatsStoreKey(userId), JSON.stringify(map))
    return true
  } catch (_) {
    return false
  }
}

async function persistUserStats(result) {
  const { data: { session } } = await supabaseClient.auth.getSession()
  const userId = session?.user?.id
  const paperId = getPaperId()
  if (!userId || !paperId) return false

  // Local fallback keeps progress visible on homepage even if DB relation/policies are misconfigured.
  const localStats = readLocalStats(userId)
  const existingLocal = localStats[paperId]
  if (!existingLocal || result.correct > (existingLocal.correct || 0)) {
    localStats[paperId] = {
      attempted: result.attempted,
      correct: result.correct,
      wrong: result.wrong
    }
    writeLocalStats(userId, localStats)
  }

  try {
    const { data: existing, error: selectError } = await supabaseClient
      .from('user_stats')
      .select('id, correct')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .maybeSingle()

    if (selectError) {
      console.warn('Could not read user_stats:', selectError.message)
      return true
    }

    if (existing) {
      if (result.correct > (existing.correct || 0)) {
        const { error: updateError } = await supabaseClient
          .from('user_stats')
          .update({
            attempted: result.attempted,
            correct: result.correct,
            wrong: result.wrong
          })
          .eq('id', existing.id)
        if (updateError) {
          console.warn('Could not update user_stats:', updateError.message)
        }
      }
      return true
    }

    const { error: insertError } = await supabaseClient
      .from('user_stats')
      .insert([
        {
          user_id: userId,
          paper_id: paperId,
          attempted: result.attempted,
          correct: result.correct,
          wrong: result.wrong
        }
      ])

    if (insertError) {
      console.warn('Could not insert user_stats:', insertError.message)
    }
  } catch (err) {
    console.warn('persistUserStats failed:', err.message)
  }

  return true
}

function showResultModal(result) {
  document.getElementById('scoreVal').textContent = result.score + '%'
  document.getElementById('correctVal').textContent = result.correct
  document.getElementById('wrongVal').textContent = result.wrong
  document.getElementById('skippedVal').textContent = result.skipped
  const modal = document.getElementById('resultModal')
  if (modal) {
    modal.style.display = 'flex'
  } else {
    showSaveToast('Test submitted successfully.', 'success')
  }
  reviewMode = false
}

async function submitTest() {
  if (submitInProgress || hasSubmitted) return
  submitInProgress = true

  const submitBtn = document.getElementById('submitTestBtn')
  if (submitBtn) submitBtn.disabled = true

  clearInterval(timerInterval)
  const result = calculateResult()

  let statsSaved = false
  let saveMessage = 'Result shown, but stats could not be saved.'

  try {
    statsSaved = await persistUserStats(result)
    saveMessage = statsSaved
      ? 'Result saved to your profile.'
      : 'Result shown, but stats could not be saved.'
  } catch (_) {
    statsSaved = false
    saveMessage = 'Result shown, but stats could not be saved.'
  }

  hasSubmitted = true
  if (submitBtn) submitBtn.textContent = 'Submitted'
  showResultModal(result)
  showSaveToast(saveMessage, statsSaved ? 'success' : 'error')
  submitInProgress = false
}

function reviewAnswers() {
  reviewMode = true
  document.getElementById('resultModal').style.display = 'none'
  document.getElementById('submitTestBtn').style.display = 'none'
  currentIndex = 0
  renderQuestion()
}