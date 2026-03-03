// 迷你多人RTS - 前端
// ⚙️ 配置：修改 SERVER_URL 为你的后端地址（留空则连接到当前域名）
const SERVER_URL = ''; // 例如: 'https://mini-rts.onrender.com'

class MiniRTS {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = null;

        // 游戏状态
        this.playerId = null;
        this.gameState = 'lobby';
        this.resources = { gold: 100, wood: 100 };
        this.buildings = [];
        this.units = [];
        this.selected = [];

        // 地图
        this.map = { width: 2000, height: 1500 };
        this.camera = { x: 0, y: 0, zoom: 1 };

        // 建造/训练选择
        this.buildType = null;
        this.trainType = null;

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

        // 建造按钮
        document.querySelectorAll('.build').forEach(btn => {
            btn.addEventListener('click', () => {
                this.buildType = btn.dataset.type;
                this.trainType = null;
                this.updateButtons();
            });
        });

        // 训练按钮
        document.querySelectorAll('.train').forEach(btn => {
            btn.addEventListener('click', () => {
                this.trainType = btn.dataset.type;
                this.buildType = null;
                this.updateButtons();
            });
        });

        // 画布交互
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('wheel', e => e.preventDefault());

        // 触摸支持
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.onMouseUp({});
        });

        this.gameLoop();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    connect() {
        this.socket = io(SERVER_URL || undefined);
        this.updateStatus('connecting');

        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            document.getElementById('playerId').textContent = this.playerId.substring(0, 8);
            this.updateStatus('connected');
        });

        this.socket.on('disconnect', () => this.updateStatus('disconnected'));

        this.socket.on('state', (state) => {
            this.resources = state.resources || this.resources;
            this.buildings = state.buildings || [];
            this.units = state.units || [];
            this.updateUI();
        });

        this.socket.on('gameOver', (data) => {
            if (data.winner === this.playerId) {
                this.showGameOver(true);
            } else {
                this.showGameOver(false);
            }
        });
    }

    updateStatus(status) {
        const el = document.getElementById('status');
        el.className = status;
        el.textContent = status === 'connected' ? '已连接' :
                         status === 'connecting' ? '连接中...' : '未连接';
    }

    startGame() {
        if (!this.playerId) return alert('等待连接...');
        this.gameState = 'playing';
        this.socket.emit('start');
    }

    restart() {
        this.gameState = 'lobby';
        this.selected = [];
        this.buildType = null;
        this.trainType = null;
        this.socket.emit('restart');
        this.hideGameOver();
        this.updateButtons();
    }

    getWorldPos(e) {
        const rect = this.canvas.getBoundingClientRect();
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
            this.buildType = null;
            this.updateButtons();
        } else if (this.trainType) {
            // 找到最近的兵营
            const barracks = this.buildings.find(b => b.type === 'barracks' && b.playerId === this.playerId);
            if (barracks) {
                this.socket.emit('train', { type: this.trainType, buildingId: barracks.id });
                this.trainType = null;
                this.updateButtons();
            }
        } else {
            // 选择单位
            this.socket.emit('select', { x: pos.x, y: pos.y, radius: 20 });
        }
    }

    onMouseDown(e) {
        if (e.button === 2) { // 右键移动
            const pos = this.getWorldPos(e);
            this.socket.emit('move', { x: pos.x, y: pos.y });
        }
    }

    onMouseMove(e) {
        // 可以用于拖拽地图
    }

    onMouseUp(e) {
        // 框选逻辑可以在这里实现
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

    showGameOver(win) {
        document.getElementById('gameOverTitle').textContent = win ? '🎉 胜利！' : '💀 失败';
        document.getElementById('gameOverText').textContent = win ? '你摧毁了敌方基地！' : '你的基地被摧毁了...';
        document.getElementById('gameOver').classList.remove('hidden');
    }

    hideGameOver() {
        document.getElementById('gameOver').classList.add('hidden');
    }

    gameLoop() {
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制地图背景
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.map.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.map.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.map.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.map.width, y);
            ctx.stroke();
        }

        // 绘制资源
        this.resources.spots?.forEach(spot => {
            ctx.fillStyle = spot.type === 'gold' ? '#ffd700' : '#8b4513';
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(spot.type === 'gold' ? '💰' : '🪵', spot.x, spot.y + 4);
        });

        // 绘制建筑
        this.buildings.forEach(b => {
            const color = b.playerId === this.playerId ? '#4caf50' : '#f44336';
            ctx.fillStyle = color;
            ctx.fillRect(b.x - 25, b.y - 25, 50, 50);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x - 25, b.y - 25, 50, 50);

            ctx.fillStyle = '#fff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = b.type === 'base' ? '🏛️' : b.type === 'barracks' ? '🏚️' : b.type === 'gold-mine' ? '⛏️' : '🪓';
            ctx.fillText(icon, b.x, b.y);

            // 血条
            const hpPercent = b.health / b.maxHealth;
            ctx.fillStyle = '#333';
            ctx.fillRect(b.x - 25, b.y - 35, 50, 6);
            ctx.fillStyle = hpPercent > 0.5 ? '#4caf50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
            ctx.fillRect(b.x - 25, b.y - 35, 50 * hpPercent, 6);
        });

        // 绘制单位
        this.units.forEach(u => {
            const color = u.playerId === this.playerId ? '#4caf50' : '#f44336';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(u.x, u.y, u.type === 'soldier' ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = u.type === 'soldier' ? '12px Arial' : '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = u.type === 'soldier' ? '⚔️' : '👷';
            ctx.fillText(icon, u.x, u.y);
        });

        // 绘制选择指示器
        if (this.buildType) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(this.canvas.width/2 - 25, this.canvas.height/2 - 25, 50, 50);
            ctx.setLineDash([]);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new MiniRTS();
});