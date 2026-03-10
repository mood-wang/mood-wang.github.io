// 核心配置与全局变量  
const config = {
    canvas: document.getElementById('interactiveCanvas'),
    ctx: null,
    width: 800,
    height: 600,
    particles: [],
    props: [], // 新增：道具数组
    catcher: null, // 新增：捕手对象
    mode: 'game', // 默认为游戏模式 particle/audio/draw/game
    audioContext: null,
    analyser: null,
    microphone: null,
    isDrawing: false,
    lastPos: { x: 0, y: 0 },
    // 游戏配置（新增）
    game: {
        score: 0,
        life: 3,
        level: 1,
        isPlaying: false,
        particleSpeed: 2,
        poisonRatio: 10, // 毒粒子占比（%）
        propRate: 30, // 道具刷新时间（秒）
        lastPropTime: 0 // 上一次道具刷新时间
    },
    // 交互参数
    params: {
        particleCount: 200,
        particleSize: 6,
        gravity: 0.05,
        bounce: 0.8,
        audioBars: 32,
        audioHeight: 200,
        brushSize: 5,
        brushColor: '#38bdf8'
    },
    animationId: null
};

// 初始化画布
function initCanvas() {
    config.ctx = config.canvas.getContext('2d');
    // 适配高清屏
    const dpr = window.devicePixelRatio || 1;
    config.canvas.width = config.width * dpr;
    config.canvas.height = config.height * dpr;
    config.ctx.scale(dpr, dpr);
    config.width = config.canvas.width / dpr;
    config.height = config.canvas.height / dpr;
    
    // 初始化捕手（新增）
    initCatcher();
    // 初始化粒子
    initParticles();
    // 绑定事件
    bindEvents();
    // 启动动画循环
    animate();
}

// 新增：捕手类（玩家控制）
class Catcher {
    constructor() {
        this.x = config.width / 2;
        this.y = config.height / 2;
        this.radius = 15; // 捕手半径（碰撞检测用）
        this.color = '#38bdf8';
        this.shield = false; // 护盾状态（道具效果）
        this.shieldTime = 0; // 护盾剩余时间（帧）
    }

    // 更新捕手位置（跟随鼠标/触摸）
    update(x, y) {
        this.x = x;
        this.y = y;
        // 护盾时间倒计时
        if (this.shield) {
            this.shieldTime--;
            if (this.shieldTime <= 0) {
                this.shield = false;
                this.shieldTime = 0;
            }
        }
    }

    // 绘制捕手（数媒风格，带护盾效果）
    draw() {
        config.ctx.save();
        
        // 护盾效果（半透明光环）
        if (this.shield) {
            config.ctx.beginPath();
            config.ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            const gradient = config.ctx.createRadialGradient(
                this.x, this.y, this.radius,
                this.x, this.y, this.radius + 10
            );
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
            config.ctx.fillStyle = gradient;
            config.ctx.fill();
        }
        
        // 捕手主体
        config.ctx.beginPath();
        config.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        config.ctx.fillStyle = this.color;
        config.ctx.fill();
        // 捕手边框
        config.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        config.ctx.lineWidth = 2;
        config.ctx.stroke();
        // 捕手中心白点
        config.ctx.beginPath();
        config.ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        config.ctx.fillStyle = 'white';
        config.ctx.fill();
        
        config.ctx.restore();
    }
}

// 新增：粒子类升级（区分普通粒子/毒粒子/特殊粒子）
class Particle {
    constructor(x, y, type = 'normal') {
        this.x = x || Math.random() * config.width;
        this.y = y || Math.random() * config.height;
        // 粒子速度（随关卡提升）
        const speed = config.game.particleSpeed * (0.8 + Math.random() * 0.4);
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        if (type === 'poison') {
            this.size = Math.random() * 4 + 6; // 毒粒子：6~10（更大，更醒目）
        } else if (type === 'special') {
            this.size = Math.random() * 3 + 8; // 特殊粒子：8~11（五角星更显眼）
        } else {
            this.size = Math.random() * config.params.particleSize + 4; // 普通粒子：4~14（原2~13）
        }
        // 粒子类型：normal（普通）/poison（毒）/special（特殊）
        this.type = type;
        // 颜色区分
        this.color = this.getTypeColor();
        this.alpha = Math.random() * 0.8 + 0.2;
    }

