const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

const CONFIG = {
    MAP_W: 2000, MAP_H: 1500,
    INITIAL_GOLD: 100, INITIAL_WOOD: 100,
    GOLD_RATE: 0.3, WOOD_RATE: 0.3,
    COSTS: {
        'barracks': { gold: 50, wood: 30 },
        'gold-mine': { gold: 20, wood: 40 },
        'lumber-camp': { gold: 30, wood: 20 },
        'soldier': { gold: 50, wood: 20 },
        'worker': { gold: 25, wood: 10 }
    },
    STATS: {
        'base': { hp: 2000, size: 50 },
        'barracks': { hp: 800, size: 50 },
        'gold-mine': { hp: 500, size: 40, prod: 0.2 },
        'lumber-camp': { hp: 500, size: 40, prod: 0.2 },
        'soldier': { hp: 100, dmg: 10, range: 60, speed: 40, size: 8 },
        'worker': { hp: 50, dmg: 5, range: 30, speed: 35, size: 6 }
    }
};

class Game {
    constructor() {
        this.players = {};
        this.buildings = [];
        this.units = [];
        this.resources = [];
        this.started = false;
        this.tick = 0;
    }

    addPlayer(id) {
        this.players[id] = {
            id, gold: CONFIG.INITIAL_GOLD, wood: CONFIG.INITIAL_WOOD,
            goldRate: CONFIG.GOLD_RATE, woodRate: CONFIG.WOOD_RATE
        };

        // 初始基地
        const x = 200 + Math.random() * 400;
        const y = 200 + Math.random() * 400;
        this.buildings.push({
            id: uuidv4(), type: 'base', playerId: id, x, y,
            health: CONFIG.STATS['base'].hp, maxHealth: CONFIG.STATS['base'].hp
        });

        // 初始工人
        for (let i = 0; i < 3; i++) {
            this.units.push({
                id: uuidv4(), type: 'worker', playerId: id,
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                health: CONFIG.STATS['worker'].hp, maxHealth: CONFIG.STATS['worker'].hp,
                damage: CONFIG.STATS['worker'].dmg, range: CONFIG.STATS['worker'].range,
                speed: CONFIG.STATS['worker'].speed, size: CONFIG.STATS['worker'].size,
                target: null, state: 'idle', attackCooldown: 0
            });
        }

        // 资源点
        if (this.resources.length === 0) {
            for (let i = 0; i < 6; i++) {
                this.resources.push({
                    id: uuidv4(), type: 'gold',
                    x: 300 + Math.random() * (CONFIG.MAP_W - 600),
                    y: 300 + Math.random() * (CONFIG.MAP_H - 600),
                    amount: 1000
                });
                this.resources.push({
                    id: uuidv4(), type: 'wood',
                    x: 300 + Math.random() * (CONFIG.MAP_W - 600),
                    y: 300 + Math.random() * (CONFIG.MAP_H - 600),
                    amount: 1000
                });
            }
        }
    }

    update() {
        if (!this.started) return;

        // 资源产出
        Object.values(this.players).forEach(p => {
            p.gold += p.goldRate * 0.1;
            p.wood += p.woodRate * 0.1;
        });

        // 单位更新
        this.units.forEach(u => {
            if (u.attackCooldown > 0) u.attackCooldown -= 0.1;

            if (u.state === 'moving' && u.target) {
                const dx = u.target.x - u.x;
                const dy = u.target.y - u.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 5) {
                    u.x += (dx/dist) * u.speed * 0.1;
                    u.y += (dy/dist) * u.speed * 0.1;
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
                    // 追击
                    u.x += (dx/dist) * u.speed * 0.1;
                    u.y += (dy/dist) * u.speed * 0.1;
                } else if (u.attackCooldown <= 0) {
                    target.health -= u.damage;
                    u.attackCooldown = 1;
                }
            }
        });

        // 清理死亡单位/建筑
        this.units = this.units.filter(u => u.health > 0);
        this.buildings = this.buildings.filter(b => b.health > 0);

