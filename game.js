// Инициализация игры
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameScreen = document.getElementById('game-screen');
    const messageOverlay = document.getElementById('message-overlay');
    const levelCompleteOverlay = document.getElementById('level-complete-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const startOverlay = document.getElementById('start-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('time-display');
    const livesDisplay = document.getElementById('lives-display');
    const speedDisplay = document.getElementById('speed-display');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    // Установка размеров canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Фокус на игровом экране для управления клавиатурой
    gameScreen.focus();

    // Константы игры
    const GRAVITY = 0.3;
    const PLAYER_NORMAL_SPEED = 2.5;
    const PLAYER_BOOST_SPEED = 3.5;
    const JUMP_NORMAL_FORCE = -8;
    const JUMP_BOOST_FORCE = -10;
    const TILE_SIZE = Math.min(canvas.width, canvas.height) / 20;
    const SPIKE_DAMAGE = 1;

    // Текущие значения скорости и прыжка
    let currentPlayerSpeed = PLAYER_NORMAL_SPEED;
    let currentJumpForce = JUMP_NORMAL_FORCE;

    // Переменные игры
    let gameState = {
        currentLevel: 1,
        lives: 3,
        timeLeft: 120,
        isPaused: false,
        isGameOver: false,
        levelComplete: false,
        gameStarted: false,
        player: null,
        platforms: [],
        spikes: [],
        exits: [],
        keys: {},
        isSpeedBoost: false,
    };

    // Управление с клавиатуры
    gameScreen.addEventListener('keydown', (e) => {
        // Начало игры при нажатии любой клавиши
        if (!gameState.gameStarted && startOverlay.style.display !== 'none') {
            startGame();
            return;
        }

        gameState.keys[e.code] = true;

        // Ускорение по Shift
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys['Shift'] = true;
            if (gameState.gameStarted && !gameState.isPaused) {
                activateSpeedBoost();
            }
        }


        // Перезапуск уровня по клавише R
        if (e.code === 'KeyR') {
            if (gameState.isGameOver) {
                restartGame();
            }
        }


        // Предотвращение стандартных действий браузера
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });

    gameScreen.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;

        // Отпускание Shift
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys['Shift'] = false;
            deactivateSpeedBoost(); // Просто деактивируем без проверок
        }
    });

    // Начало игры по клику
    gameScreen.addEventListener('click', () => {
        if (!gameState.gameStarted && startOverlay.style.display !== 'none') {
            startGame();
        }
    });

    // Активация ускорения
    function activateSpeedBoost() {
        if (!gameState.isSpeedBoost) {
            gameState.isSpeedBoost = true;
            currentPlayerSpeed = PLAYER_BOOST_SPEED;
            currentJumpForce = JUMP_BOOST_FORCE;
            speedDisplay.textContent = "УСКОРЕНИЕ";
            speedDisplay.classList.add('speed-boost');
        }
    }