    // 根据类型获取颜色（数媒风格配色）
    getTypeColor() {
        const normalColors = [
            '#38bdf8', '#a78bfa', '#f472b6', '#22c55e', 
            '#f97316', '#8b5cf6', '#ec4899', '#10b981'
        ];
        switch (this.type) {
            case 'poison':
                return '#991b1b'; // 黑色毒粒子
            case 'special':
                return '#fde047'; // 黄色特殊粒子（加分）
            default:
                return normalColors[Math.floor(Math.random() * normalColors.length)];
        }
    }

    // 物理运动更新（随游戏参数调整）
    update() {
        // 边界碰撞（弹性）
        if (this.x < 0 || this.x > config.width) this.vx = -this.vx;
        if (this.y < 0 || this.y > config.height) this.vy = -this.vy;

        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
    }

    // 绘制粒子
    draw() {
        config.ctx.save();
        config.ctx.globalAlpha = this.alpha;
        config.ctx.fillStyle = this.color;
        config.ctx.beginPath();
        // 特殊粒子绘制五角星（新增，提升数媒视觉效果）
        if (this.type === 'special') {
            this.drawStar(this.x, this.y, this.size, this.size/2, 5);
        } else {
            config.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        }
        config.ctx.fill();
        config.ctx.restore();
    }

    // 新增：绘制五角星（数媒视觉增强）
    drawStar(x, y, outerRadius, innerRadius, points) {
        config.ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            i === 0 ? config.ctx.moveTo(px, py) : config.ctx.lineTo(px, py);
        }
        config.ctx.closePath();
    }
}

// 新增：道具类（3种道具，提升游戏趣味性）
class Prop {
    constructor() {
        this.x = Math.random() * config.width;
        this.y = Math.random() * config.height;
        this.size = 15;
        // 道具类型：slow（减速）/shield（护盾）/score（加分）
        this.type = ['slow', 'shield', 'score'][Math.floor(Math.random() * 3)];
        this.color = this.getTypeColor();
        this.alpha = 1;
        this.pulse = 0; // 呼吸动画效果
    }

    getTypeColor() {
        switch (this.type) {
            case 'slow':
                return '#38bdf8'; // 蓝色：减速
            case 'shield':
                return '#a78bfa'; // 紫色：护盾
            case 'score':
                return '#22c55e'; // 绿色：加分
        }
    }

    // 道具呼吸动画
    update() {
        this.pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
        this.alpha = this.pulse;
    }

    // 绘制道具（带呼吸效果）
    draw() {
        config.ctx.save();
        config.ctx.globalAlpha = this.alpha;
        config.ctx.fillStyle = this.color;
        // 不同道具绘制不同形状
        if (this.type === 'slow') {
            // 减速道具：圆形
            config.ctx.beginPath();
            config.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        } else if (this.type === 'shield') {
            // 护盾道具：正方形
            config.ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        } else {
            // 加分道具：三角形
            config.ctx.beginPath();
            config.ctx.moveTo(this.x, this.y - this.size);
            config.ctx.lineTo(this.x - this.size, this.y + this.size);
            config.ctx.lineTo(this.x + this.size, this.y + this.size);
            config.ctx.closePath();
        }
        config.ctx.fill();
        // 道具边框
        config.ctx.strokeStyle = 'white';
        config.ctx.lineWidth = 1;
        config.ctx.stroke();
        config.ctx.restore();
    }
}

// 初始化捕手（新增）
function initCatcher() {
    config.catcher = new Catcher();
}

