// ⚔️ 迷你多人RTS - 优化版前端
// ⚙️ 配置：修改 SERVER_URL 为你的后端地址（留空则连接到当前域名）
const SERVER_URL = ''; // 例如: 'https://mini-rts.onrender.com'

class MiniRTS {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.socket = null;

        // 游戏状态
        this.playerId = null;
        this.gameState = 'lobby';
        this.resources = { gold: 100, wood: 100 };
        this.buildings = [];
        this.units = [];
        this.selectedUnits = [];
        this.resourceSpots = [];

        // 地图与相机
        this.map = { width: 2000, height: 1500 };
        this.camera = { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragCurrent = { x: 0, y: 0 };

        // 建造/训练选择
        this.buildType = null;
        this.trainType = null;
        this.hoverPos = null;

        // 性能优化
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;

        // 视觉效果
        this.particles = [];
        this.floatingTexts = [];

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // 连接服务器
        this.connect();

        // UI事件
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('connectingOverlay')?.classList.remove('hidden');

        // 建造按钮
        document.querySelectorAll('.build').forEach(btn => {
            btn.addEventListener('click', () => {
                this.buildType = btn.dataset.type;
                this.trainType = null;
                this.updateButtons();
                this.updateSelectedButtons();
            });
        });

        // 训练按钮
        document.querySelectorAll('.train').forEach(btn => {
            btn.addEventListener('click', () => {
                this.trainType = btn.dataset.type;
                this.buildType = null;
                this.updateButtons();
                this.updateSelectedButtons();
            });
        });

        // 画布交互
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // 触摸支持
        this.setupTouchEvents();

        // 键盘快捷键
        this.setupKeyboard();

        this.gameLoop();
    }

