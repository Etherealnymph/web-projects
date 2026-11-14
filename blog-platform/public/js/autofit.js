// autofit.js — simple responsive root font-size utility
// Usage:
//   <script src="/js/autofit.js"></script>
//   <script>autofit({ designWidth: 375, divisor: 10, maxWidth: 1200 })</script>
(function (win, doc) {
  function autofit(opts) {
    opts = Object.assign({ designWidth: 375, divisor: 10, maxWidth: 1200, debounce: 120 }, opts || {})
    var docEl = doc.documentElement

    function refresh() {
      var w = docEl.clientWidth || win.innerWidth || doc.body.clientWidth
      if (!w) return
      if (opts.maxWidth && w > opts.maxWidth) w = opts.maxWidth
      // set root font-size so designers can use rem units
      var fs = w / opts.divisor
      docEl.style.fontSize = fs + 'px'
    }

    var tid = null
    function onResize() {
      clearTimeout(tid)
      tid = setTimeout(refresh, opts.debounce)
    }

    win.addEventListener('resize', onResize, false)
    win.addEventListener('orientationchange', onResize, false)
    doc.addEventListener('DOMContentLoaded', refresh, false)
    // run immediately
    refresh()
  }

  // expose as global
  win.autofit = autofit
})(window, document)