// 初始化粒子系统（升级：按比例生成毒粒子/特殊粒子）
function initParticles() {
    config.particles = [];
    const total = config.params.particleCount;
    const poisonCount = Math.floor(total * (config.game.poisonRatio / 100));
    const specialCount = Math.floor(total * 0.05); // 5%特殊粒子
    const normalCount = total - poisonCount - specialCount;

    const gridSize = Math.ceil(Math.sqrt(total)); // 网格行数/列数
    const stepX = config.width / (gridSize + 1);  // X轴间距
    const stepY = config.height / (gridSize + 1); // Y轴间距
    let gridIndex = 0;

    // 生成普通粒子
    for (let i = 0; i < normalCount; i++) {
        // 网格坐标 + 随机偏移（避免完全对齐）
        const x = stepX * ((gridIndex % gridSize) + 1) + (Math.random() - 0.5) * stepX;
        const y = stepY * (Math.floor(gridIndex / gridSize) + 1) + (Math.random() - 0.5) * stepY;
        config.particles.push(new Particle(x, y));
        gridIndex++;
    }
    // 生成毒粒子
    for (let i = 0; i < poisonCount; i++) {
        const x = stepX * ((gridIndex % gridSize) + 1) + (Math.random() - 0.5) * stepX;
        const y = stepY * (Math.floor(gridIndex / gridSize) + 1) + (Math.random() - 0.5) * stepY;
        config.particles.push(new Particle(x, y, 'poison'));
        gridIndex++;
    }
    // 生成特殊粒子
    for (let i = 0; i < specialCount; i++) {
        const x = stepX * ((gridIndex % gridSize) + 1) + (Math.random() - 0.5) * stepX;
        const y = stepY * (Math.floor(gridIndex / gridSize) + 1) + (Math.random() - 0.5) * stepY;
        config.particles.push(new Particle(x, y, 'special'));
        gridIndex++;
    }
}

// 音频可视化初始化（保留）
async function initAudio() {
    try {
        config.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        config.analyser = config.audioContext.createAnalyser();
        config.analyser.fftSize = 2048;
        
        // 获取麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        config.microphone = config.audioContext.createMediaStreamSource(stream);
        config.microphone.connect(config.analyser);
        
        return true;
    } catch (err) {
        alert('麦克风权限获取失败：' + err.message);
        return false;
    }
}

// 绘制音频可视化（保留）
function drawAudioVisualizer() {
    if (!config.analyser) return;
    
    const bufferLength = config.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    config.analyser.getByteFrequencyData(dataArray);
    
    const barWidth = config.width / config.params.audioBars;
    const barGap = barWidth * 0.1;
    const usableWidth = barWidth - barGap;

    config.ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
    config.ctx.fillRect(0, 0, config.width, config.height);

    // 绘制频谱柱
    for (let i = 0; i < config.params.audioBars; i++) {
        const value = dataArray[i * (bufferLength / config.params.audioBars)];
        const barHeight = (value / 255) * config.params.audioHeight;
        
        // 渐变颜色
        const gradient = config.ctx.createLinearGradient(0, config.height - barHeight, 0, config.height);
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(1, '#a78bfa');
        
        config.ctx.fillStyle = gradient;
        config.ctx.fillRect(
            i * barWidth + barGap/2,
            config.height - barHeight,
            usableWidth,
            barHeight
        );
        
        // 绘制频谱轮廓
        config.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        config.ctx.lineWidth = 1;
        config.ctx.strokeRect(
            i * barWidth + barGap/2,
            config.height - barHeight,
            usableWidth,
            barHeight
        );
    }
}

// 手绘模式绘制（保留）
function drawBrush(e) {
    if (!config.isDrawing) return;
    
    const pos = getCanvasPos(e);
    config.ctx.save();
    config.ctx.lineWidth = config.params.brushSize;
    config.ctx.lineCap = 'round';
    config.ctx.lineJoin = 'round';
    config.ctx.strokeStyle = config.params.brushColor;
    
    config.ctx.beginPath();
    config.ctx.moveTo(config.lastPos.x, config.lastPos.y);
    config.ctx.lineTo(pos.x, pos.y);
    config.ctx.stroke();
    config.ctx.restore();
    
    config.lastPos = pos;
}

// 获取画布坐标（兼容鼠标/触摸，保留）
function getCanvasPos(e) {
    const rect = config.canvas.getBoundingClientRect();
    let x, y;
    
    if (e.type.includes('touch')) {
        e.preventDefault();
        x = (e.touches[0].clientX - rect.left) * (config.width / rect.width);
        y = (e.touches[0].clientY - rect.top) * (config.height / rect.height);
    } else {
        x = (e.clientX - rect.left) * (config.width / rect.width);
        y = (e.clientY - rect.top) * (config.height / rect.height);
    }
    
    return { x, y };
}

