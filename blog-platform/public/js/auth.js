console.log('auth.js loaded')
document.addEventListener('DOMContentLoaded', function() {
  console.log('auth.js DOMContentLoaded')
  const toggle = document.getElementById('toggle-login-mode')
  const captchaArea = document.getElementById('captcha-area')
  const emailArea = document.getElementById('email-area')
  const sendBtn = document.getElementById('send-code')
  // Only wire login-specific handlers if elements exist
  if (toggle && captchaArea && emailArea) {
    let emailMode = false
    toggle.addEventListener('click', () => {
      emailMode = !emailMode
      captchaArea.style.display = emailMode ? 'none' : ''
      emailArea.style.display = emailMode ? '' : 'none'
      // use dataset labels provided by server-rendered template for localization
      const toEmailLabel = toggle.dataset.emailLabel || toggle.dataset.toEmail || toggle.textContent
      const toCaptchaLabel = toggle.dataset.captchaLabel || toggle.dataset.toCaptcha || toggle.textContent
      toggle.textContent = emailMode ? toCaptchaLabel : toEmailLabel
    })
  }
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      await sendCode('/send-login-code', document.querySelector('#email-area input[name="email"]'), sendBtn)
    })
  }

  // register page send button (if present)
  const sendRegBtn = document.getElementById('send-register-code')
  if (sendRegBtn) {
    sendRegBtn.addEventListener('click', async () => {
      const emailInput = document.querySelector('input[name="email"]')
      await sendCode('/send-register-code', emailInput, sendRegBtn)
    })
  }
  // toggle between email-code and invite-code on register page
  const toggleInvite = document.getElementById('toggle-invite-mode')
  const inviteArea = document.getElementById('invite-area')
  const emailCodeInput = document.getElementById('email-code-input')
  const inviteCodeInput = document.getElementById('invite-code-input')
  let inviteMode = false
  if (toggleInvite && inviteArea && emailCodeInput && inviteCodeInput) {
    // ensure initial required state
    emailCodeInput.required = true
    inviteCodeInput.required = false
    toggleInvite.addEventListener('click', () => {
      inviteMode = !inviteMode
      const sendBtn = document.getElementById('send-register-code')
      const sendLabel = document.getElementById('send-code-label')
      if (inviteMode) {
        // switch to invite mode: hide email inputs and send UI, show invite
        emailCodeInput.style.display = 'none'
        if (sendBtn) sendBtn.style.display = 'none'
        if (sendLabel) sendLabel.style.display = 'none'
        inviteArea.style.display = 'inline-flex'
        emailCodeInput.required = false
        inviteCodeInput.required = true
        // use data attribute label for email-mode text
        toggleInvite.textContent = toggleInvite.dataset.emailLabel || toggleInvite.textContent
      } else {
        emailCodeInput.style.display = ''
        if (sendBtn) sendBtn.style.display = ''
        if (sendLabel) sendLabel.style.display = ''
        inviteArea.style.display = 'none'
        emailCodeInput.required = true
        inviteCodeInput.required = false
        toggleInvite.textContent = toggleInvite.dataset.inviteLabel || toggleInvite.textContent
      }
    })
  }
  
  // helper to send code and show status
  async function sendCode(url, emailInput, button) {
    if (!emailInput) return alert('未找到邮箱输入框')
    const email = emailInput.value && emailInput.value.trim()
    if (!email) return alert('请输入邮箱地址')
    if (button) button.disabled = true
    try {
      console.log('Sending code to', url, email)
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email })
      })
      const j = await resp.json().catch(()=>({ ok:false }))
      console.log('send response', resp.status, j)
      if (resp.ok && j && j.ok) {
        alert('验证码已发送，请查收邮箱')
      } else if (resp.status === 429 && j && j.retryAfterSec) {
        alert('请勿频繁发送，请稍后再试：' + j.retryAfterSec + ' 秒')
        // 禁用按钮并在剩余时间后恢复
        if (button) {
          button.disabled = true
          let left = j.retryAfterSec
          const origText = button.textContent
          button.textContent = `${origText} (${left}s)`
          const iv = setInterval(() => {
            left -= 1
            if (left <= 0) {
              clearInterval(iv)
              button.disabled = false
              button.textContent = origText
            } else {
              button.textContent = `${origText} (${left}s)`
            }
          }, 1000)
        }
      } else {
        alert(j.error || '发送失败')
      }
    } catch (e) {
      console.error('sendCode error', e)
      alert('网络错误，发送失败')
    } finally {
      if (button) button.disabled = false
    }
  }
})
