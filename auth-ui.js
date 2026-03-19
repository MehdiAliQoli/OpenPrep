/* ═══════════════════════════════════════════════════
   auth-ui.js — Profile avatar, dropdown & stats
   Depends on: window.SUPABASE_URL, window.SUPABASE_KEY
   (loaded from your existing supabase config file)
═══════════════════════════════════════════════════ */

;(async function () {

  /* ── 1. INIT SUPABASE CLIENT ─────────────────── */
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('auth-ui.js: Supabase SDK not loaded yet.')
    return
  }

  const supabaseClient = window.__openprepSupabaseClient || (() => {
    const client = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_KEY
    )
    window.__openprepSupabaseClient = client
    return client
  })()

  /* ── 2. GET SESSION ──────────────────────────── */
  const { data: { session } } = await supabaseClient.auth.getSession()

  const navLoginBtn  = document.getElementById('navLoginBtn')
  const profileWrap  = document.getElementById('profileWrap')

  if (!session) {
    // Not logged in — show login button, hide profile
    if (navLoginBtn)  navLoginBtn.style.display  = ''
    if (profileWrap)  profileWrap.style.display  = 'none'
    return
  }

  /* ── 3. USER IS LOGGED IN ────────────────────── */
  if (navLoginBtn) navLoginBtn.style.display = 'none'
  if (profileWrap) profileWrap.style.display = ''

  const user      = session.user
  const name      = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const email     = user.email || ''
  const photoUrl  = user.user_metadata?.avatar_url || ''

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

  function setStatValues(attempted, correct, wrong) {
    document.getElementById('statAttempted').textContent = String(attempted)
    document.getElementById('statCorrect').textContent   = String(correct)
    document.getElementById('statWrong').textContent     = String(wrong)
  }

  function applyLocalStats(userId) {
    const localMap = readLocalStats(userId)
    const rows = Object.values(localMap)
    const totalAttempted = rows.reduce((s, r) => s + (r.attempted || 0), 0)
    const totalCorrect   = rows.reduce((s, r) => s + (r.correct || 0), 0)
    const totalWrong     = rows.reduce((s, r) => s + (r.wrong || 0), 0)
    setStatValues(totalAttempted, totalCorrect, totalWrong)
  }

  /* ── 4. FILL AVATAR ──────────────────────────── */
  function buildAvatar(el, size) {
    if (!el) return
    if (photoUrl) {
      el.innerHTML = `<img src="${photoUrl}" alt="${name}" referrerpolicy="no-referrer" />`
    } else {
      // Use initials
      const initials = name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
      el.textContent = initials
      // Generate a consistent bg color from email
      el.style.background = hashColor(email)
    }
  }

  buildAvatar(document.getElementById('avatarEl'))
  buildAvatar(document.getElementById('dropdownAvatarEl'))

  /* ── 5. FILL DROPDOWN INFO ───────────────────── */
  const nameEl  = document.getElementById('dropdownName')
  const emailEl = document.getElementById('dropdownEmail')
  if (nameEl)  nameEl.textContent  = name
  if (emailEl) emailEl.textContent = email

  /* ── 6. DROPDOWN TOGGLE ──────────────────────── */
  const profileBtn      = document.getElementById('profileBtn')
  const profileDropdown = document.getElementById('profileDropdown')

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      profileDropdown.classList.toggle('open')
    })

    document.addEventListener('click', () => {
      profileDropdown.classList.remove('open')
    })

    profileDropdown.addEventListener('click', (e) => {
      e.stopPropagation()
    })
  }

  /* ── 7. LOGOUT ───────────────────────────────── */
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut()
      window.location.reload()
    })
  }

  /* ── 8. FETCH & SHOW STATS ───────────────────── */
  const statsSection = document.getElementById('statsSection')
  if (statsSection) {
    statsSection.style.display = ''

    try {
      const { data, error } = await supabaseClient
        .from('user_stats')
        .select('attempted, correct, wrong')
        .eq('user_id', user.id)

      if (!error && data && data.length > 0) {
        const totalAttempted = data.reduce((s, r) => s + (r.attempted || 0), 0)
        const totalCorrect   = data.reduce((s, r) => s + (r.correct   || 0), 0)
        const totalWrong     = data.reduce((s, r) => s + (r.wrong     || 0), 0)
        setStatValues(totalAttempted, totalCorrect, totalWrong)
      } else {
        applyLocalStats(user.id)
      }
    } catch (_) {
      applyLocalStats(user.id)
    }
  }

  /* ── HELPER: consistent color from string ────── */
  function hashColor(str) {
    const colors = [
      '#2563eb', '#7c3aed', '#0891b2', '#059669',
      '#d97706', '#dc2626', '#db2777', '#4f46e5'
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

})()