        // 检查胜利条件
        Object.keys(this.players).forEach(pid => {
            const hasBase = this.buildings.some(b => b.playerId === pid && b.type === 'base');
            if (!hasBase) {
                const winner = Object.keys(this.players).find(id => id !== pid);
                io.emit('gameOver', { winner, loser: pid });
                this.eliminatePlayer(pid);
            }
        });
    }

    findTarget(ref) {
        if (ref.type === 'unit') return this.units.find(u => u.id === ref.id);
        if (ref.type === 'building') return this.buildings.find(b => b.id === ref.id);
        return null;
    }

    eliminatePlayer(pid) {
        this.units = this.units.filter(u => u.playerId !== pid);
        this.buildings = this.buildings.filter(b => b.playerId !== pid);
        delete this.players[pid];
    }

    getSnapshot() {
        return {
            resources: this.resources,
            buildings: this.buildings,
            units: this.units,
            players: this.players
        };
    }
}

const game = new Game();

// 游戏循环
setInterval(() => {
    game.update();
    io.emit('state', game.getSnapshot());
}, 100);

io.on('connection', socket => {
    console.log('玩家连接:', socket.id);
    game.addPlayer(socket.id);
    socket.emit('joined', { playerId: socket.id, state: game.getSnapshot() });
    io.emit('playerJoined', { id: socket.id });

    socket.on('start', () => {
        if (!game.started) {
            game.started = true;
            io.emit('started');
        }
    });

    socket.on('build', data => {
        const player = game.players[socket.id];
        if (!player) return;
        const cost = CONFIG.COSTS[data.type];
        if (!cost || player.gold < cost.gold || player.wood < cost.wood) return;

        player.gold -= cost.gold;
        player.wood -= cost.wood;

        const stats = CONFIG.STATS[data.type];
        game.buildings.push({
            id: uuidv4(), type: data.type, playerId: socket.id,
            x: data.x, y: data.y,
            health: stats.hp, maxHealth: stats.hp
        });

        if (data.type === 'gold-mine') player.goldRate += stats.prod;
        if (data.type === 'lumber-camp') player.woodRate += stats.prod;
    });

    socket.on('train', data => {
        const player = game.players[socket.id];
        const building = game.buildings.find(b => b.id === data.buildingId && b.playerId === socket.id);
        const cost = CONFIG.COSTS[data.type];
        if (!player || !building || !cost || player.gold < cost.gold || player.wood < cost.wood) return;

        player.gold -= cost.gold;
        player.wood -= cost.wood;
        const stats = CONFIG.STATS[data.type];
        game.units.push({
            id: uuidv4(), type: data.type, playerId: socket.id,
            x: building.x + (Math.random() - 0.5) * 30,
            y: building.y + (Math.random() - 0.5) * 30,
            health: stats.hp, maxHealth: stats.hp,
            damage: stats.dmg, range: stats.range,
            speed: stats.speed, size: stats.size,
            target: null, state: 'idle', attackCooldown: 0
        });
    });

    socket.on('select', data => {
        const player = game.players[socket.id];
        if (!player) return;
        player.selectedUnits = game.units.filter(u =>
            u.playerId === socket.id &&
            Math.sqrt((u.x - data.x)**2 + (u.y - data.y)**2) < data.radius
        );
    });

    socket.on('move', data => {
        const player = game.players[socket.id];
        if (!player || !player.selectedUnits) return;
        player.selectedUnits.forEach(u => {
            u.target = { x: data.x, y: data.y };
            u.state = 'moving';
        });
    });

    socket.on('attack', data => {
        const player = game.players[socket.id];
        if (!player || !player.selectedUnits) return;
        player.selectedUnits.forEach(u => {
            u.target = data.target;
            u.state = 'attacking';
        });
    });

    socket.on('restart', () => {
        game.started = false;
        game.buildings = [];
        game.units = [];
        game.resources = [];
        Object.keys(game.players).forEach(id => {
            game.addPlayer(id);
        });
        io.emit('restarted');
    });

    socket.on('disconnect', () => {
        console.log('玩家断开:', socket.id);
        game.eliminatePlayer(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 迷你RTS服务器运行在端口 ${PORT}`);
});