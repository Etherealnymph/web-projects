// 负责切换主题并把选择存储在 localStorage
(function(){
  const KEY = 'site-theme'
  function applyTheme(t){
    document.body.classList.toggle('light', t === 'light')
  }

  const saved = localStorage.getItem(KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  // prefer server-side session theme when available (body has class set)
  const bodyTheme = document.body.classList.contains('light') ? 'light' : (document.body.classList.contains('dark') ? 'dark' : null)
  applyTheme(bodyTheme || saved)

  // 创建并注入开关按钮到 header（如果 header 存在）
  function makeToggle(){
    const btn = document.createElement('button')
    btn.className = 'toggle'
    function update(){
      const lang = (document.body && document.body.dataset && document.body.dataset.lang) ? document.body.dataset.lang : 'zh-CN'
      const map = {
        'zh-CN': { on: '关灯', off: '开灯' },
        'en-US': { on: 'Lights Off', off: 'Lights On' }
      }
      const m = map[lang] || map['zh-CN']
      btn.textContent = document.body.classList.contains('light') ? m.on : m.off
    }
    btn.addEventListener('click', ()=>{
      const isLight = document.body.classList.toggle('light')
      localStorage.setItem(KEY, isLight ? 'light' : 'dark')
      update()
    })
    update()
    return btn
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // apply server-side brightness if provided
    try {
      const b = document.body && document.body.dataset && document.body.dataset.brightness
      if (b) document.documentElement.style.filter = `brightness(${b})`
    } catch (e) {}
    // apply server-side font size if provided
    try {
      const fs = document.body && document.body.dataset && document.body.dataset.fontsize
      if (fs) document.documentElement.style.fontSize = fs
    } catch (e) {}
    const header = document.querySelector('.site-header .controls')
    if(header) header.prepend(makeToggle())
  })
})();