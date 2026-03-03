// ⚔️ 迷你多人RTS - 优化版前端（支持离线单人模式）
// ⚙️ 配置：修改 SERVER_URL 为你的后端地址（留空则连接到当前域名）
const SERVER_URL = ''; // 例如: 'https://mini-rts.onrender.com'

// 离线游戏逻辑类
class OfflineGame {
    constructor() {
        this.resources = { gold: 100, wood: 100 };
        this.buildings = [];
        this.units = [];
        this.resourceSpots = [];
        this.selectedUnits = [];
        this.started = false;
        this.tick = 0;

        // 初始化基地
        this.initBase();
    }

    initBase() {
        const x = 400;
        const y = 400;
        this.basePos = { x, y }; // 保存基地位置用于相机聚焦
        this.buildings.push({
            id: 'base-1', type: 'base', playerId: 'offline',
            x, y, health: 2000, maxHealth: 2000
        });

        // 初始3个工人
        for (let i = 0; i < 3; i++) {
            this.units.push({
                id: `worker-${i}`, type: 'worker', playerId: 'offline',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                health: 50, maxHealth: 50,
                damage: 5, range: 30, speed: 35, size: 6,
                target: null, state: 'idle', attackCooldown: 0
            });
        }

        // 资源点
        for (let i = 0; i < 6; i++) {
            this.resourceSpots.push({
                id: `gold-${i}`, type: 'gold',
                x: 300 + Math.random() * 800,
                y: 300 + Math.random() * 800,
                amount: 1000
            });
            this.resourceSpots.push({
                id: `wood-${i}`, type: 'wood',
                x: 300 + Math.random() * 800,
                y: 300 + Math.random() * 800,
                amount: 1000
            });
        }
    }