// 保存画布截图（保留）
function saveCanvas() {
    const link = document.createElement('a');
    link.download = `粒子捕手_${new Date().getTime()}.png`;
    link.href = config.canvas.toDataURL('image/png');
    link.click();
}

// 切换交互模式（升级：新增游戏模式切换）
function switchMode(mode) {
    config.mode = mode;
    // 停止游戏（切换非游戏模式时）
    if (mode !== 'game') {
        config.game.isPlaying = false;
        document.getElementById('startGame').textContent = '开始游戏';
    }
    
    // 隐藏所有控制面板
    document.querySelectorAll('.control-group[id$="-controls"]').forEach(el => {
        el.style.display = 'none';
    });
    // 显示当前模式面板
    document.getElementById(`${mode}-controls`).style.display = 'block';
    
    // 激活模式标签
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // 音频模式特殊处理
    if (mode === 'audio' && !config.analyser) {
        document.getElementById('startAudio').click();
    }
    
    // 重置画布
    clearCanvas();
}

// 清空画布（保留）
function clearCanvas() {
    config.ctx.clearRect(0, 0, config.width, config.height);
    config.ctx.fillStyle = '#2d3748';
    config.ctx.fillRect(0, 0, config.width, config.height);
}

// 重置画布（恢复初始状态，升级：重置游戏参数）
function resetCanvas() {
    clearCanvas();
    // 重置游戏相关
    if (config.mode === 'game') {
        config.game.score = 0;
        config.game.life = 3;
        config.game.level = 1;
        config.game.particleSpeed = 2;
        config.game.poisonRatio = 10;
        document.getElementById('score').textContent = 0;
        document.getElementById('life').textContent = 3;
        document.getElementById('level').textContent = 1;
        initParticles();
        config.props = [];
    } else if (config.mode === 'particle') {
        initParticles();
    }
}

// 新增：游戏核心逻辑 - 碰撞检测（捕手与粒子/道具）
function checkCollision() {
    if (!config.game.isPlaying) return;
    
    const catcher = config.catcher;
    
    // 1. 捕手与粒子碰撞
    config.particles = config.particles.filter(particle => {
        const dx = catcher.x - particle.x;
        const dy = catcher.y - particle.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // 碰撞判定：捕手半径 + 粒子半径
        if (distance < catcher.radius + particle.size + 2) {
            switch (particle.type) {
                case 'normal':
                    // 普通粒子：加分
                    config.game.score += 10;
                    break;
                case 'special':
                    // 特殊粒子：加30分
                    config.game.score += 30;
                    break;
                case 'poison':
                    // 毒粒子：扣生命（护盾状态免疫）
                    if (!catcher.shield) {
                        config.game.life--;
                        // 生命为0，游戏结束
                        if (config.game.life <= 0) {
                            gameOver();
                        }
                    }
                    break;
            }
            // 更新得分显示
            document.getElementById('score').textContent = config.game.score;
            document.getElementById('life').textContent = config.game.life;
            // 碰撞后移除粒子，生成新粒子
            return false;
        }
        return true;
    });
    
    // 补充粒子（保持总数不变）
    while (config.particles.length < config.params.particleCount) {
        const type = Math.random() * 100 < config.game.poisonRatio ? 'poison' : 
                     Math.random() * 100 < 5 ? 'special' : 'normal';
        config.particles.push(new Particle());
    }
    
    // 2. 捕手与道具碰撞
    config.props = config.props.filter(prop => {
        const dx = catcher.x - prop.x;
        const dy = catcher.y - prop.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < catcher.radius + prop.size/2) {
            // 道具效果
            switch (prop.type) {
                case 'slow':
                    // 减速：粒子速度降低50%，持续5秒
                    config.game.particleSpeed *= 0.5;
                    setTimeout(() => {
                        config.game.particleSpeed *= 2;
                    }, 5000);
                    break;
                case 'shield':
                    // 护盾：持续3秒
                    catcher.shield = true;
                    catcher.shieldTime = 3 * 60; // 3秒 = 180帧
                    break;
                case 'score':
                    // 加分：直接加50分
                    config.game.score += 50;
                    document.getElementById('score').textContent = config.game.score;
                    break;
            }
            return false;
        }
        return true;
    });
    
    // 关卡升级：每1000分升一级
    const newLevel = Math.floor(config.game.score / 1000) + 1;
    if (newLevel > config.game.level) {
        config.game.level = newLevel;
        // 难度提升：粒子速度+0.5，毒粒子占比+5%
        config.game.particleSpeed += 0.5;
        config.game.poisonRatio = Math.min(30, config.game.poisonRatio + 5);
        // 更新关卡显示
        document.getElementById('level').textContent = config.game.level;
        // 更新控制面板参数
        document.getElementById('particleSpeed').value = config.game.particleSpeed;
        document.getElementById('speedValue').value = config.game.particleSpeed;
        document.getElementById('poisonRatio').value = config.game.poisonRatio;
        document.getElementById('ratioValue').value = config.game.poisonRatio;
        // 重新生成粒子（适应新难度）
        initParticles();
    }
}