    setupTouchEvents() {
        let lastTouchTime = 0;
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const now = Date.now();
            if (now - lastTouchTime < 300) {
                // 双击
                this.onDoubleClick({ clientX: touch.clientX, clientY: touch.clientY });
            } else {
                this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
            }
            lastTouchTime = now;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });

        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.onMouseUp({});
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                this.buildType = null;
                this.trainType = null;
                this.selectedUnits = [];
                this.updateButtons();
                this.updateSelectedButtons();
            }
            if (e.key === 'Enter' && this.gameState === 'lobby') {
                this.startGame();
            }
        });
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.canvas.width = width;
        this.canvas.height = height;

        // 高清屏支持
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    connect() {
        this.socket = io(SERVER_URL || undefined, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            document.getElementById('playerId').textContent = this.playerId.substring(0, 8);
            this.updateStatus('connected');
            document.getElementById('connectingOverlay')?.classList.add('hidden');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('disconnected');
            document.getElementById('connectingOverlay')?.classList.remove('hidden');
        });

        this.socket.on('state', (state) => {
            this.resources = state.resources || this.resources;
            this.buildings = state.buildings || [];
            this.units = state.units || [];
            this.resourceSpots = state.resources || [];
            this.updateUI();
        });

        this.socket.on('gameOver', (data) => {
            if (data.winner === this.playerId) {
                this.showGameOver(true);
            } else {
                this.showGameOver(false);
            }
        });

        this.socket.on('playerJoined', (data) => {
            this.addFloatingText('玩家加入', '#667eea');
        });
    }

    updateStatus(status) {
        const el = document.getElementById('status');
        const dot = el.querySelector('.dot');
        const text = el.querySelector('.text');

        el.className = `status ${status}`;
        text.textContent = status === 'connected' ? '已连接' :
                          status === 'connecting' ? '连接中...' : '未连接';

        if (dot) {
            dot.style.animation = status === 'connected' ? 'none' : 'pulse 1.5s infinite';
        }
    }

    startGame() {
        if (!this.playerId) {
            alert('等待连接服务器...');
            return;
        }
        this.gameState = 'playing';
        this.socket.emit('start');
        this.addFloatingText('游戏开始！', '#48bb78');
    }

    restart() {
        this.gameState = 'lobby';
        this.selectedUnits = [];
        this.buildType = null;
        this.trainType = null;
        this.socket.emit('restart');
        this.hideGameOver();
        this.updateButtons();
        this.updateSelectedButtons();
    }

    getWorldPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
            x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }

    onClick(e) {
        if (this.gameState !== 'playing') return;
        const pos = this.getWorldPos(e);

        if (this.buildType) {
            this.socket.emit('build', { type: this.buildType, x: pos.x, y: pos.y });
            this.createParticles(pos.x, pos.y, '#667eea', 5);
            this.buildType = null;
            this.updateButtons();
            this.updateSelectedButtons();
        } else if (this.trainType) {
            const barracks = this.buildings.find(b => b.type === 'barracks' && b.playerId === this.playerId);
            if (barracks) {
                this.socket.emit('train', { type: this.trainType, buildingId: barracks.id });
                this.createParticles(barracks.x, barracks.y, '#48bb78', 8);
                this.trainType = null;
                this.updateButtons();
                this.updateSelectedButtons();
            } else {
                this.addFloatingText('需要兵营', '#f56565', pos.x, pos.y);
            }
        } else {
            // 选择单位
            this.socket.emit('select', { x: pos.x, y: pos.y, radius: 25 });
        }
    }

    onDoubleClick(e) {
        if (this.gameState !== 'playing') return;
        const pos = this.getWorldPos(e);
        // 双击快速移动到位置
        this.socket.emit('move', { x: pos.x, y: pos.y });
    }

    onMouseDown(e) {
        if (e.button === 0) { // 左键拖拽地图
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragCurrent = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        } else if (e.button === 2) { // 右键移动/攻击
            const pos = this.getWorldPos(e);
            if (this.selectedUnits.length > 0) {
                this.socket.emit('move', { x: pos.x, y: pos.y });
                this.createParticles(pos.x, pos.y, '#fff', 3);
            }
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.dragCurrent.x;
            const dy = e.clientY - this.dragCurrent.y;
            this.camera.targetX += dx;
            this.camera.targetY += dy;
            this.dragCurrent = { x: e.clientX, y: e.clientY };
        } else {
            // 更新悬停位置（用于建造预览）
            const pos = this.getWorldPos(e);
            this.hoverPos = pos;
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }

    onWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const newZoom = Math.max(0.5, Math.min(2, this.camera.zoom - e.deltaY * zoomSpeed));
        this.camera.zoom = newZoom;
    }

    updateUI() {
        document.getElementById('gold').textContent = Math.floor(this.resources.gold);
        document.getElementById('wood').textContent = Math.floor(this.resources.wood);
    }

    updateButtons() {
        document.querySelectorAll('.build, .train').forEach(btn => {
            const costGold = parseInt(btn.dataset.gold);
            const costWood = parseInt(btn.dataset.wood);
            btn.disabled = this.resources.gold < costGold || this.resources.wood < costWood;
        });
    }

    updateSelectedButtons() {
        document.querySelectorAll('.build, .train').forEach(btn => {
            btn.classList.remove('selected');
        });

        if (this.buildType) {
            document.querySelector(`.build[data-type="${this.buildType}"]`)?.classList.add('selected');
        }
        if (this.trainType) {
            document.querySelector(`.train[data-type="${this.trainType}"]`)?.classList.add('selected');
        }
    }

    showGameOver(win) {
        const icon = document.getElementById('gameOverIcon');
        const title = document.getElementById('gameOverTitle');
        const text = document.getElementById('gameOverText');

        if (win) {
            icon.textContent = '🏆';
            title.textContent = '🎉 胜利！';
            text.textContent = '你成功摧毁了敌方基地！';
        } else {
            icon.textContent = '💀';
            title.textContent = '😢 失败';
            text.textContent = '你的基地被摧毁了...';
        }

        document.getElementById('gameOver').classList.remove('hidden');
    }

    hideGameOver() {
        document.getElementById('gameOver').classList.add('hidden');
    }

    // 粒子效果
    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1,
                color,
                size: Math.random() * 4 + 2
            });
        }
    }

    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt * 2;
            p.vy += 0.1; // 重力
            return p.life > 0;
        });
    }

    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    // 浮动文字
    addFloatingText(text, color, x = null, y = null) {
        this.floatingTexts.push({
            text,
            color,
            x: x || this.canvas.width / 2,
            y: y || this.canvas.height / 2,
            life: 1,
            vy: -1
        });
    }

    updateFloatingTexts(dt) {
        this.floatingTexts = this.floatingTexts.filter(t => {
            t.y += t.vy;
            t.life -= dt * 1.5;
            return t.life > 0;
        });
    }

    drawFloatingTexts() {
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.floatingTexts.forEach(t => {
            this.ctx.globalAlpha = t.life;
            this.ctx.fillStyle = t.color;
            this.ctx.fillText(t.text, t.x, t.y);
        });
        this.ctx.globalAlpha = 1;
    }

    // 平滑相机
    updateCamera() {
        const smoothing = 0.1;
        this.camera.x += (this.camera.targetX - this.camera.x) * smoothing;
        this.camera.y += (this.camera.targetY - this.camera.y) * smoothing;

        // 限制相机范围
        const viewW = this.canvas.width / this.camera.zoom;
        const viewH = this.canvas.height / this.camera.zoom;
        this.camera.targetX = Math.max(0, Math.min(this.map.width - viewW, this.camera.targetX));
        this.camera.targetY = Math.max(0, Math.min(this.map.height - viewH, this.camera.targetY));
        this.camera.x = Math.max(0, Math.min(this.map.width - viewW, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.map.height - viewH, this.camera.y));
    }

    gameLoop(timestamp = 0) {
        const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1) || 0.016;
        this.lastFrameTime = timestamp;

        // FPS计算
        this.frameCount++;
        if (timestamp - this.fpsUpdateTime > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = timestamp;
        }

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
        this.updateCamera();
        this.updateParticles(dt);
        this.updateFloatingTexts(dt);
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 绘制背景
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, width, height);

        // 保存状态，应用相机变换
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // 绘制地图边界
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.map.width, this.map.height);

        // 绘制网格
        this.drawGrid();

        // 绘制资源点
        this.drawResourceSpots();

        // 绘制建筑
        this.drawBuildings();

        // 绘制单位
        this.drawUnits();

        // 绘制建造预览
        if (this.buildType && this.hoverPos) {
            this.drawBuildPreview();
        }

        // 绘制选择框
        if (this.selectedUnits.length > 0) {
            this.drawSelection();
        }

        ctx.restore();

        // 绘制粒子（不受相机影响）
        this.drawParticles();

        // 绘制浮动文字
        this.drawFloatingTexts();

        // 绘制FPS（调试用）
        // this.drawDebug();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;

        const gridSize = 50;
        for (let x = 0; x <= this.map.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.map.height);
            ctx.stroke();
        }
        for (let y = 0; y <= this.map.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.map.width, y);
            ctx.stroke();
        }
    }

    drawResourceSpots() {
        const ctx = this.ctx;
        this.resourceSpots.forEach(spot => {
            const color = spot.type === 'gold' ? '#f6e05e' : '#b7791f';
            const icon = spot.type === 'gold' ? '💰' : '🪵';

            // 光晕效果
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, spot.x, spot.y);
        });
    }

    drawBuildings() {
        const ctx = this.ctx;
        this.buildings.forEach(b => {
            const isMine = b.playerId === this.playerId;
            const color = isMine ? '#48bb78' : '#f56565';
            const size = b.type === 'base' ? 60 : b.type === 'gold-mine' || b.type === 'lumber-camp' ? 45 : 50;

            // 阴影
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            // 建筑主体
            ctx.fillStyle = color;
            ctx.fillRect(b.x - size/2, b.y - size/2, size, size);

            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // 边框
            ctx.strokeStyle = isMine ? '#68d391' : '#fc8181';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x - size/2, b.y - size/2, size, size);

            // 图标
            ctx.fillStyle = '#fff';
            ctx.font = `${size * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = b.type === 'base' ? '🏛️' : b.type === 'barracks' ? '🏚️' : b.type === 'gold-mine' ? '⛏️' : '🪓';
            ctx.fillText(icon, b.x, b.y);

            // 血条
            const hpPercent = b.health / b.maxHealth;
            const barWidth = size * 0.8;
            const barHeight = 6;
            const barX = b.x - barWidth/2;
            const barY = b.y - size/2 - 12;

            ctx.fillStyle = '#1a202c';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = hpPercent > 0.5 ? '#48bb78' : hpPercent > 0.25 ? '#ed8936' : '#f56565';
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        });
    }

    drawUnits() {
        const ctx = this.ctx;
        this.units.forEach(u => {
            const isMine = u.playerId === this.playerId;
            const color = isMine ? '#68d391' : '#fc8181';
            const radius = u.type === 'soldier' ? 10 : 7;

            // 阴影
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(u.x, u.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // 边框
            ctx.strokeStyle = isMine ? '#9ae6b4' : '#feb2b2';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 图标
            ctx.fillStyle = '#fff';
            ctx.font = `${radius * 1.8}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = u.type === 'soldier' ? '⚔️' : '👷';
            ctx.fillText(icon, u.x, u.y);

            // 选中指示器
            if (isMine && this.selectedUnits.some(s => s.id === u.id)) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(u.x, u.y, radius + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }

    drawBuildPreview() {
        const ctx = this.ctx;
        const size = this.buildType === 'base' ? 60 : this.buildType === 'gold-mine' || this.buildType === 'lumber-camp' ? 45 : 50;

        ctx.strokeStyle = '#48bb78';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.hoverPos.x - size/2, this.hoverPos.y - size/2, size, size);
        ctx.setLineDash([]);

        // 半透明填充
        ctx.fillStyle = 'rgba(72, 187, 120, 0.2)';
        ctx.fillRect(this.hoverPos.x - size/2, this.hoverPos.y - size/2, size, size);
    }

    drawSelection() {
        const ctx = this.ctx;
        // 可以绘制框选矩形
    }

    drawDebug() {
        const ctx = this.ctx;
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${this.fps}`, 10, 20);
        ctx.fillText(`Units: ${this.units.length}`, 10, 35);
        ctx.fillText(`Buildings: ${this.buildings.length}`, 10, 50);
        ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`, 10, 65);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new MiniRTS();
});