    update() {
        if (!this.started) return;
        this.tick++;

        // 资源自动增长（基于建筑）
        const goldMines = this.buildings.filter(b => b.type === 'gold-mine');
        const lumberCamps = this.buildings.filter(b => b.type === 'lumber-camp');
        this.resources.gold += goldMines.length * 0.2;
        this.resources.wood += lumberCamps.length * 0.2;

        // 单位更新
        this.units.forEach(u => {
            if (u.attackCooldown > 0) u.attackCooldown -= 0.016;

            if (u.state === 'moving' && u.target) {
                const dx = u.target.x - u.x;
                const dy = u.target.y - u.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 5) {
                    u.x += (dx/dist) * u.speed * 0.016;
                    u.y += (dy/dist) * u.speed * 0.016;
                } else {
                    u.state = 'idle';
                    u.target = null;
                }
            }

            if (u.state === 'attacking' && u.target) {
                const target = this.findTarget(u.target);
                if (!target) {
                    u.state = 'idle';
                    u.target = null;
                    return;
                }
                const dx = target.x - u.x;
                const dy = target.y - u.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > u.range) {
                    u.x += (dx/dist) * u.speed * 0.016;
                    u.y += (dy/dist) * u.speed * 0.016;
                } else if (u.attackCooldown <= 0) {
                    target.health -= u.damage;
                    u.attackCooldown = 1;
                }
            }
        });

        // 清理死亡单位/建筑
        this.units = this.units.filter(u => u.health > 0);
        this.buildings = this.buildings.filter(b => b.health > 0);

        // 检查基地是否被毁
        const hasBase = this.buildings.some(b => b.type === 'base');
        if (!hasBase && this.started) {
            this.started = false;
            return 'lose';
        }
        return null;
    }

    findTarget(ref) {
        if (ref.type === 'unit') return this.units.find(u => u.id === ref.id);
        if (ref.type === 'building') return this.buildings.find(b => b.id === ref.id);
        return null;
    }

    build(type, x, y) {
        const costs = {
            'barracks': { gold: 50, wood: 30 },
            'gold-mine': { gold: 20, wood: 40 },
            'lumber-camp': { gold: 30, wood: 20 }
        };
        const cost = costs[type];
        if (!cost || this.resources.gold < cost.gold || this.resources.wood < cost.wood) return false;

        this.resources.gold -= cost.gold;
        this.resources.wood -= cost.wood;

        const stats = {
            'base': { hp: 2000, size: 60 },
            'barracks': { hp: 800, size: 50 },
            'gold-mine': { hp: 500, size: 45, prod: 0.2 },
            'lumber-camp': { hp: 500, size: 45, prod: 0.2 }
        };

        this.buildings.push({
            id: `${type}-${Date.now()}`, type, playerId: 'offline',
            x, y, health: stats[type].hp, maxHealth: stats[type].hp
        });

        if (type === 'gold-mine') this.resources.gold += 0.2;
        if (type === 'lumber-camp') this.resources.wood += 0.2;

        return true;
    }

    train(type, buildingId) {
        const costs = {
            'soldier': { gold: 50, wood: 20 },
            'worker': { gold: 25, wood: 10 }
        };
        const cost = costs[type];
        if (!cost || this.resources.gold < cost.gold || this.resources.wood < cost.wood) return false;

        const building = this.buildings.find(b => b.id === buildingId);
        if (!building) return false;

        this.resources.gold -= cost.gold;
        this.resources.wood -= cost.wood;

        const stats = {
            'soldier': { hp: 100, dmg: 10, range: 60, speed: 40, size: 8 },
            'worker': { hp: 50, dmg: 5, range: 30, speed: 35, size: 6 }
        };

        this.units.push({
            id: `${type}-${Date.now()}`, type, playerId: 'offline',
            x: building.x + (Math.random() - 0.5) * 30,
            y: building.y + (Math.random() - 0.5) * 30,
            health: stats[type].hp, maxHealth: stats[type].hp,
            damage: stats[type].dmg, range: stats[type].range,
            speed: stats[type].speed, size: stats[type].size,
            target: null, state: 'idle', attackCooldown: 0
        });

        return true;
    }

    select(x, y, radius) {
        this.selectedUnits = this.units.filter(u =>
            u.playerId === 'offline' &&
            Math.sqrt((u.x - x)**2 + (u.y - y)**2) < radius
        );
    }

    move(x, y) {
        this.selectedUnits.forEach(u => {
            u.target = { x, y };
            u.state = 'moving';
        });
    }

    restart() {
        this.resources = { gold: 100, wood: 100 };
        this.buildings = [];
        this.units = [];
        this.resourceSpots = [];
        this.selectedUnits = [];
        this.started = false;
        this.tick = 0;
        this.initBase();
    }
}

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

        // 离线模式
        this.offlineGame = null;
        this.isOffline = false;

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // 连接服务器
        this.connect();

        // UI事件 - 延迟绑定确保元素存在
        setTimeout(() => {
            const startBtn = document.getElementById('startBtn');
            if (startBtn) {
                startBtn.addEventListener('click', () => this.startGame());
            } else {
                console.warn('Start button not found');
            }

            const restartBtn = document.getElementById('restartBtn');
            if (restartBtn) {
                restartBtn.addEventListener('click', () => this.restart());
            } else {
                console.warn('Restart button not found');
            }

            const helpBtn = document.getElementById('helpBtn');
            if (helpBtn) {
                helpBtn.addEventListener('click', () => this.showHelp());
                console.log('Help button bound');
            } else {
                console.warn('Help button not found');
            }
        }, 100);

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
        let touchStartPos = null;
        let touchStartTime = 0;
        let isDragging = false;
        let longPressTriggered = false;

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const now = Date.now();
            touchStartPos = { x: touch.clientX, y: touch.clientY };
            touchStartTime = now;
            longPressTriggered = false;

            // 长按检测（用于攻击）
            this.touchLongPressTimer = setTimeout(() => {
                longPressTriggered = true;
                // 长按触发攻击
                this.handleLongPress(touch.clientX, touch.clientY);
            }, 500);

            // 双击检测
            if (now - lastTouchTime < 300) {
                clearTimeout(this.touchLongPressTimer);
                this.onDoubleClick({ clientX: touch.clientX, clientY: touch.clientY });
                lastTouchTime = 0;
            } else {
                this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
                lastTouchTime = now;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartPos.x;
            const dy = touch.clientY - touchStartPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // 如果移动超过阈值，视为拖拽
            if (dist > 10) {
                isDragging = true;
                clearTimeout(this.touchLongPressTimer);
                this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            clearTimeout(this.touchLongPressTimer);

            if (isDragging) {
                this.onMouseUp({});
            } else if (!longPressTriggered) {
                // 单击 - 触发点击
                const touch = e.changedTouches[0];
                this.onClick({ clientX: touch.clientX, clientY: touch.clientY });
            }

            isDragging = false;
            touchStartPos = null;
        });

        // 阻止默认的触摸行为（如滚动、缩放）
        document.body.addEventListener('touchmove', e => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    handleLongPress(clientX, clientY) {
        const pos = this.getWorldPos({ clientX, clientY });

        if (this.isOffline) {
            // 检查长按位置是否有敌人
            const enemyUnits = this.offlineGame.units.filter(u => u.playerId !== 'offline');
            const enemyBuildings = this.offlineGame.buildings.filter(b => b.playerId !== 'offline');
            const target = this.findEnemyAtPosition(pos, enemyUnits, enemyBuildings);

            if (target && this.selectedUnits.length > 0) {
                // 攻击敌人
                this.offlineGame.selectedUnits.forEach(u => {
                    u.target = { type: target.type, id: target.id };
                    u.state = 'attacking';
                });
                this.createParticles(pos.x, pos.y, '#f56565', 8);
                this.addFloatingText('攻击！', '#f56565', pos.x, pos.y);
            } else {
                // 长按没有敌人，显示提示
                this.addFloatingText('长按敌人可攻击', '#667eea', clientX, clientY);
            }
        } else {
            // 在线模式：发送长按攻击事件
            this.safeEmit('longPressAttack', { x: pos.x, y: pos.y });
        }
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
        // 如果没有配置服务器地址，直接进入离线模式
        if (!SERVER_URL) {
            console.log('⚠️ 未配置 SERVER_URL，进入离线模式');
            setTimeout(() => this.enableOfflineMode(), 1000);
            return;
        }

        try {
            this.socket = io(SERVER_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ 已连接到服务器');
                this.playerId = this.socket.id;
                document.getElementById('playerId').textContent = this.playerId.substring(0, 8);
                this.updateStatus('connected');
                document.getElementById('connectingOverlay')?.classList.add('hidden');
                document.getElementById('offlineNotice')?.classList.add('hidden');
                this.addFloatingText('已连接服务器', '#48bb78');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ 连接断开:', reason);
                this.updateStatus('disconnected');
                this.addFloatingText('连接断开，正在重连...', '#ed8936');
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ 连接错误:', error);
                this.updateStatus('disconnected');
                this.addFloatingText('连接失败，进入离线模式', '#f56565');
                // 延迟后进入离线模式
                setTimeout(() => this.enableOfflineMode(), 2000);
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

            // 设置连接超时
            setTimeout(() => {
                if (!this.playerId) {
                    this.updateStatus('disconnected');
                    this.addFloatingText('连接超时，进入离线模式', '#f56565');
                    this.enableOfflineMode();
                }
            }, 15000);

        } catch (error) {
            console.error('❌ Socket 初始化失败:', error);
            this.updateStatus('disconnected');
            this.addFloatingText('初始化失败，进入离线模式', '#f56565');
            setTimeout(() => this.enableOfflineMode(), 1000);
        }
    }

    enableOfflineMode() {
        console.log('🎮 启用离线单人模式');
        this.isOffline = true;
        this.offlineGame = new OfflineGame();
        this.gameState = 'lobby';
        this.updateStatus('offline');
        document.getElementById('connectingOverlay')?.classList.add('hidden');
        document.getElementById('offlineNotice')?.classList.add('hidden');
        this.addFloatingText('离线模式：单人游戏', '#ed8936');

        // 自动聚焦相机到基地
        if (this.offlineGame.basePos) {
            this.focusCamera(this.offlineGame.basePos.x, this.offlineGame.basePos.y);
        }

        this.updateUI();
    }

    updateStatus(status) {
        const el = document.getElementById('status');
        const dot = el.querySelector('.dot');
        const text = el.querySelector('.text');

        el.className = `status ${status}`;
        let statusText = '';
        switch(status) {
            case 'connected': statusText = '已连接'; break;
            case 'connecting': statusText = '连接中...'; break;
            case 'offline': statusText = '离线模式'; break;
            default: statusText = '未连接';
        }
        text.textContent = statusText;

        if (dot) {
            dot.style.animation = status === 'connected' ? 'none' : 'pulse 1.5s infinite';
        }
    }

    startGame() {
        if (this.isOffline) {
            this.offlineGame.started = true;
            this.gameState = 'playing';
            this.addFloatingText('离线游戏开始！', '#48bb78');
        } else if (!this.playerId || !this.socket?.connected) {
            this.showOfflineMode();
        } else {
            this.gameState = 'playing';
            this.socket.emit('start', (response) => {
                if (response?.error) {
                    this.addFloatingText(response.error, '#f56565');
                } else {
                    this.addFloatingText('游戏开始！', '#48bb78');
                }
            });
        }
    }

    restart() {
        this.gameState = 'lobby';
        this.selectedUnits = [];
        this.buildType = null;
        this.trainType = null;
        this.hideGameOver();

        if (this.isOffline) {
            this.offlineGame.restart();
            this.updateUI();
        } else if (this.socket?.connected) {
            this.socket.emit('restart');
        }

        this.updateButtons();
        this.updateSelectedButtons();
    }

    showOfflineMode() {
        this.addFloatingText('连接失败，进入离线模式', '#ed8936');
        this.enableOfflineMode();
    }

    showHelp() {
        document.getElementById('helpModal').classList.remove('hidden');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    safeEmit(event, data, callback) {
        if (this.isConnected()) {
            this.socket.emit(event, data, callback);
            return true;
        } else {
            this.addFloatingText('未连接到服务器', '#f56565');
            return false;
        }
    }

    getWorldPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
            x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }

    focusCamera(worldX, worldY) {
        // 计算目标相机位置，使世界坐标位于屏幕中心
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        this.camera.targetX = worldX - width / 2;
        this.camera.targetY = worldY - height / 2;
        // 立即应用，不使用平滑过渡
        this.camera.x = this.camera.targetX;
        this.camera.y = this.camera.targetY;
        // 限制在地图范围内
        this.updateCamera();
    }

    onClick(e) {
        if (this.gameState !== 'playing') return;
        const pos = this.getWorldPos(e);

        if (this.buildType) {
            if (this.isOffline) {
                if (this.offlineGame.build(this.buildType, pos.x, pos.y)) {
                    this.createParticles(pos.x, pos.y, '#667eea', 5);
                    this.buildType = null;
                    this.updateButtons();
                    this.updateSelectedButtons();
                    this.updateUI();
                } else {
                    this.addFloatingText('资源不足', '#f56565', pos.x, pos.y);
                }
            } else if (this.safeEmit('build', { type: this.buildType, x: pos.x, y: pos.y })) {
                this.createParticles(pos.x, pos.y, '#667eea', 5);
                this.buildType = null;
                this.updateButtons();
                this.updateSelectedButtons();
            }
        } else if (this.trainType) {
            const barracks = this.getBuildings().find(b => b.type === 'barracks' && b.playerId === (this.isOffline ? 'offline' : this.playerId));
            if (barracks) {
                if (this.isOffline) {
                    if (this.offlineGame.train(this.trainType, barracks.id)) {
                        this.createParticles(barracks.x, barracks.y, '#48bb78', 8);
                        this.trainType = null;
                        this.updateButtons();
                        this.updateSelectedButtons();
                        this.updateUI();
                    } else {
                        this.addFloatingText('资源不足', '#f56565', pos.x, pos.y);
                    }
                } else if (this.safeEmit('train', { type: this.trainType, buildingId: barracks.id })) {
                    this.createParticles(barracks.x, barracks.y, '#48bb78', 8);
                    this.trainType = null;
                    this.updateButtons();
                    this.updateSelectedButtons();
                }
            } else {
                this.addFloatingText('需要兵营', '#f56565', pos.x, pos.y);
            }
        } else {
            // 选择单位
            if (this.isOffline) {
                this.offlineGame.select(pos.x, pos.y, 25);
                this.selectedUnits = this.offlineGame.selectedUnits;
            } else {
                this.safeEmit('select', { x: pos.x, y: pos.y, radius: 25 });
            }
        }
    }

    onDoubleClick(e) {
        if (this.gameState !== 'playing') return;
        const pos = this.getWorldPos(e);

        // 检查双击位置是否有敌人单位（用于攻击）
        if (this.isOffline) {
            const enemyUnits = this.offlineGame.units.filter(u => u.playerId !== 'offline');
            const enemyBuildings = this.offlineGame.buildings.filter(b => b.playerId !== 'offline');
            const target = this.findEnemyAtPosition(pos, enemyUnits, enemyBuildings);

            if (target && this.selectedUnits.length > 0) {
                // 攻击敌人
                this.offlineGame.selectedUnits.forEach(u => {
                    u.target = { type: target.type, id: target.id };
                    u.state = 'attacking';
                });
                this.createParticles(pos.x, pos.y, '#f56565', 8);
                this.addFloatingText('攻击！', '#f56565', pos.x, pos.y);
            } else {
                // 移动
                this.offlineGame.move(pos.x, pos.y);
                this.createParticles(pos.x, pos.y, '#fff', 3);
            }
        } else {
            // 在线模式：发送双击事件，由服务器处理
            this.safeEmit('doubleClick', { x: pos.x, y: pos.y });
        }
    }

    findEnemyAtPosition(pos, enemyUnits, enemyBuildings) {
        // 检查单位
        for (const u of enemyUnits) {
            const dist = Math.sqrt((u.x - pos.x)**2 + (u.y - pos.y)**2);
            if (dist < u.size + 10) {
                return { type: 'unit', id: u.id, x: u.x, y: u.y };
            }
        }
        // 检查建筑
        for (const b of enemyBuildings) {
            const size = b.type === 'base' ? 60 : b.type === 'gold-mine' || b.type === 'lumber-camp' ? 45 : 50;
            const dist = Math.sqrt((b.x - pos.x)**2 + (b.y - pos.y)**2);
            if (dist < size/2 + 10) {
                return { type: 'building', id: b.id, x: b.x, y: b.y };
            }
        }
        return null;
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
                if (this.isOffline) {
                    this.offlineGame.move(pos.x, pos.y);
                } else {
                    this.safeEmit('move', { x: pos.x, y: pos.y });
                }
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
        const resources = this.isOffline ? this.offlineGame.resources : this.resources;
        document.getElementById('gold').textContent = Math.floor(resources.gold);
        document.getElementById('wood').textContent = Math.floor(resources.wood);
    }

    updateButtons() {
        const resources = this.isOffline ? this.offlineGame.resources : this.resources;
        document.querySelectorAll('.build, .train').forEach(btn => {
            const costGold = parseInt(btn.dataset.gold);
            const costWood = parseInt(btn.dataset.wood);
            btn.disabled = resources.gold < costGold || resources.wood < costWood;
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

        // 离线模式更新
        if (this.isOffline && this.offlineGame && this.gameState === 'playing') {
            const result = this.offlineGame.update();
            if (result === 'lose') {
                this.showGameOver(false);
            }

            // 同步数据到渲染
            this.resources = this.offlineGame.resources;
            this.buildings = this.offlineGame.buildings;
            this.units = this.offlineGame.units;
            this.resourceSpots = this.offlineGame.resourceSpots;
            this.selectedUnits = this.offlineGame.selectedUnits;

            this.updateUI();
            this.updateButtons();
        }
    }

    getBuildings() {
        return this.isOffline ? this.offlineGame.buildings : this.buildings;
    }

    getUnits() {
        return this.isOffline ? this.offlineGame.units : this.units;
    }

    getResourceSpots() {
        return this.isOffline ? this.offlineGame.resourceSpots : this.resourceSpots;
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
        const spots = this.getResourceSpots();
        spots.forEach(spot => {
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
        const buildings = this.getBuildings();
        buildings.forEach(b => {
            const isMine = b.playerId === (this.isOffline ? 'offline' : this.playerId);
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
        const units = this.getUnits();
        units.forEach(u => {
            const isMine = u.playerId === (this.isOffline ? 'offline' : this.playerId);
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