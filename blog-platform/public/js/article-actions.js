document.addEventListener('submit', async function(e) {
  const form = e.target
  if (!(form && form.tagName === 'FORM')) return
  const action = form.getAttribute('action') || ''
  if (!action) return
  // only handle our article/answer/comment endpoints
  if (!/\/article\/[^/]+\/(like|favorite|comments)$/.test(action) && !/\/comment\/[^/]+\/like$/.test(action) && !/\/answer\/[^/]+\/(like|favorite|comments)$/.test(action)) return
  e.preventDefault()
  // small client-side i18n using body dataset.lang
  const LANG = (document.body && document.body.dataset && document.body.dataset.lang) || 'zh-CN'
  const I18N = {
    'zh-CN': { like: '赞', liked: '已赞', favorite: '收藏', favorited: '已收藏', comment: '评论' },
    'en-US': { like: 'Like', liked: 'Liked', favorite: 'Favorite', favorited: 'Favorited', comment: 'Comments' }
  }
  const L = I18N[LANG] || I18N['zh-CN']

  try {
    const resp = await fetch(action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
    if (!resp.ok) {
      // fall back to normal submit if non-JSON
      form.submit()
      return
    }
    const data = await resp.json()
    // handle article like
    if (/\/article\/[^/]+\/like$/.test(action)) {
      const btn = form.querySelector('button')
      if (btn && typeof data.likesCount !== 'undefined') {
        btn.textContent = (data.isLiked ? L.liked : L.like) + ' (' + data.likesCount + ')'
      }
      return
    }
    // handle article favorite
    if (/\/article\/[^/]+\/favorite$/.test(action)) {
      const btn = form.querySelector('button')
      if (btn && typeof data.favoritesCount !== 'undefined') {
        btn.textContent = (data.isFavorited ? L.favorited : L.favorite) + ' (' + data.favoritesCount + ')'
      }
      return
    }
    // handle posting comment to article
    if (/\/article\/[^/]+\/comments$/.test(action)) {
      const card = form.closest('.card')
      if (card) {
        const h3 = card.querySelector('h3')
        if (h3 && typeof data.comment !== 'undefined') {
          const m = h3.textContent.match(/\d+/)
          const n = m ? (parseInt(m[0],10) + 1) : 1
          h3.textContent = L.comment + ' (' + n + ')'
          const div = document.createElement('div')
          div.style.borderTop = '1px solid #eee'
          div.style.padding = '8px 0'
          div.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><strong>' + (data.comment.authorNickname||'匿名') + '</strong> <small style="color:#666">' + (new Date(data.comment.createdAt).toLocaleString()) + '</small></div>' + '<div style="margin-top:6px">' + (data.comment.text) + '</div>' + '<div style="margin-top:6px"><form action="/comment/' + data.comment._id + '/like" method="POST" style="display:inline"><button class="btn" type="submit">' + L.like + ' (0)</button></form></div>'
          card.appendChild(div)
          const ta = form.querySelector('textarea')
          if (ta) ta.value = ''
        }
      }
      return
    }

    // handle posting comment to an answer
    if (/\/answer\/[^/]+\/comments$/.test(action)) {
      // the form is inside the answer block; append new comment to the form's parent container
      const wrapper = form.parentElement
      if (wrapper && typeof data.comment !== 'undefined') {
        const h4 = wrapper.querySelector('h4')
        if (h4) {
          const m = h4.textContent.match(/\d+/)
          const n = m ? (parseInt(m[0],10) + 1) : 1
          h4.textContent = L.comment + ' (' + n + ')'
        }
        const div = document.createElement('div')
        div.style.borderTop = '1px solid #eee'
        div.style.padding = '8px 0'
        div.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><strong>' + (data.comment.authorNickname||'匿名') + '</strong> <small style="color:#666">' + (new Date(data.comment.createdAt).toLocaleString()) + '</small></div>' + '<div style="margin-top:6px">' + (data.comment.text) + '</div>' + '<div style="margin-top:6px"><form action="/comment/' + data.comment._id + '/like" method="POST" style="display:inline"><button class="btn" type="submit">' + L.like + ' (0)</button></form></div>'
        wrapper.appendChild(div)
        const ta = form.querySelector('textarea')
        if (ta) ta.value = ''
      }
      return
    }
    // handle comment like
    if (/\/comment\/[^/]+\/like$/.test(action)) {
      const btn = form.querySelector('button')
      if (btn && typeof data.likesCount !== 'undefined') {
        btn.textContent = (data.isLiked ? L.liked || '已赞' : L.like || '赞') + ' (' + data.likesCount + ')'
      }
      return
    }

    // handle answer like
    if (/\/answer\/[^/]+\/like$/.test(action)) {
      const btn = form.querySelector('button')
      if (btn && typeof data.likesCount !== 'undefined') {
        btn.textContent = (data.isLiked ? L.liked : L.like) + ' (' + data.likesCount + ')'
      }
      return
    }

    // handle answer favorite
    if (/\/answer\/[^/]+\/favorite$/.test(action)) {
      const btn = form.querySelector('button')
      if (btn && typeof data.favoritesCount !== 'undefined') {
        btn.textContent = (data.isFavorited ? L.favorited : L.favorite) + ' (' + data.favoritesCount + ')'
      }
      return
    }
  } catch (err) {
    console.error('AJAX error', err)
    form.submit()
  }
})