// 新增：道具刷新逻辑
function spawnProp() {
    if (!config.game.isPlaying) return;
    
    const now = Date.now() / 1000; // 当前时间（秒）
    // 达到刷新时间，生成新道具
    if (now - config.game.lastPropTime >= config.game.propRate) {
        config.props.push(new Prop());
        config.game.lastPropTime = now;
    }
}

// 新增：游戏开始
function startGame() {
    if (config.game.isPlaying) {
        // 暂停游戏
        config.game.isPlaying = false;
        document.getElementById('startGame').textContent = '继续游戏';
    } else {
        // 开始/继续游戏
        config.game.isPlaying = true;
        document.getElementById('startGame').textContent = '暂停游戏';
        // 记录道具刷新时间
        config.game.lastPropTime = Date.now() / 1000;
    }
}

// 新增：游戏结束
function gameOver() {
    config.game.isPlaying = false;
    document.getElementById('startGame').textContent = '开始游戏';
    // 显示游戏结束弹窗
    document.getElementById('finalScore').textContent = config.game.score;
    document.getElementById('finalLevel').textContent = config.game.level;
    document.getElementById('gameOver').style.display = 'flex';
}

// 新增：重新开始游戏
function restartGame() {
    resetCanvas();
    document.getElementById('gameOver').style.display = 'none';
    startGame();
}

// 新增：退出游戏
function exitGame() {
    resetCanvas();
    document.getElementById('gameOver').style.display = 'none';
}

// 动画循环（升级：新增游戏逻辑渲染）
function animate() {
    // 清画布（半透明叠加，产生拖影效果）
    config.ctx.fillStyle = 'rgba(26, 26, 46, 0.02)';
    config.ctx.fillRect(0, 0, config.width, config.height);
    
    // 根据模式渲染
    switch (config.mode) {
        case 'particle':
            config.particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            break;
        case 'audio':
            drawAudioVisualizer();
            break;
        case 'draw':
            // 手绘模式仅在绘制时更新，这里保持画布
            break;
        case 'game':
            // 游戏模式：渲染捕手、粒子、道具
            if (config.game.isPlaying) {
                // 碰撞检测
                checkCollision();
                // 道具刷新
                spawnProp();
                // 更新道具
                config.props.forEach(prop => {
                    prop.update();
                    prop.draw();
                });
            }
            // 绘制粒子
            config.particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            // 绘制捕手
            config.catcher.draw();
            break;
    }
    
    config.animationId = requestAnimationFrame(animate);
}

