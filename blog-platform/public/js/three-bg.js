// 简单的 three.js 点云背景
(function(){
    if (typeof THREE === 'undefined') return console.warn('three.js 未加载')

    const canvas = document.createElement('canvas')
    canvas.id = 'bgCanvas'
    canvas.style.opacity = 0
    canvas.style.transition = 'opacity 720ms ease'
    document.body.appendChild(canvas)

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0) // 透明背景

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 120

    // 粒子点云
    const particleCount = 800
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        const r = 60 + Math.random() * 80
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos((Math.random() * 2) - 1)
        positions[i3 + 0] = r * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = r * Math.cos(phi)

        // 颜色渐变：蓝->紫->粉
        const t = Math.random()
        // 整体调暗 60%
        colors[i3 + 0] = (0.5 + 0.5 * t) * 0.4
        colors[i3 + 1] = (0.2 + 0.6 * (1 - t)) * 0.4
        colors[i3 + 2] = 0.8 * 0.4
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({ size: 2.4, vertexColors: true, opacity: 0.4, transparent: true, depthWrite: false })
    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // 轻微环境光，整体变亮
    const ambient = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(ambient)

    let last = performance.now()
    let firstFrame = true
    function animate(t){
        const dt = (t - last) * 0.001
        last = t

        // 极缓慢旋转点云
        points.rotation.y += 0.0015 * dt * 60
        points.rotation.x += 0.0008 * dt * 60

        renderer.render(scene, camera)
        if (firstFrame) {
            firstFrame = false
            // 平滑显示画布以避免白屏闪烁
            canvas.style.opacity = 1
            // 把页面内容淡入
            requestAnimationFrame(()=> document.body.classList.add('ready'))
        }
        requestAnimationFrame(animate)
    }

    function onResize(){
        const w = window.innerWidth, h = window.innerHeight
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', onResize, { passive: true })

    // 动态降低渲染负担（页面不可见时暂停）
    let rafId = null
    function start(){
        if (!rafId) rafId = requestAnimationFrame(function step(t){ rafId = null; animate(t) })
    }
    function stop(){
        if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    }

    document.addEventListener('visibilitychange', ()=>{
        if (document.hidden) stop(); else start()
    })

    // 初始启动
    onResize()
    start()
})();
