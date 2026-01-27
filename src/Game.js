import Deck from './Deck.js';

export default class Game {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets;
        
        this.gameState = 'MENU'; 
        this.deck = new Deck();

        this.rows = 4;
        this.cols = 4;
        this.board = []; 
        this.maskBoard = [];
        this.discardPile = []; 

        this.cardWidth = 80;
        this.cardHeight = 120;
        this.gap = 10;
        
        const totalBoardWidth = (this.cols * this.cardWidth) + ((this.cols - 1) * this.gap);
        this.boardStartX = (canvas.width - totalBoardWidth) / 2;
        this.boardStartY = 50; 

        this.discardX = 50;
        this.discardY = 50;

        this.playerHand = []; 
        this.selectedCardIndex = -1; 
        this.playerHandY = 600; 

        this.level = 1;

        // Buttons
        this.startBtn = { x: 300, y: 350, width: 200, height: 60, text: "JUGAR", color: "#ffd700", hoverColor: "#fff", isHovered: false };
        this.restartBtn = { x: 300, y: 400, width: 200, height: 60, text: "REINTENTAR", color: "#d32f2f", hoverColor: "#ff6659", isHovered: false };
        this.nextLevelBtn = { x: 300, y: 350, width: 200, height: 60, text: "SIGUIENTE NIVEL", color: "#00C851", hoverColor: "#00e25b", isHovered: false };
        this.menuBtn = { x: 300, y: 430, width: 200, height: 60, text: "MENU PRINCIPAL", color: "#33b5e5", hoverColor: "#62c9e5", isHovered: false };
        this.drawActionBtn = { x: 650, y: 500, width: 100, height: 50, text: "ROBAR", color: "#ff8800", hoverColor: "#ffaa44", isHovered: false };
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.gameState === 'MENU') this.drawMenuScene();
        else if (this.gameState === 'PLAYING') this.drawGameScene();
        else if (this.gameState === 'GAME_OVER') this.drawGameOverScene();
        else if (this.gameState === 'VICTORY') this.drawVictoryScene();
    }

    startGame() {
        this.level = 1;
        this.startLevel();
    }

    isValidSetup(maskName, cardId) {
        const val = this.getCardValue(cardId);
        // Impossible: Needs > 10, but card is 10
        if (maskName === 'mascara_1' && val === 10) return false;
        // Impossible: Needs < 1, but card is 1
        if (maskName === 'mascara_2' && val === 1) return false;
        return true;
    }

    // --- NEW: SORTED START LEVEL LOGIC ---
    startLevel() {
        this.deck.reset();
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
        this.maskBoard = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
        this.discardPile = [];
        this.playerHand = [];

        // 1. Define the Masks for the first row
        const masks = ['mascara_1', 'mascara_2', 'mascara_3', 'mascara_4'];

        let validSetFound = false;
        let sortedCards = [];

        // 2. Loop until we find a set of 4 cards that works when sorted
        while (!validSetFound) {
            
            // A. Draw 4 cards
            let currentSet = [];
            for(let i=0; i<4; i++) currentSet.push(this.deck.draw());

            // B. Sort them by Value (Ascending: Left=Low, Right=High)
            currentSet.sort((a, b) => this.getCardValue(a) - this.getCardValue(b));

            // C. Validate this specific arrangement
            let allGood = true;
            for(let i=0; i<4; i++) {
                if (!this.isValidSetup(masks[i], currentSet[i])) {
                    allGood = false;
                    break;
                }
            }

            if (allGood) {
                validSetFound = true;
                sortedCards = currentSet;
            } else {
                // Return cards to the deck to avoid running out
                this.deck.cards.unshift(...currentSet);
            }
        }

        // 3. Place the Valid Sorted Set
        for(let col = 0; col < 4; col++) {
            this.board[0][col] = sortedCards[col];
            this.maskBoard[0][col] = masks[col];
        }

        // 4. Deal Player Hand
        this.playerHand.push(this.deck.draw());
        this.selectedCardIndex = -1; 

        this.gameState = 'PLAYING';
        this.render();
    }

    nextLevel() {
        this.level++;
        this.startLevel();
    }

    goToMenu() {
        this.gameState = 'MENU';
        this.render();
    }

    handleClick(mouseX, mouseY) {
        if (this.gameState === 'MENU') {
            if (this.isInside(mouseX, mouseY, this.startBtn)) this.startGame();
            return;
        } 
        if (this.gameState === 'GAME_OVER') {
            if (this.isInside(mouseX, mouseY, this.restartBtn)) this.startGame();
            return;
        }
        if (this.gameState === 'VICTORY') {
            if (this.isInside(mouseX, mouseY, this.nextLevelBtn)) this.nextLevel();
            else if (this.isInside(mouseX, mouseY, this.menuBtn)) this.goToMenu();
            return;
        }

        if (this.gameState === 'PLAYING') {
            if (this.isInside(mouseX, mouseY, this.drawActionBtn)) {
                this.triggerDrawPenalty();
                return;
            }

            // Check Hand
            const handGap = 20; 
            const totalHandWidth = (this.playerHand.length * this.cardWidth) + ((this.playerHand.length - 1) * handGap);
            const handStartX = (this.canvas.width - totalHandWidth) / 2;

            for (let i = 0; i < this.playerHand.length; i++) {
                const cardX = handStartX + i * (this.cardWidth + handGap);
                if (mouseX > cardX && mouseX < cardX + this.cardWidth &&
                    mouseY > this.playerHandY && mouseY < this.playerHandY + this.cardHeight) {
                    
                    this.selectedCardIndex = (this.selectedCardIndex === i) ? -1 : i;
                    this.render();
                    return;
                }
            }

            // Check Grid
            const relativeX = mouseX - this.boardStartX;
            const relativeY = mouseY - this.boardStartY;
            const col = Math.floor(relativeX / (this.cardWidth + this.gap));
            const row = Math.floor(relativeY / (this.cardHeight + this.gap));

            const validCol = col >= 0 && col < this.cols && (relativeX % (this.cardWidth + this.gap) < this.cardWidth);
            const validRow = row >= 0 && row < this.rows && (relativeY % (this.cardHeight + this.gap) < this.cardHeight);

            if (validCol && validRow) {
                this.handleGridInteraction(row, col);
            }
        }
    }

    triggerDrawPenalty() {
        const newCard = this.deck.draw();
        if (newCard) {
            this.playerHand.push(newCard);
        } else {
            return;
        }

        let candidates = [];
        for(let r = 0; r < this.rows; r++) {
            for(let c = 0; c < this.cols; c++) {
                if (this.maskBoard[r][c] !== null) {
                    if (r === this.rows - 1) {
                        candidates.push({row: r, col: c, gameOver: true});
                    } else if (this.board[r+1][c] === null) {
                        candidates.push({row: r, col: c, gameOver: false});
                    }
                }
            }
        }

        if (candidates.length > 0) {
            const randomIndex = Math.floor(Math.random() * candidates.length);
            const target = candidates[randomIndex];

            if (target.gameOver) {
                this.gameState = 'GAME_OVER';
            } else {
                const r = target.row;
                const c = target.col;
                const nextR = r + 1;

                this.board[nextR][c] = this.board[r][c];
                this.maskBoard[nextR][c] = this.maskBoard[r][c];

                this.board[r][c] = null;
                this.maskBoard[r][c] = null;
            }
        }
        this.render();
    }

    getCardValue(id) { return (id - 1) % 10 + 1; }
    getCardSuit(id) { return Math.floor((id - 1) / 10); }

    checkBattleWin(maskName, playerCardId, boardCardId) {
        const pVal = this.getCardValue(playerCardId);
        const bVal = this.getCardValue(boardCardId);
        const pSuit = this.getCardSuit(playerCardId);
        const bSuit = this.getCardSuit(boardCardId);

        switch (maskName) {
            case "mascara_1": return pVal > bVal;
            case "mascara_2": return pVal < bVal;
            case "mascara_3": return pVal === bVal;
            case "mascara_4": return pSuit === bSuit;
            default: return false;
        }
    }

    checkVictory() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.maskBoard[r][c] !== null) return false;
            }
        }
        return true; 
    }

    handleGridInteraction(row, col) {
        if (this.selectedCardIndex === -1) return;
        
        const targetMask = this.maskBoard[row][col];
        if (!targetMask) return; 

        const targetCardValue = this.board[row][col];
        const playedCard = this.playerHand[this.selectedCardIndex]; 
        
        const playerWins = this.checkBattleWin(targetMask, playedCard, targetCardValue);

        if (playerWins) {
            this.maskBoard[row][col] = null;
            this.discardPile.push(playedCard);
            this.playerHand.splice(this.selectedCardIndex, 1);
            this.playerHand.push(this.board[row][col]);
            this.board[row][col] = null; 

            const extraCard = this.deck.draw();
            if (extraCard) this.playerHand.push(extraCard);

            if (this.checkVictory()) {
                this.gameState = 'VICTORY';
                this.render();
                return;
            }

        } else {
            if (row === this.rows - 1) {
                this.gameState = 'GAME_OVER';
                this.render();
                return; 
            }
            const nextRow = row + 1;
            if (nextRow < this.rows && this.board[nextRow][col] === null) {
                this.board[nextRow][col] = this.board[row][col];
                this.board[row][col] = null;
                this.maskBoard[nextRow][col] = this.maskBoard[row][col];
                this.maskBoard[row][col] = null;
            }

            this.discardPile.push(playedCard);
            this.playerHand.splice(this.selectedCardIndex, 1);

            const newCard = this.deck.draw();
            if (newCard) this.playerHand.push(newCard);
        }

        this.selectedCardIndex = -1;
        this.render();
    }

    drawVictoryScene() {
        this.ctx.fillStyle = "#0d2b0d"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#ffd700"; 
        this.ctx.font = "bold 60px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("¡VICTORIA!", this.canvas.width / 2, 200);

        this.ctx.fillStyle = "white";
        this.ctx.font = "30px Arial";
        this.ctx.fillText(`Nivel ${this.level} Completado`, this.canvas.width / 2, 260);

        this.drawButton(this.nextLevelBtn);
        this.drawButton(this.menuBtn);
    }

    drawGameOverScene() {
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#ff4444"; 
        this.ctx.font = "bold 80px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("FIN DE JUEGO", this.canvas.width / 2, 250);

        this.ctx.fillStyle = "white";
        this.ctx.font = "24px Arial";
        this.ctx.fillText("La máscara ha llegado al final.", this.canvas.width / 2, 300);

        this.drawButton(this.restartBtn);
    }

    drawGameScene() {
        this.ctx.fillStyle = '#0a6c0a'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "rgba(0,0,0,0.3)";
        this.ctx.font = "bold 20px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`NIVEL: ${this.level}`, 20, 30);

        this.drawButton(this.drawActionBtn);

        if (this.discardPile.length > 0) {
            const topCard = this.discardPile[this.discardPile.length - 1];
            const img = this.assets[topCard.toString()];
            this.ctx.drawImage(img, this.discardX, this.discardY, this.cardWidth, this.cardHeight);
        } else {
            this.ctx.strokeStyle = "rgba(0,0,0,0.3)";
            this.ctx.strokeRect(this.discardX, this.discardY, this.cardWidth, this.cardHeight);
        }

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = this.boardStartX + col * (this.cardWidth + this.gap);
                const y = this.boardStartY + row * (this.cardHeight + this.gap);

                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);

                const cardValue = this.board[row][col];
                if (cardValue !== null) {
                    const img = this.assets[cardValue.toString()];
                    this.ctx.drawImage(img, x, y, this.cardWidth, this.cardHeight);
                }

                const maskValue = this.maskBoard[row][col];
                if (maskValue !== null) {
                    const maskImg = this.assets[maskValue];
                    if (maskImg) this.ctx.drawImage(maskImg, x, y - 5, this.cardWidth, this.cardHeight);
                }
            }
        }

        if (this.playerHand.length > 0) {
            this.ctx.fillStyle = "white";
            this.ctx.font = "bold 16px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("TU MANO", this.canvas.width / 2, this.playerHandY - 10);

            const handGap = 20; 
            const totalHandWidth = (this.playerHand.length * this.cardWidth) + ((this.playerHand.length - 1) * handGap);
            const startX = (this.canvas.width - totalHandWidth) / 2;

            this.playerHand.forEach((cardId, index) => {
                const img = this.assets[cardId.toString()];
                const x = startX + index * (this.cardWidth + handGap);
                
                if (index === this.selectedCardIndex) {
                    this.ctx.shadowBlur = 25;
                    this.ctx.shadowColor = "#00ff00";
                    this.ctx.drawImage(img, x, this.playerHandY - 10, this.cardWidth, this.cardHeight);
                } else {
                    this.ctx.shadowBlur = 0;
                    this.ctx.drawImage(img, x, this.playerHandY, this.cardWidth, this.cardHeight);
                }
            });
            this.ctx.shadowBlur = 0;
        }
    }

    drawMenuScene() {
        this.ctx.fillStyle = "#1a1a1a";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "white";
        this.ctx.font = "bold 80px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("LA BARAJA", this.canvas.width / 2, 200);
        this.drawButton(this.startBtn);
    }
    
    drawButton(btn) {
        this.ctx.fillStyle = btn.isHovered ? btn.hoverColor : btn.color;
        this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        this.ctx.fillStyle = "black";
        this.ctx.font = "bold 16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(btn.text, btn.x + btn.width/2, btn.y + btn.height/2);
    }

    handleMouseMove(mouseX, mouseY) {
        let targetBtns = [];

        if (this.gameState === 'MENU') targetBtns = [this.startBtn];
        else if (this.gameState === 'GAME_OVER') targetBtns = [this.restartBtn];
        else if (this.gameState === 'VICTORY') targetBtns = [this.nextLevelBtn, this.menuBtn];
        else if (this.gameState === 'PLAYING') targetBtns = [this.drawActionBtn];

        let cursorActive = false;

        targetBtns.forEach(btn => {
            const hovering = this.isInside(mouseX, mouseY, btn);
            if (btn.isHovered !== hovering) {
                btn.isHovered = hovering;
                this.render();
            }
            if (hovering) cursorActive = true;
        });

        this.canvas.style.cursor = cursorActive ? 'pointer' : 'default';
    }

    isInside(x, y, btn) { return x > btn.x && x < btn.x + btn.width && y > btn.y && y < btn.y + btn.height; }
}