// 绑定所有交互事件（升级：新增游戏相关事件）
function bindEvents() {
    // 鼠标/触摸位置跟踪（控制捕手）
    config.canvas.addEventListener('mousemove', (e) => {
        const pos = getCanvasPos(e);
        if (config.mode === 'game') {
            config.catcher.update(pos.x, pos.y);
        } else {
            config.mouse = pos;
        }
    });
    config.canvas.addEventListener('touchmove', (e) => {
        const pos = getCanvasPos(e);
        if (config.mode === 'game') {
            config.catcher.update(pos.x, pos.y);
        } else {
            config.mouse = pos;
        }
    });

    // 手绘模式事件（保留）
    config.canvas.addEventListener('mousedown', (e) => {
        if (config.mode !== 'draw') return;
        config.isDrawing = true;
        config.lastPos = getCanvasPos(e);
    });
    config.canvas.addEventListener('touchstart', (e) => {
        if (config.mode !== 'draw') return;
        config.isDrawing = true;
        config.lastPos = getCanvasPos(e);
    });
    config.canvas.addEventListener('mousemove', drawBrush);
    config.canvas.addEventListener('touchmove', drawBrush);
    config.canvas.addEventListener('mouseup', () => config.isDrawing = false);
    config.canvas.addEventListener('mouseout', () => config.isDrawing = false);
    config.canvas.addEventListener('touchend', () => config.isDrawing = false);
    config.canvas.addEventListener('touchcancel', () => config.isDrawing = false);

    // 模式切换（保留）
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // 音频启动（保留）
    document.getElementById('startAudio').addEventListener('click', initAudio);

    // 游戏参数控制（新增）
    document.getElementById('particleSpeed').addEventListener('input', (e) => {
        config.game.particleSpeed = parseInt(e.target.value);
    });
    document.getElementById('poisonRatio').addEventListener('input', (e) => {
        config.game.poisonRatio = parseInt(e.target.value);
        initParticles(); // 重新生成粒子，应用新比例
    });
    document.getElementById('propRate').addEventListener('input', (e) => {
        config.game.propRate = parseInt(e.target.value);
    });

    // 粒子参数控制（保留）
    document.getElementById('particleCount').addEventListener('input', (e) => {
        config.params.particleCount = parseInt(e.target.value);
        initParticles();
    });
    document.getElementById('particleSize').addEventListener('input', (e) => {
        config.params.particleSize = parseInt(e.target.value);
    });
    document.getElementById('gravity').addEventListener('input', (e) => {
        config.params.gravity = parseFloat(e.target.value);
    });

    // 音频参数控制（保留）
    document.getElementById('audioBars').addEventListener('input', (e) => {
        config.params.audioBars = parseInt(e.target.value);
    });
    document.getElementById('audioHeight').addEventListener('input', (e) => {
        config.params.audioHeight = parseInt(e.target.value);
    });

    // 手绘参数控制（保留）
    document.getElementById('brushSize').addEventListener('input', (e) => {
        config.params.brushSize = parseInt(e.target.value);
    });
    document.getElementById('brushColor').addEventListener('input', (e) => {
        config.params.brushColor = e.target.value;
    });

    // 功能按钮（保留+新增游戏按钮）
    document.getElementById('saveBtn').addEventListener('click', saveCanvas);
    document.getElementById('resetBtn').addEventListener('click', resetCanvas);
    document.getElementById('clearBtn').addEventListener('click', clearCanvas);
    document.getElementById('startGame').addEventListener('click', startGame);
    document.getElementById('restartGame').addEventListener('click', restartGame);
    document.getElementById('exitGame').addEventListener('click', exitGame);

    // 键盘快捷键（保留+新增游戏快捷键）
    document.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case ' ': // 空格切换模式
                const modes = ['particle', 'audio', 'draw', 'game'];
                const currentIdx = modes.indexOf(config.mode);
                switchMode(modes[(currentIdx + 1) % modes.length]);
                break;
            case 's': // 保存
                saveCanvas();
                break;
            case 'r': // 重置
                resetCanvas();
                break;
            case 'c': // 清空
                clearCanvas();
                break;
            case 'p': // 暂停/开始游戏
                startGame();
                break;
        }
    });

    // 窗口大小适配（保留）
    window.addEventListener('resize', () => {
        cancelAnimationFrame(config.animationId);
        initCanvas();
    });
}

// 页面加载初始化（保留）
window.addEventListener('load', () => {
    initCanvas();
    clearCanvas();
});

// 页面卸载停止动画（保留）
window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(config.animationId);
    if (config.audioContext) {
        config.audioContext.close();
    }
}); 