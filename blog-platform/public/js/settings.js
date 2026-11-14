document.addEventListener('DOMContentLoaded', function(){
  const b = document.getElementById('brightness')
  if (b) {
    function apply(val){ document.documentElement.style.filter = `brightness(${val})` }
    apply(b.value)
    b.addEventListener('input', e => apply(e.target.value))
  }

  // apply theme class immediately if a select exists
  const themeSelect = document.querySelector('select[name="theme"]')
  if (themeSelect) {
    function applyTheme(v){
      if (v === 'light') document.body.classList.add('light')
      else document.body.classList.remove('light')
    }
    applyTheme(themeSelect.value)
    themeSelect.addEventListener('change', e => applyTheme(e.target.value))
  }
  // font size preview/apply
  const fs = document.getElementById('fontSizeSelect')
  if (fs) {
    function applyFont(v){
      try { document.documentElement.style.fontSize = v }
      catch(e){}
      const pt = document.getElementById('previewText')
      if (pt) pt.style.fontSize = v
    }
    applyFont(fs.value || '100%')
    fs.addEventListener('change', e => applyFont(e.target.value))
  }
})
