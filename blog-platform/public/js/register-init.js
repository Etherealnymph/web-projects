// Read font size from body's data-fontsize and apply to root element.
(function(){
  try {
    var body = document.body || document.getElementsByTagName('body')[0] || document.documentElement
    var fs = body.getAttribute && (body.getAttribute('data-fontsize') || (body.dataset && body.dataset.fontsize))
    if (!fs && document.documentElement && document.documentElement.getAttribute) {
      fs = document.documentElement.getAttribute('data-fontsize')
    }
    if (fs) document.documentElement.style.fontSize = fs
  } catch (e) { /* ignore */ }
})()
