document.addEventListener('DOMContentLoaded', function(){
  const tabs = document.querySelectorAll('.tab-btn')
  const panels = document.querySelectorAll('.tab-panel')
  if (!tabs.length) return

  function activate(targetId, btn){
    panels.forEach(p => {
      if (p.id === targetId) p.classList.remove('hidden')
      else p.classList.add('hidden')
    })
    tabs.forEach(b => {
      if (b === btn) {
        b.classList.add('active')
        b.setAttribute('aria-selected','true')
      } else {
        b.classList.remove('active')
        b.setAttribute('aria-selected','false')
      }
    })
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target')
      activate(target, btn)
    })
  })

  // Activate tab from URL param ?tab=blogs|recommended|qna
  try {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab) {
      const map = { blogs: 'blogs-section', blog: 'blogs-section', recommended: 'recommended-section', qna: 'qna-section', question: 'qna-section' }
      const targetId = map[tab] || null
      if (targetId) {
        const btn = Array.from(tabs).find(b => b.getAttribute('data-target') === targetId)
        if (btn) activate(targetId, btn)
      }
    }
  } catch (e) {}

  // keyboard navigation (left/right)
  let currentIndex = Array.from(tabs).findIndex(t => t.classList.contains('active'))
  if (currentIndex < 0) currentIndex = 0
  tabs.forEach((t, i) => t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { currentIndex = (i + 1) % tabs.length; tabs[currentIndex].focus(); tabs[currentIndex].click() }
    if (e.key === 'ArrowLeft') { currentIndex = (i - 1 + tabs.length) % tabs.length; tabs[currentIndex].focus(); tabs[currentIndex].click() }
  }))
})
