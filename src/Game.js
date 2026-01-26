import Deck from './Deck.js';

export default class Game {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets;
        
        // --- STATE MANAGEMENT ---
        // Options: 'MENU', 'PLAYING', 'GAME_OVER'
        this.gameState = 'MENU'; 

        // Game Logic Objects
        this.deck = new Deck();
        this.playerHand = [];
        this.tableCards = [];

        // Dimensions
        this.cardWidth = 100;
        this.cardHeight = 150;

        // --- BUTTONS CONFIGURATION ---
        // 1. Start Button (Centered)
        this.startBtn = {
            x: 300, y: 350, width: 200, height: 60,
            text: "JUGAR", color: "#ffd700", hoverColor: "#fff",
            isHovered: false
        };

        // 2. Draw Card Button (Bottom Right)
        this.drawBtn = {
            x: 650, y: 500, width: 120, height: 50,
            text: "PEDIR", color: "#d32f2f", hoverColor: "#ff6659",
            isHovered: false
        };
    }

    // --- LOGIC: SWITCHING STATES ---
    startGame() {
        this.deck.reset();
        this.playerHand = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
        this.tableCards = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
        
        this.gameState = 'PLAYING';
        this.render();
    }
    

    addPlayerCard() {
        if (this.playerHand.length < 6) {
            this.playerHand.push(this.deck.deal());
        }
    }
    

    render() {
        // 1. Clear the entire screen
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Decide what to draw based on State
        if (this.gameState === 'MENU') {
            this.drawMenuScene();
        } else if (this.gameState === 'PLAYING') {
            this.drawGameScene();
        }
    }

    drawMenuScene() {
        // Background
        this.ctx.fillStyle = "#1a1a1a"; // Dark Grey
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Title text
        this.ctx.fillStyle = "white";
        this.ctx.font = "bold 80px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("LA BARAJA", this.canvas.width / 2, 200);

        // Subtitle
        this.ctx.font = "20px Arial";
        this.ctx.fillStyle = "#aaa";
        this.ctx.fillText("Juego de Cartas Español", this.canvas.width / 2, 240);

        // Draw Start Button
        this.drawButton(this.startBtn);
    }


    drawGameScene() {
        // Green Background
        this.ctx.fillStyle = '#0a6c0a'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Cards
        this.drawHand(this.tableCards, 100, "Mesa");
        this.drawHand(this.playerHand, 400, "Jugador");

        // Draw "Pedir" Button
        this.drawButton(this.drawBtn);
    }
    



    isInside(x, y, btn) {
        return x > btn.x && x < btn.x + btn.width && y > btn.y && y < btn.y + btn.height;
    }

    drawButton(btn) {
        this.ctx.fillStyle = btn.isHovered ? btn.hoverColor : btn.color;
        this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        
        // Button Text color (Black text on Start, White on Pedir?)
        this.ctx.fillStyle = (btn.text === "JUGAR") ? "black" : "white";
        
        this.ctx.font = "bold 24px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(btn.text, btn.x + btn.width/2, btn.y + btn.height/2);
    }

    drawHand(cards, yPosition, label) {
        const gap = 20;
        const totalWidth = (cards.length * this.cardWidth) + ((cards.length - 1) * gap);
        let startX = (this.canvas.width - totalWidth) / 2;

        this.ctx.textAlign = "start"; // Reset alignment for text
        this.ctx.textBaseline = "alphabetic";
        this.ctx.fillStyle = "white";
        this.ctx.font = "20px Arial";
        this.ctx.fillText(label, startX, yPosition - 10);

        cards.forEach((cardId, index) => {
            const img = this.assets[cardId.toString()];
            const x = startX + index * (this.cardWidth + gap);
            this.ctx.drawImage(img, x, yPosition, this.cardWidth, this.cardHeight);
        });
    }


    handleClick(mouseX, mouseY) {
        if (this.gameState === 'MENU') {
            // Check Start Button
            if (this.isInside(mouseX, mouseY, this.startBtn)) {
                this.startGame();
            }
        } 
        else if (this.gameState === 'PLAYING') {
            // Check Pedir Button
            if (this.isInside(mouseX, mouseY, this.drawBtn)) {
                this.addCard();
            }
        }
    }

    handleMouseMove(mouseX, mouseY) {
        let needsRedraw = false;
        let activeCursor = false;

        // Determine which button to check based on state
        const targetBtn = (this.gameState === 'MENU') ? this.startBtn : this.drawBtn;

        // Check hover
        const currentlyHovering = this.isInside(mouseX, mouseY, targetBtn);
        
        if (targetBtn.isHovered !== currentlyHovering) {
            targetBtn.isHovered = currentlyHovering;
            needsRedraw = true;
        }

        if (currentlyHovering) activeCursor = true;

        // Update Cursor
        this.canvas.style.cursor = activeCursor ? 'pointer' : 'default';

        // Update Screen if something changed
        if (needsRedraw) this.render();
    }
}