// Деактивация ускорения
    function deactivateSpeedBoost() {
        gameState.isSpeedBoost = false;
        currentPlayerSpeed = PLAYER_NORMAL_SPEED;
        currentJumpForce = JUMP_NORMAL_FORCE;
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
        speedDisplay.classList.remove('speed-boost');
    }

    // Класс игрока
    class Player {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE * 0.7;
            this.height = TILE_SIZE * 1.5;
            this.velocityX = 0;
            this.velocityY = 0;
            this.onGround = false;
            this.color = '#d4af37';
            this.direction = 1; // 1 - вправо, -1 - влево
            this.isJumping = false;
            this.isClimbing = false;
        }

        update() {
            // Применение гравитации
            if (!this.onGround && !this.isClimbing) {
                this.velocityY += GRAVITY;
            }

            // Управление движением
            if (gameState.keys['ArrowLeft'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityX = -currentPlayerSpeed;
                this.direction = -1;
            } else if (gameState.keys['ArrowRight'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityX = currentPlayerSpeed;
                this.direction = 1;
            } else {
                this.velocityX = 0;
            }

            // Прыжок
            if (gameState.keys['Space'] && this.onGround && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityY = currentJumpForce;
                this.onGround = false;
            }

            // Подъем/спуск по лестницам
            this.isClimbing = false;
            if (gameState.keys['Space'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                // Проверка, находится ли игрок рядом с лестницей
                for (const platform of gameState.platforms) {
                    if (platform.isLadder &&
                        this.x + this.width/2 > platform.x &&
                        this.x + this.width/2 < platform.x + platform.width &&
                        this.y + this.height > platform.y &&
                        this.y < platform.y + platform.height) {
                        this.isClimbing = true;
                        this.velocityY = -currentPlayerSpeed;
                        break;
                    }
                }
            }

            // Обновление позиции
            this.x += this.velocityX;
            this.y += this.velocityY;

            // Ограничение выхода за границы экрана
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y + this.height > canvas.height) {
                this.y = canvas.height - this.height;
                this.onGround = true;
                this.velocityY = 0;
            }

            // Проверка столкновений с платформами
            this.onGround = false;
            for (const platform of gameState.platforms) {
                if (this.collidesWith(platform) && !platform.isLadder) {
                    // Столкновение сверху
                    if (this.velocityY > 0 && this.y + this.height <= platform.y + this.velocityY) {
                        this.y = platform.y - this.height;
                        this.onGround = true;
                        this.velocityY = 0;
                    }
                    // Столкновение снизу
                    else if (this.velocityY < 0 && this.y >= platform.y + platform.height + this.velocityY) {
                        this.y = platform.y + platform.height;
                        this.velocityY = 0;
                    }
                    // Столкновение сбоку
                    else if (this.velocityX !== 0) {
                        if (this.velocityX > 0 && this.x + this.width <= platform.x + this.velocityX) {
                            this.x = platform.x - this.width;
                        } else if (this.velocityX < 0 && this.x >= platform.x + platform.width + this.velocityX) {
                            this.x = platform.x + platform.width;
                        }
                    }
                }
            }

            // Проверка столкновений с шипами
            for (const spike of gameState.spikes) {
                if (this.collidesWith(spike)) {
                    takeDamage();
                    // Отталкивание от шипов
                    if (this.x < spike.x + spike.width/2) {
                        this.x = spike.x - this.width;
                    } else {
                        this.x = spike.x + spike.width;
                    }
                    break;
                }
            }

            // Проверка достижения выхода
            for (const exit of gameState.exits) {
                if (this.collidesWith(exit)) {
                    completeLevel();
                    break;
                }
            }
        }

        collidesWith(object) {
            return this.x < object.x + object.width &&
                this.x + this.width > object.x &&
                this.y < object.y + object.height &&
                this.y + this.height > object.y;
        }

        draw() {
            // Тело принца
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Голова
            ctx.fillStyle = '#f7dc6f';
            ctx.fillRect(this.x + this.width/4, this.y, this.width/2, this.height/4);

            // Глаза
            ctx.fillStyle = '#000';
            const eyeOffset = this.direction > 0 ? this.width/3 : this.width/4;
            ctx.fillRect(this.x + eyeOffset, this.y + this.height/8, this.width/10, this.height/15);

            // Меч
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(this.x + (this.direction > 0 ? this.width : -this.width/3), this.y + this.height/3, this.width/3, this.height/20);
        }
    }

    // Класс платформы (обновленный для более точной графики)
    class Platform {
        constructor(x, y, width, height, isLadder = false) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.isLadder = isLadder;
            this.color = isLadder ? '#8b4513' : '#7f8c8d';
            this.brickColor = '#95a5a6';
            this.brickDarkColor = '#7f8c8d';
        }

        draw() {
            // Для обычных платформ рисуем кирпичи
            if (!this.isLadder) {
                // Основной фон
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);

                // Кирпичная кладка
                const brickWidth = 15;
                const brickHeight = 8;

                for (let row = 0; row < this.height / brickHeight; row++) {
                    for (let col = 0; col < this.width / brickWidth; col++) {
                        const brickX = this.x + col * brickWidth;
                        const brickY = this.y + row * brickHeight;

                        // Чередование рядов кирпичей
                        if (row % 2 === 0) {
                            // Четные ряды
                            ctx.fillStyle = col % 2 === 0 ? this.brickColor : this.brickDarkColor;
                        } else {
                            // Нечетные ряды со смещением
                            ctx.fillStyle = (col + 0.5) % 2 === 0 ? this.brickColor : this.brickDarkColor;
                        }

                        // Рисуем кирпич с закруглениями
                        ctx.fillRect(brickX, brickY, brickWidth - 1, brickHeight - 1);

                        // Линии между кирпичами
                        ctx.fillStyle = '#5d6d7e';
                        if (col < this.width / brickWidth - 1) {
                            ctx.fillRect(brickX + brickWidth - 1, brickY, 1, brickHeight - 1);
                        }
                        if (row < this.height / brickHeight - 1) {
                            ctx.fillRect(brickX, brickY + brickHeight - 1, brickWidth - 1, 1);
                        }
                    }
                }

                // Верхняя часть платформы
                ctx.fillStyle = '#d4af37';
                ctx.fillRect(this.x, this.y - 3, this.width, 3);

            } else {
                // Лестница
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);

                // Боковые стороны лестницы
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(this.x, this.y, 3, this.height);
                ctx.fillRect(this.x + this.width - 3, this.y, 3, this.height);

                // Перекладины лестницы
                ctx.fillStyle = '#d4af37';
                const stepHeight = 20;
                for (let i = 0; i < this.height / stepHeight; i++) {
                    const stepY = this.y + i * stepHeight;
                    ctx.fillRect(this.x, stepY, this.width, 4);
                }
            }
        }
    }

    // Класс шипов (обновленный)
    class Spike {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color = '#c0392b';
            this.metalColor = '#7f8c8d';
            this.bladeColor = '#e74c3c';
        }

        draw() {
            // Основание шипа
            ctx.fillStyle = this.metalColor;
            ctx.fillRect(this.x, this.y + this.height - 5, this.width, 5);

            // Металлическая стойка
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(this.x + this.width/2 - 3, this.y + this.height - 10, 6, 10);

            // Лезвие шипа
            ctx.fillStyle = this.bladeColor;

            // Рисуем треугольник-шип
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 10);
            ctx.lineTo(this.x + this.width/4 * 3, this.y + this.height - 10);
            ctx.closePath();
            ctx.fill();

            // Острие
            ctx.fillStyle = '#ffebee';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/2 - 2, this.y + 5);
            ctx.lineTo(this.x + this.width/2 + 2, this.y + 5);
            ctx.closePath();
            ctx.fill();

            // Боковые грани для объема
            ctx.fillStyle = '#b03a2e';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 10);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 8);
            ctx.lineTo(this.x + this.width/2 - 2, this.y + 3);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Класс выхода
    class Exit {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color = '#27ae60';
        }

        draw() {
            // Дверь выхода
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Деревянная текстура двери
            ctx.fillStyle = '#1e8449';
            for (let i = 0; i < this.height; i += 10) {
                ctx.fillRect(this.x, this.y + i, this.width, 3);
            }
            for (let i = 0; i < this.width; i += 10) {
                ctx.fillRect(this.x + i, this.y, 3, this.height);
            }

            // Ручка
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.arc(this.x + this.width - 15, this.y + this.height/2, 5, 0, Math.PI * 2);
            ctx.fill();

            // Замок
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(this.x + this.width - 25, this.y + this.height/2 - 10, 10, 20);

            // Арка над дверью
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y, 20, 0, Math.PI, true);
            ctx.fill();

            // Кирпичи над аркой
            ctx.fillStyle = '#7f8c8d';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(this.x + i * 8, this.y - 5, 6, 5);
            }
        }
    }

    // Инициализация уровней
    function initLevel(level) {
        gameState.platforms = [];
        gameState.spikes = [];
        gameState.exits = [];

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const floorHeight = canvasHeight - TILE_SIZE;

        if (level === 1) {
            // Пол
            gameState.platforms.push(new Platform(0, floorHeight, canvasWidth, TILE_SIZE));

            // Стены по бокам
            gameState.platforms.push(new Platform(0, 0, TILE_SIZE, canvasHeight));
            gameState.platforms.push(new Platform(canvasWidth - TILE_SIZE, 0, TILE_SIZE, canvasHeight));

            // Потолок
            gameState.platforms.push(new Platform(0, 0, canvasWidth, TILE_SIZE));

            // Платформа в начале - стартовая площадка
            gameState.platforms.push(new Platform(44, floorHeight - TILE_SIZE * 3, 250, 250));

            gameState.spikes.push(new Spike(300, floorHeight - 38, TILE_SIZE, TILE_SIZE));
            for (let i = 0; i < 4; i++) {
                gameState.spikes.push(new Spike(300 + 30 * i, floorHeight - 38, TILE_SIZE, TILE_SIZE));
            }


            for (let i = 0; i < 32; i++) {
                gameState.spikes.push(new Spike(520 + 30 * i, floorHeight - 38, TILE_SIZE, TILE_SIZE));
            }


            // Первая платформа
            gameState.platforms.push(new Platform(450, floorHeight - 300, TILE_SIZE * 3, TILE_SIZE));

            // Платформа после спуска
            gameState.platforms.push(new Platform(TILE_SIZE * 12, floorHeight - TILE_SIZE * 1.5, TILE_SIZE * 3, TILE_SIZE * 10));

            // Вторая платформа с лестницей для подъема
            gameState.platforms.push(new Platform(TILE_SIZE * 18, floorHeight - TILE_SIZE * 6, TILE_SIZE * 3, TILE_SIZE));

            // Лестница для подъема
            gameState.platforms.push(new Platform(TILE_SIZE * 17, floorHeight - TILE_SIZE * 6, TILE_SIZE, TILE_SIZE * 3.5, true));

            // Высокая платформа перед выходом
            gameState.platforms.push(new Platform(TILE_SIZE * 25, floorHeight - TILE_SIZE * 7, TILE_SIZE * 4, TILE_SIZE));

            // Шип
            gameState.spikes.push(new Spike(TILE_SIZE * 28, floorHeight - TILE_SIZE * 8, TILE_SIZE, TILE_SIZE));

            // Платформа с выходом
            gameState.platforms.push(new Platform(TILE_SIZE * 33, floorHeight - TILE_SIZE * 3, TILE_SIZE * 8, TILE_SIZE));

            // Выход - дверь
            gameState.exits.push(new Exit(TILE_SIZE * 39, floorHeight - TILE_SIZE * 6, TILE_SIZE * 2, TILE_SIZE * 3));

            // Игрок - начинаем на стартовой платформе
            gameState.player = new Player(100, 100);
        }

        // Уровень 2 - сохраняем предыдущую версию
        else if (level === 2) {
            // Пол
            gameState.platforms.push(new Platform(0, floorHeight, canvasWidth, TILE_SIZE));

            // Стены по бокам
            gameState.platforms.push(new Platform(0, 0, TILE_SIZE, canvasHeight));
            gameState.platforms.push(new Platform(canvasWidth - TILE_SIZE, 0, TILE_SIZE, canvasHeight));

            // Потолок
            gameState.platforms.push(new Platform(0, 0, canvasWidth, TILE_SIZE));

            // Выход
            gameState.exits.push(new Exit(canvasWidth - TILE_SIZE*4, floorHeight - TILE_SIZE*3, TILE_SIZE*2, TILE_SIZE*3));

            // Игрок
            gameState.player = new Player(50, floorHeight - TILE_SIZE*4);
        }
    }

    // Получение урона
    function takeDamage() {
        gameState.lives -= SPIKE_DAMAGE;
        livesDisplay.textContent = gameState.lives;

        if (gameState.lives <= 0) {
            gameOver();
        }
    }

    // Завершение уровня
    function completeLevel() {
        if (gameState.levelComplete) return;

        gameState.levelComplete = true;

        // Если это второй уровень - сразу показываем экран победы
        if (gameState.currentLevel === 2) {
            setTimeout(() => {
                gameWin(); // Показываем экран победы
            }, 500);
        } else {
            // Для первого уровня показываем обычный оверлей
            setTimeout(() => {
                levelCompleteOverlay.style.display = 'flex';

                setTimeout(() => {
                    levelCompleteOverlay.style.display = 'none';
                    gameState.currentLevel++;
                    levelDisplay.textContent = gameState.currentLevel;
                    gameState.levelComplete = false;
                    initLevel(gameState.currentLevel);
                }, 2000);
            }, 500);
        }
    }

    // Конец игры
    function gameOver() {
        gameState.isGameOver = true;
        gameOverOverlay.style.display = 'flex';
    }

    function gameWin() {
        gameState.isGameOver = true;
        gameOverOverlay.innerHTML = `
        <div class="message">
            <h2>ПОБЕДА!</h2>
            <p>Вы прошли все уровни!</p>
            <p>Время: ${timeDisplay.textContent}</p>
            <p>Нажмите R для перезапуска игры</p>
        </div>
    `;
        gameOverOverlay.style.display = 'flex';
    }

    // Начало игры
    function startGame() {
        gameState.gameStarted = true;
        startOverlay.style.display = 'none';
        gameScreen.focus();
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
    }

    // Перезапуск игры
    function restartGame() {
        gameState.currentLevel = 1;
        gameState.lives = 3;
        gameState.timeLeft = 120;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        gameState.levelComplete = false;
        gameState.gameStarted = true;

        // Сброс ускорения
        gameState.isSpeedBoost = false;
        currentPlayerSpeed = PLAYER_NORMAL_SPEED;
        currentJumpForce = JUMP_NORMAL_FORCE;

        levelDisplay.textContent = gameState.currentLevel;
        livesDisplay.textContent = gameState.lives;
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
        speedDisplay.classList.remove('speed-boost');
        speedDisplay.style.color = '';

        gameOverOverlay.style.display = 'none';
        levelCompleteOverlay.style.display = 'none';
        pauseOverlay.style.display = 'none';

        initLevel(gameState.currentLevel);
        gameScreen.focus();
    }

    // Сброс уровня
    function resetLevel() {
        if (!gameState.gameStarted) return;

        gameState.lives--;
        livesDisplay.textContent = gameState.lives;

        // Сброс ускорения при перезапуске уровня
        if (gameState.isSpeedBoost) {
            deactivateSpeedBoost();
        }

        if (gameState.lives <= 0) {
            gameOver();
        } else {
            initLevel(gameState.currentLevel);
        }
    }


    // Показ сообщения
    function showMessage(text, duration) {
        messageOverlay.innerHTML = `<div class="message">${text}</div>`;

        if (duration > 0) {
            setTimeout(() => {
                messageOverlay.innerHTML = '';
            }, duration);
        }
    }

    // Обновление таймера
    function updateTimer() {
        if (!gameState.gameStarted || gameState.isPaused || gameState.levelComplete || gameState.isGameOver) return;

        gameState.timeLeft--;

        if (gameState.timeLeft <= 0) {
            gameOver();
            return;
        }

        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;

        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Основной игровой цикл
    function gameLoop() {
        // Очистка экрана
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Рисование фона
        drawBackground();

        // Обновление ускорения
        if (gameState.gameStarted && !gameState.isPaused) {
        }

        // Обновление и отрисовка игровых объектов
        if (gameState.gameStarted && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver) {
            gameState.player.update();
        }

        // Отрисовка всех объектов
        if (gameState.gameStarted) {
            gameState.platforms.forEach(platform => platform.draw());
            gameState.spikes.forEach(spike => spike.draw());
            gameState.exits.forEach(exit => exit.draw());
            if (gameState.player) gameState.player.draw();
        }

        requestAnimationFrame(gameLoop);
    }

    // Рисование фона
    function drawBackground() {
        // Градиентное небо - темнее, как в подземелье
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0c2461');
        gradient.addColorStop(0.5, '#1e3799');
        gradient.addColorStop(1, '#0c2461');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Текстура каменных стен по бокам
        ctx.fillStyle = 'rgba(44, 62, 80, 0.3)';
        for (let x = 0; x < canvas.width; x += 30) {
            for (let y = 0; y < canvas.height; y += 30) {
                if ((x + y) % 60 === 0) {
                    ctx.fillRect(x, y, 20, 20);
                }
            }
        }


    }

    // Запуск таймера
    setInterval(updateTimer, 1000);

    // Инициализация первого уровня и запуск игры
    initLevel(1);
    gameLoop();

    // Автофокус на игровом экране
    setTimeout(() => {
        gameScreen.focus();
    }, 100);
});