import Deck from './Deck.js';

export default class Game {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets;
        
        //this.gameState = 'MENU';
        this.gameState = 'INTRO'; 
        
        // Configuration
        this.introDuration = 2600;
        this.playIntroSequence();
        this.deck = new Deck();

        this.rows = 4;
        this.cols = 4;
        this.board = []; 
        this.maskBoard = [];
        this.discardPile = []; 

        this.animations = []; // Holds flying cards
        this.isAnimating = false; // Block input while animating
        this.isProcessing = false;

        this.cardWidth = 48;
        this.cardHeight = 76;
        this.gap = 22;
        
        const totalBoardWidth = (this.cols * this.cardWidth) + ((this.cols - 1) * this.gap);
        this.boardStartX = 103;//(canvas.width - totalBoardWidth) / 2;
        this.boardStartY = 75; 

        this.deckX = 21;
        this.deckY = 368;
        this.deckHovered = false;

        this.flushBtn = {
            x: 24, 
            y: 300, 
            width: 42, // <--- CHANGE to your image width
            height: 18, // <--- CHANGE to your image height
            state: 'normal' // normal, hover, pressed, disabled
        };
        this.flushCount = 2;
        this.maxFlush = 2;

        this.discardX = 21;
        this.discardY = 172;

        this.playerHand = []; 
        this.selectedCardIndex = -1; 
        this.playerHandY = 500; 

        this.level = 1;

        

        this.activeTooltip = null; // Will store { x, y, title, text }

        // Buttons
        const btnWidth = 200; 
        const btnHeight = 80;

        this.startBtn = {
            x: (this.canvas.width - btnWidth) / 2, // Centered X
            y: 400,                                // Position Y
            width: btnWidth,
            height: btnHeight,
            state: 'normal' // Options: 'normal', 'hover', 'pressed'
        };
        //this.startBtn = { x: 120, y: 350, width: 200, height: 60, text: "XOGAR", color: "#ffd700", hoverColor: "#fff", isHovered: false };
        this.restartBtn = { x: 120, y: 400, width: 200, height: 60, text: "REINTENTAR", color: "#d32f2f", hoverColor: "#ff6659", isHovered: false };
        this.nextLevelBtn = { x: 120, y: 350, width: 200, height: 60, text: "SEGUINTE NIVEL", color: "#00C851", hoverColor: "#00e25b", isHovered: false };
        this.menuBtn = { x: 120, y: 430, width: 200, height: 60, text: "MENU PRINCIPAL", color: "#33b5e5", hoverColor: "#62c9e5", isHovered: false };    
    }

    update() {
        if (this.animations.length === 0) {
            this.isAnimating = false;
            return;
        }
        if (this.animations.length > 0) {
            this.isAnimating = true;
            
            // Loop through backwards so we can remove items easily
            for (let i = this.animations.length - 1; i >= 0; i--) {
                const anim = this.animations[i];
                anim.progress += anim.speed;

                // --- TYPE 1: FLYING CARD (Movement) ---
                if (anim.type === 'fly') {
                    if (anim.progress >= 1) {
                        if (anim.targetType === 'hand') {
                            this.playerHand.unshift(anim.cardId);
                        } else if (anim.targetType === 'discard') {
                            this.discardPile.push(anim.cardId);
                        }
                        this.animations.splice(i, 1);
                        if (anim.onComplete) anim.onComplete();
                    } else {
                        // Linear Interpolation for position
                        anim.currentX = anim.startX + (anim.targetX - anim.startX) * anim.progress;
                        anim.currentY = anim.startY + (anim.targetY - anim.startY) * anim.progress;
                    }
                }
                
                // --- TYPE 2: EFFECT (Mask Wipe - Fade & Scale) ---
                else if (anim.type === 'effect') {
                    if (anim.progress >= 1) {
                        this.animations.splice(i, 1);
                        if (anim.onComplete) anim.onComplete();
                    } else {
                        // Fade Out: Alpha goes from 1.0 to 0.0
                        anim.alpha = 1 - anim.progress; 
                        // Scale Up: Grows from 1.0 to 1.5 (Ghost effect)
                        anim.scale = 1 + (anim.progress * 0.5); 
                    }
                }

                // --- TYPE 3: SHAKE (Wobble) ---
                else if (anim.type === 'shake') {
                    if (anim.progress >= 1) {
                        this.animations.splice(i, 1);
                        if (anim.onComplete) anim.onComplete();
                    } else {
                        // Math.sin(progress * Pi * Frequency) * Magnitude
                        // 4 * PI means 2 full shakes back and forth
                        anim.offsetX = Math.sin(anim.progress * Math.PI * 4) * 4; 
                    }
                }

                // --- NEW: SLIDE STACK (Card + Mask) ---
                else if (anim.type === 'slideStack') {
                    if (anim.progress >= 1) {
                        // Animation Done: Write data to the NEW slot
                        this.board[anim.destRow][anim.destCol] = anim.cardId;
                        this.maskBoard[anim.destRow][anim.destCol] = anim.maskName;
                        
                        this.animations.splice(i, 1);
                        if (anim.onComplete) anim.onComplete();
                    } else {
                        // Move
                        anim.currentX = anim.startX + (anim.targetX - anim.startX) * anim.progress;
                        anim.currentY = anim.startY + (anim.targetY - anim.startY) * anim.progress;
                    }
                }
            }
        }
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
        const masks = ['Felicidad', 'Tristeza', 'Ira', 'Conspirador'];
        //const masks = ['mascara_1', 'mascara_2', 'mascara_3', 'mascara_4'];

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
        if (this.isAnimating || this.isProcessing) return;
        if (this.gameState === 'INTRO') return;
        if (this.gameState === 'MENU') {
            if (this.isInside(mouseX, mouseY, this.startBtn)) {
                // 1. Set Visual State to PRESSED
                this.startBtn.state = 'pressed';
                this.render();

                setTimeout(() => {
                    this.gameState = 'PLAYING';
                    this.startBtn.state = 'normal'; // Reset for next time
                    this.render();
                    this.startGame();
                }, 150);
            }
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
            if (this.isAnimating || this.isProcessing) return;
            const wasTooltipOpen = this.activeTooltip !== null;
            this.activeTooltip = null;

            if (mouseX > this.deckX && mouseX < this.deckX + this.cardWidth &&
                mouseY > this.deckY && mouseY < this.deckY + this.cardHeight) {
                
                // Call the existing logic
                this.triggerDrawPenalty();
                return;
            }

            // Boton de roubo 
            /*
            if (this.isInside(mouseX, mouseY, this.drawActionBtn)) {
                this.triggerDrawPenalty();
                return;
            }*/

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

            if (this.isInside(mouseX, mouseY, this.flushBtn)) {
                
                // Ignore if disabled (Hand empty, etc.)
                if (this.flushBtn.state === 'disabled') return;

                // 1. Visual Press
                this.flushBtn.state = 'pressed';
                this.render();

                // 2. Logic Trigger (Small delay for visual feel)
                setTimeout(() => {
                    if (this.flushCount > 0) {
                        this.flushCount--;
                        this.triggerFlushAction(); 
                    }
                    this.flushBtn.state = 'normal';
                    this.render();
                }, 150);
                
                return;
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
            
            /*
            if (this.isInside(mouseX, mouseY, this.flushBtn)) {
                console.log("flush pressed")
                // Guard: If disabled (0 uses left), do nothing
                if (this.flushBtn.state === 'disabled') return;

                // 1. Visual Press
                this.flushBtn.state = 'pressed';
                this.render();

                // 2. Logic Trigger
                setTimeout(() => {
                    if (this.flushCount > 0) {
                        this.flushCount--;
                        this.triggerFlushAction(); 
                    }
                    this.flushBtn.state = 'normal';
                    this.render();
                }, 150);
                
                return;
            
            }*/
            this.render();
        }
    }

    triggerFlushAction() {
        console.log("Flush triggered! Sequence: Discard -> Deck -> Hand -> Deck -> Shuffle.");
        this.isProcessing = true;

        // Snapshot Data
        const originalHand = [...this.playerHand];
        const originalDiscard = [...this.discardPile];
        const drawAmount = originalHand.length;

        // Clear Logic
        //this.playerHand = [];
        this.discardPile = [];
        this.selectedCardIndex = -1;

        // Start Animation Chain
        // We pass a copy of discard for animation (which we will consume/pop)
        // AND a copy of originalDiscard for the final shuffle logic
        this.animateDiscardToDeck([...originalDiscard], originalDiscard, originalHand, drawAmount);
    }

    animateDiscardToDeck(animDiscardList, fullDiscardData, fullHandData, drawAmount) {
        if (animDiscardList.length === 0) {
            // Done with discard pile. Move to Hand.
            this.animateHandToDeck(fullDiscardData, fullHandData, drawAmount);
            return;
        }

        const cardId = animDiscardList.pop(); // Take one

        const startX = this.discardX; // Put your Discard X here (e.g. this.deckArea.x + 150)
        const startY = this.discardY;

        this.animations.push({
            type: 'fly',
            targetType: 'custom',
            cardId: cardId,
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY,
            targetX: this.deckX,
            targetY: this.deckY,
            progress: 0,
            speed: 0.05, // Fast!
            onComplete: () => {}
        });
        this.isAnimating = true;

        // Spawn next one in 50ms
        setTimeout(() => {
            this.animateDiscardToDeck(animDiscardList, fullDiscardData, fullHandData, drawAmount);
        }, 150);
    }



    animateHandToDeck(fullDiscardData, fullHandData, drawAmount) {
        // Wait 300ms for the last discard card to arrive
        setTimeout(() => {
            this.playerHand = [];
            if (fullHandData.length === 0) {
                this.performFlushShuffle(fullHandData, fullDiscardData, drawAmount);
                return;
            }

            let landedCount = 0;
            const handGap = 20; 
            const totalHandWidth = (fullHandData.length * this.cardWidth) + ((fullHandData.length - 1) * handGap);
            const handStartX = (this.canvas.width - totalHandWidth) / 2;

            fullHandData.forEach((cardId, index) => {
                const startX = handStartX + index * (this.cardWidth + handGap);
                
                this.animations.push({
                    type: 'fly',
                    targetType: 'custom',
                    cardId: cardId,
                    startX: startX,
                    startY: this.playerHandY,
                    currentX: startX,
                    currentY: this.playerHandY,
                    targetX: this.deckX,
                    targetY: this.deckY,
                    progress: 0,
                    speed: 0.08,
                    onComplete: () => {
                        landedCount++;
                        if (landedCount === fullHandData.length) {
                            // All cards are physically in the deck now.
                            this.performFlushShuffle(fullHandData, fullDiscardData, drawAmount);
                        }
                    }
                });
            });
            this.isAnimating = true;

        }, 300);
    }


    triggerMaskWipe(maskName, x, y, onCompleteCallback) {
        this.animations.push({
            type: 'effect',       // It's an effect, not a card movement
            assetKey: maskName,   // The image to draw (e.g., 'happy mask')
            currentX: x,
            currentY: y,          // Note: Effects stay in place (mostly)
            alpha: 1,             // Start fully visible
            scale: 1,             // Start normal size
            progress: 0,
            speed: 0.05,          // Speed of fade
            onComplete: onCompleteCallback
        });
        this.isAnimating = true;
    }



    triggerShakeAnimation(row, col, onCompleteCallback) {
        this.animations.push({
            type: 'shake',
            row: row,    // We need to know WHICH cell to shake
            col: col,
            offsetX: 0,  // Starts at 0
            progress: 0,
            speed: 0.02, // Fast shake
            onComplete: onCompleteCallback
        });
        this.isAnimating = true;
    }


    triggerSlideAnimation(row, col, nextRow, onCompleteCallback) {
        // 1. Capture Data
        const cardId = this.board[row][col];
        const maskName = this.maskBoard[row][col];
        
        // 2. Calculate Coordinates
        const startX = this.boardStartX + col * (this.cardWidth + this.gap);
        const startY = this.boardStartY + row * (this.cardHeight + this.gap);
        
        const targetX = startX; // Same column
        const targetY = this.boardStartY + nextRow * (this.cardHeight + this.gap);

        // 3. Clear the Old Spot Immediately (so it doesn't draw twice)
        this.board[row][col] = null;
        this.maskBoard[row][col] = null;

        // 4. Create Animation Object
        this.animations.push({
            type: 'slideStack', // New Type
            cardId: cardId,
            maskName: maskName,
            
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY,
            targetX: targetX,
            targetY: targetY,
            
            // Store destination index to write data later
            destRow: nextRow,
            destCol: col,
            
            progress: 0,
            speed: 0.02,
            onComplete: onCompleteCallback
        });
        this.isAnimating = true;
    }

    triggerDiscardAnimation(cardId, startX, startY, onCompleteCallback) {
        this.animations.push({
            type: 'fly',
            targetType: 'discard',
            cardId: cardId,
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY,
            targetX: this.discardX,
            targetY: this.discardY,
            progress: 0,
            speed: 0.02,
            onComplete: onCompleteCallback
        });
        this.isAnimating = true;
    }


    triggerFlyAnimation(cardId, startX, startY, onCompleteCallback) {
        // Target: Leftmost part of hand (calculated based on CURRENT hand size)
        // Note: Since we unshift, the visual target is roughly the start of the hand container
        const handGap = 20; 
        const futureHandSize = this.playerHand.length + 1;
        const totalHandWidth = (futureHandSize * this.cardWidth) + ((futureHandSize - 1) * handGap);
        const targetX = (this.canvas.width - totalHandWidth) / 2;
        const targetY = this.playerHandY;

        this.animations.push({
            type: 'fly',         // <--- IMPORTANT: Mark as 'fly'
            targetType: 'hand',
            cardId: cardId,
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY,
            targetX: targetX,
            targetY: targetY,
            progress: 0,
            speed: 0.02, // Speed of flight
            onComplete: onCompleteCallback // <--- Store the function to run later
        });
        
        this.isAnimating = true;
    }

    performFlushShuffle(handData, discardData, drawAmount) {
        // Logic: Add cards back
        this.deck.cards.push(...handData);
        this.deck.cards.push(...discardData);
        
        // Logic: Shuffle
        this.deck.shuffle();
        
        // Logic: Draw
        this.drawMultipleCards(drawAmount);
    }

    drawMultipleCards(totalNeeded) {
        let cardsDrawn = 0;

        // Recursive function to draw one card, wait, then draw the next
        const drawNext = () => {
            // Stop if we reached the target count
            if (cardsDrawn >= totalNeeded) {
                this.isProcessing = false; // UNLOCK GAME
                return;
            }

            const newCard = this.deck.draw();
            if (newCard) {
                cardsDrawn++;
                
                // Fly: Deck -> Hand
                this.triggerFlyAnimation(newCard, this.deckX, this.deckY, () => {
                    // Slight delay between cards for better feel
                    setTimeout(drawNext, 100); 
                });
            } else {
                // Deck is empty (Unlikely after a flush, but safe to handle)
                this.isProcessing = false;
            }
        };

        // Start the loop
        if (totalNeeded > 0) {
            drawNext();
        } else {
            this.isProcessing = false;
        }
    }

    drawCardWithAnimation(cardId) {
        // 1. Calculate where the card SHOULD land.
        // Since we are adding to the "Leftmost" (index 0), we assume it goes to the first slot.
        // We need to calculate what the X position of index 0 will be.
        
        // We simulate what the hand width WILL be + 1 card
        const handGap = 20; 
        const futureHandSize = this.playerHand.length + 1;
        const totalHandWidth = (futureHandSize * this.cardWidth) + ((futureHandSize - 1) * handGap);
        const startX = (this.canvas.width - totalHandWidth) / 2;
        
        // The leftmost slot is just startX
        const targetX = startX;
        const targetY = this.playerHandY;

        // 2. Create Animation Object
        this.animations.push({
            cardId: cardId,
            startX: this.deckX,
            startY: this.deckY,
            currentX: this.deckX,
            currentY: this.deckY,
            targetX: targetX,
            targetY: targetY,
            progress: 0,
            speed: 0.05 // 5% movement per frame (approx 1/3rd of a second)
        });
    }

    triggerDrawPenalty() {
        // 1. Guard Clauses: Don't run if animating OR if hand is full
        if (this.isAnimating || this.isProcessing) return; 
        if (this.playerHand.length >= 5) return;

        this.isProcessing = true; // LOCK

        // 1. Give Player a Card (Reward)
        const newCard = this.deck.draw();

        if (!newCard) {
            this.isProcessing = false;
            return;
        }


        this.triggerFlyAnimation(newCard, this.deckX, this.deckY, () => {
            setTimeout(() => {
                // 2. Identify all movable masks
                let candidates = [];

                for(let r = 0; r < this.rows; r++) {
                    for(let c = 0; c < this.cols; c++) {
                        if (this.maskBoard[r][c] !== null) {
                            
                            // Condition A: It's at the bottom edge (Game Over move)
                            if (r === this.rows - 1) {
                                candidates.push({row: r, col: c, gameOver: true});
                            } 
                            // Condition B: The spot below is empty (Standard move)
                            else if (this.board[r+1][c] === null) {
                                candidates.push({row: r, col: c, gameOver: false});
                            }
                        }
                    }
                }

                if (candidates.length > 0) {
                    // 3. Find "Most Behind" (The Smallest Row Index)
                    // We want to move the ones furthest from the finish line first.
                    let minRow = this.rows; // Start higher than possible (4)
                    
                    candidates.forEach(c => {
                        if (c.row < minRow) minRow = c.row;
                    });

                    // 4. Filter list to only include masks in that row
                    const priorityCandidates = candidates.filter(c => c.row === minRow);

                    // 5. Pick Randomly among the tied masks
                    const randomIndex = Math.floor(Math.random() * priorityCandidates.length);
                    const target = priorityCandidates[randomIndex];

                    if (target.gameOver) {
                        console.log("Game Over: Mask reached the end.");
                        this.gameState = 'GAME_OVER';
                    } else {
                        console.log(`Penalty: Mask at [${target.row},${target.col}] moved to [${target.row+1},${target.col}]`);
                        this.triggerSlideAnimation(target.row, target.col, target.row + 1, () => {
                            this.isProcessing = false; 
                        });
                        /*
                        // Move Logic
                        const r = target.row;
                        const c = target.col;
                        const nextR = r + 1;

                        // Move Card & Mask Data
                        this.board[nextR][c] = this.board[r][c];
                        this.maskBoard[nextR][c] = this.maskBoard[r][c];

                        // Clear old spot
                        this.board[r][c] = null;
                        this.maskBoard[r][c] = null;
                        */
                        
                        
                    }
                } else {
                    console.log("Lucky! No masks could move.");
                }

                this.render();
            }, 300);
        });


        
    }

    getCardValue(id) { return (id - 1) % 10 + 1; }
    getCardSuit(id) { return Math.floor((id - 1) / 10); }

    checkBattleWin(maskName, playerCardId, boardCardId) {
        const pVal = this.getCardValue(playerCardId);
        const bVal = this.getCardValue(boardCardId);
        const pSuit = this.getCardSuit(playerCardId);
        const bSuit = this.getCardSuit(boardCardId);

        switch (maskName) {
            case "Felicidad":
                return pVal > bVal;
            
            case "Tristeza": 
                return pVal < bVal;
            
            case "Conspirador":
                return pSuit === bSuit;
            
            case "Ira": 
                return pVal === bVal;
                

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
        const targetMask = this.maskBoard[row][col];
        if (!targetMask) return; 
        
        
        // 1. INFO MODE: No card selected + Clicked on a Mask
        if (this.selectedCardIndex === -1) {
            if (targetMask) {
                // Calculate position above the card
                const cellX = this.boardStartX + col * (this.cardWidth + this.gap);
                const cellY = this.boardStartY + row * (this.cardHeight + this.gap);
                
                this.activeTooltip = {
                    x: cellX + this.cardWidth / 2, // Center X
                    y: cellY - 15,                 // Slightly above the card
                    title: targetMask.toUpperCase(),
                    text: this.getMaskDescription(targetMask)
                };
            }
            this.render();
            return; // Stop here, don't try to battle
        }

        this.isProcessing = true; // Lock
        const targetCardValue = this.board[row][col];
        const playedCard = this.playerHand[this.selectedCardIndex]; 
        
        // Calculate Win/Loss
        const playerWins = this.checkBattleWin(targetMask, playedCard, targetCardValue);

        // --- PREPARE FOR ANIMATION ---
        
        // 1. Calculate Hand Coordinates (Where the card starts flying from)
        const handGap = 20; 
        const totalHandWidth = (this.playerHand.length * this.cardWidth) + ((this.playerHand.length - 1) * handGap);
        const handStartX = (this.canvas.width - totalHandWidth) / 2;
        const cardHandX = handStartX + this.selectedCardIndex * (this.cardWidth + handGap);
        const cardHandY = this.playerHandY;


        if (playerWins) {
            console.log("WIN!");
            // (Your existing Win Sequence with Ghost Wipe)
            //this.maskBoard[row][col] = null;
            this.playerHand.splice(this.selectedCardIndex, 1);
            this.selectedCardIndex = -1; // Reset selection
            // ANIMATION: Hand -> Discard
            this.triggerDiscardAnimation(playedCard, cardHandX, cardHandY, () => {
                // After discard lands, do the capture logic
                const cellX = this.boardStartX + col * (this.cardWidth + this.gap);
                const cellY = this.boardStartY + row * (this.cardHeight + this.gap);
                const capturedCardId = this.board[row][col];

                this.triggerMaskWipe(targetMask, cellX, cellY, () => {
                    this.maskBoard[row][col] = null;
                    setTimeout(() => {
                        this.board[row][col] = null;
                        this.triggerFlyAnimation(capturedCardId, cellX, cellY, () => {
                            if (this.checkVictory()) {
                                this.gameState = 'VICTORY';
                                return;
                            }
                            if (this.playerHand.length < 5) {
                                const extraCard = this.deck.draw();
                                if (extraCard) {
                                    this.triggerFlyAnimation(extraCard, this.deckX, this.deckY, () => {
                                        this.isProcessing = false;
                                    });
                                } else {
                                    this.isProcessing = false; 
                                }
                            } else {
                                console.log("Hand full (5/5). No extra card drawn.");
                                this.isProcessing = false;
                            }
                            //const extraCard = this.deck.draw();
                            //if (extraCard) this.triggerFlyAnimation(extraCard, this.deckX, this.deckY, null);
                        });
                    }, 1000);
                });
            });

        } else {
            console.log("LOSE!");
            
            // --- SEQUENCE: SHAKE -> DISCARD -> PENALTY ---

            // 1. Trigger Shake
            this.triggerShakeAnimation(row, col, () => {

                this.playerHand.splice(this.selectedCardIndex, 1);
                this.selectedCardIndex = -1; // Reset selection

                // 2. Shake Done: Fly Card to Discard
                this.triggerDiscardAnimation(playedCard, cardHandX, cardHandY, () => {
                    
                    // 3. Flight Done: Apply Penalty Logic
                    if (row === this.rows - 1) {
                        this.gameState = 'GAME_OVER';
                        this.render();
                        return; 
                    }

                    const nextRow = row + 1;
                    if (nextRow < this.rows && this.board[nextRow][col] === null) {
                        // 3. NEW: Slide Animation
                        this.triggerSlideAnimation(row, col, nextRow, () => {
                            // Roba carta ao rematar o movemento
                            const newCard = this.deck.draw();
                            if (newCard) {
                                this.triggerFlyAnimation(newCard, this.deckX, this.deckY, () => {
                                    this.isProcessing = false; 
                                });
                            } else {
                                this.isProcessing = false;
                            }
                        });
                        /*
                        this.board[nextRow][col] = this.board[row][col];
                        this.board[row][col] = null;
                        this.maskBoard[nextRow][col] = this.maskBoard[row][col];
                        this.maskBoard[row][col] = null;
                        */
                    }

                    

                    // 4. Draw Replacement Card
                    //const newCard = this.deck.draw();
                    //if (newCard) {
                    //    this.triggerFlyAnimation(newCard, this.deckX, this.deckY, null);
                    //}
                });
            });
        }
    
    }

    drawVictoryScene() {
        this.ctx.fillStyle = "#0d2b0d"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#ffd700"; 
        this.ctx.font = "20px Minipixel";//"bold 60px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("¡VICTORIA!", this.canvas.width / 2, 200);

        this.ctx.fillStyle = "white";
        this.ctx.font = "10px Minipixel"//"30px Arial";
        this.ctx.fillText(`Nivel ${this.level} Completado`, this.canvas.width / 2, 260);

        this.drawButton(this.nextLevelBtn);
        this.drawButton(this.menuBtn);
    }

    drawGameOverScene() {
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#ff4444"; 
        this.ctx.font = "20px Minipixel"//"bold 80px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("FIN DO XOGO", this.canvas.width / 2, 250);

        this.ctx.fillStyle = "white";
        this.ctx.font = "10px Minipixel"//"24px Arial";
        this.ctx.fillText("A máscara chegou ao final.", this.canvas.width / 2, 300);

        this.drawButton(this.restartBtn);
    }

    drawGameScene() {
        let boardKey = 'board'; // Default (Normal)
        if (this.playerHand.length >= 5 || this.isProcessing) {
            boardKey = 'board_disabled';
        }
        const boardImg = this.assets[boardKey];
        if (boardImg) {
            // Option A: Stretch to fit the canvas
            this.ctx.drawImage(boardImg, 0, 0, this.canvas.width, this.canvas.height);
            
            // Option B: If the board is a specific size (e.g. 800x600) and you want to center it:
            // const x = (this.canvas.width - boardImg.width) / 2;
            // const y = (this.canvas.height - boardImg.height) / 2;
            // this.ctx.drawImage(boardImg, x, y);
        } else {
            // Fallback color if image fails to load
            this.ctx.fillStyle = '#0a6c0a'; 
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.fillStyle = "rgba(0,0,0,0.3)";
        this.ctx.font = "15px minipixel";//"bold 20px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`NIVEL: ${this.level}`, 20, 30);


        // DRAW BUTTON STATE LOGIC
        /*
        if (this.playerHand.length >= 5) {
            // Disabled State (Grey)
            this.drawActionBtn.color = "#555555"; 
            this.drawActionBtn.hoverColor = "#555555"; 
            this.drawActionBtn.text = "MAX (5)"; // Optional: Change text to explain why
        } else {
            // Active State (Orange)
            this.drawActionBtn.color = "#ff8800"; 
            this.drawActionBtn.hoverColor = "#ffaa44"; 
            this.drawActionBtn.text = "ROBAR";
        }
        */
        //this.drawButton(this.drawActionBtn);

        const backImg = this.assets['back'];
        if (backImg) {
            this.ctx.drawImage(backImg, this.deckX, this.deckY, this.cardWidth, this.cardHeight);
            this.ctx.drawImage(backImg, this.deckX, this.deckY, this.cardWidth, this.cardHeight-3);
            this.ctx.drawImage(backImg, this.deckX, this.deckY, this.cardWidth, this.cardHeight-6);
            this.ctx.drawImage(backImg, this.deckX, this.deckY, this.cardWidth, this.cardHeight-9);
        }
        // Indicador de cartas restantes
        const cardsLeft = this.deck.cards.length;
        
        //this.ctx.fillStyle = "black";
        this.ctx.fillStyle = "rgba(0,0,0,0.3)";
        this.ctx.font = "12px Minipixel";
        this.ctx.textAlign = "center";
        
        // Position: Centered horizontally on the deck, and slightly below it
        const textX = this.deckX + (this.cardWidth / 2);
        const textY = this.deckY + this.cardHeight + 30; 

        this.ctx.fillText(`${cardsLeft}/40`, textX, textY);
        
        if (this.discardPile.length > 0) {
            const topCard = this.discardPile[this.discardPile.length - 1];
            const img = this.assets[topCard.toString()];
            this.ctx.drawImage(img, this.discardX, this.discardY, this.cardWidth, this.cardHeight);
        } 
        /*else {
            this.ctx.strokeStyle = "rgba(0,0,0,0.3)";
            this.ctx.strokeRect(this.discardX, this.discardY, this.cardWidth, this.cardHeight);
        }*/
        

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                let x = this.boardStartX + col * (this.cardWidth + this.gap);
                let y = this.boardStartY + row * (this.cardHeight + this.gap);

                
                const cardValue = this.board[row][col];
                if (cardValue !== null) {
                    const img = this.assets[cardValue.toString()];
                    this.ctx.drawImage(img, x, y, this.cardWidth, this.cardHeight);
                }
                // 2. CHECK FOR SHAKE anim
                const activeShake = this.animations.find(a => a.type === 'shake' && a.row === row && a.col === col);
                if (activeShake) {
                    x += activeShake.offsetX; // Apply the wobble to X
                }
                    

                const maskValue = this.maskBoard[row][col];
                if (maskValue !== null) {
                    const maskImg = this.assets[maskValue];
                    if (maskImg) this.ctx.drawImage(maskImg, x, y - 3, this.cardWidth, this.cardHeight);
                }
            }
        }

        // DRAW FLUSH
        const isFlushDisabled = this.flushCount === 0 || 
                                this.playerHand.length === 0 || 
                                this.isProcessing || 
                                this.isAnimating;

        // 2. Determine Visual State
        let flushKey = 'flush_normal'; // Default

        if (isFlushDisabled) {
            flushKey = 'flush_disabled';
            this.flushBtn.state = 'disabled'; // Sync logical state
        } else if (this.flushBtn.state === 'pressed') {
            flushKey = 'flush_pressed';
        } else if (this.flushBtn.state === 'hover') {
            flushKey = 'flush_hover';
        } else {
            this.flushBtn.state = 'normal';
        }

        // 3. Draw
        const flushImg = this.assets[flushKey];
        if (flushImg) {
            this.ctx.drawImage(flushImg, 
                this.flushBtn.x, 
                this.flushBtn.y, 
                this.flushBtn.width, 
                this.flushBtn.height
            );
        }
        // Draw Counter Text (e.g., "2/2")
        this.ctx.fillStyle = "black";
        this.ctx.font = "8px Minipixel"; 
        this.ctx.textAlign = "center";
        
        // Position it 10px above the button
        const textFlushX = this.flushBtn.x + (this.flushBtn.width / 2);
        const textFlushY = this.flushBtn.y - 5; 
        
        this.ctx.fillText(`${this.flushCount}/${this.maxFlush}`, textFlushX, textFlushY);

        // --- UPDATED: Draw Hand ---
        if (this.playerHand.length > 0) {
            //this.ctx.fillStyle = "white";
            //this.ctx.font = "bold 16px Arial";
            //this.ctx.textAlign = "center";
            //this.ctx.fillText("TU MANO", this.canvas.width / 2, this.playerHandY - 10);

            const handGap = 10; 
            const totalHandWidth = (this.playerHand.length * this.cardWidth) + ((this.playerHand.length - 1) * handGap);
            const startX = (this.canvas.width - totalHandWidth) / 2;

            this.playerHand.forEach((cardId, index) => {
                const img = this.assets[cardId.toString()];
                // Note: If we just finished an animation (unshift), the other cards might jump instantly to the right.
                // This is normal for simple games.
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
        

        // --- DRAW ACTIVE ANIMATIONS ---
        this.animations.forEach(anim => {
            
            // 1. Draw Flying Cards
            if (anim.type === 'fly') {
                const img = this.assets[anim.cardId.toString()];
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = "rgba(0,0,0,0.5)";
                this.ctx.drawImage(img, anim.currentX, anim.currentY, this.cardWidth, this.cardHeight);
                this.ctx.shadowBlur = 0;
            } 
            
            // 2. Draw Effects (Fading Masks)
            else if (anim.type === 'effect') {
                const img = this.assets[anim.assetKey];
                
                this.ctx.save(); // Save context state
                
                // Apply Fade
                this.ctx.globalAlpha = anim.alpha; 
                
                // Apply Scale (Centered)
                // To scale from center, we translate to center, scale, then draw at -width/2
                const centerX = anim.currentX + this.cardWidth / 2;
                const centerY = anim.currentY + this.cardHeight / 2;
                
                this.ctx.translate(centerX, centerY);
                this.ctx.scale(anim.scale, anim.scale);
                
                // Draw mask (with the -5 offset logic if you want the visual consistency)
                this.ctx.drawImage(img, -this.cardWidth/2, -this.cardHeight/2 - 5, this.cardWidth, this.cardHeight);
                
                this.ctx.restore(); // Restore context (remove fade/scale for next drawings)
            }

            else if (anim.type === 'slideStack') {
                // Draw Card
                const cardImg = this.assets[anim.cardId.toString()];
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = "rgba(0,0,0,0.5)";
                this.ctx.drawImage(cardImg, anim.currentX, anim.currentY, this.cardWidth, this.cardHeight);
                
                // Draw Mask (with -5 offset)
                const maskImg = this.assets[anim.maskName];
                if (maskImg) {
                    this.ctx.drawImage(maskImg, anim.currentX, anim.currentY - 5, this.cardWidth, this.cardHeight);
                }
                this.ctx.shadowBlur = 0;
            }
        });

        if (this.activeTooltip) {
            this.drawTooltip(this.activeTooltip);
        }

    }


    drawTooltip(tip) {
        this.ctx.save();

        // 1. Measure Text & Calculate Box Size
        this.ctx.font = "14px Minipixel"; 
        const titleWidth = this.ctx.measureText(tip.title).width;
        
        this.ctx.font = "12px Minipixel"; 
        const bodyWidth = this.ctx.measureText(tip.text).width;
        
        const boxWidth = Math.max(titleWidth, bodyWidth) + 30; 
        const boxHeight = 50;

        // 2. Determine Position: UP or DOWN?
        
        // Default: UP (Above the mask)
        // We assume tip.y is set to (cellY - 15) by the interaction logic
        let boxX = tip.x - boxWidth / 2;
        let boxY = tip.y - boxHeight;
        let arrowY = tip.y; // The point where the arrow touches the mask
        let arrowDirection = 'down'; // Arrow points down to the mask

        // CHECK: Is it going off the top screen edge?
        // We add a safety margin (e.g., 10px)
        if (boxY < 10) {
            // FLIP TO DOWN
            // We need to know the card height to place it below. 
            // Since we don't pass card height to this function, we can estimate 
            // or pass "tip.targetHeight" in the future.
            // For now, let's assume tip.y was "top of card - 15".
            // So "bottom of card" is roughly tip.y + cardHeight + 15.
            
            // A simpler approach without changing Interaction Logic:
            // Just move it down by (Box Height + Card Height + Spacing)
            const approxCardHeight = 120; 
            
            boxY = tip.y + approxCardHeight + 20; // Move below card
            arrowY = boxY; // Arrow starts at top of box
            arrowDirection = 'up'; // Arrow points up to the mask
        }

        // CHECK: Is it going off the Left or Right edges? (Optional Polish)
        if (boxX < 10) boxX = 10; // Clamp Left
        if (boxX + boxWidth > this.canvas.width - 10) boxX = this.canvas.width - boxWidth - 10; // Clamp Right


        // 3. Draw Box Shadow
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(boxX + 3, boxY + 3, boxWidth, boxHeight);

        // 4. Draw Box Background
        this.ctx.fillStyle = "#222"; 
        this.ctx.strokeStyle = "#ffd700"; 
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // 5. Draw Arrow (Dynamic Direction)
        this.ctx.beginPath();
        this.ctx.fillStyle = "#ffd700";

        if (arrowDirection === 'down') {
            // Box is above, Arrow points DOWN to tip.y
            // We draw the arrow at the bottom of the box
            const bottomOfBox = boxY + boxHeight;
            // Ensure arrow centers on the target, relative to clamped box
            // But visually, simpler to just center on tip.x
            this.ctx.moveTo(tip.x - 5, bottomOfBox);
            this.ctx.lineTo(tip.x + 5, bottomOfBox);
            this.ctx.lineTo(tip.x, bottomOfBox + 5);
        } else {
            // Box is below, Arrow points UP to mask
            // We draw the arrow at the top of the box
            this.ctx.moveTo(tip.x - 5, boxY);
            this.ctx.lineTo(tip.x + 5, boxY);
            this.ctx.lineTo(tip.x, boxY - 5);
        }
        this.ctx.fill();

        // 6. Draw Text
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        // Recalculate text center based on the final boxX
        const textCenterX = boxX + boxWidth / 2;
        const textCenterY = boxY + boxHeight / 2;

        this.ctx.fillStyle = "#ffd700";
        this.ctx.font = "12px Minipixel";
        this.ctx.fillText(tip.title, textCenterX, boxY + 15);

        this.ctx.fillStyle = "white";
        this.ctx.font = "10px Minipixel";
        this.ctx.fillText(tip.text, textCenterX, boxY + 35);

        this.ctx.restore();
    }


    getMaskDescription(maskName) {
        // Helper to format text (Upper Case first letter)
        const formatName = (name) => name.charAt(0).toUpperCase() + name.slice(1);

        switch (maskName) {
            case "Felicidad": 
                return "Require carta con MAIOR valor.";
            case "Tristeza":   
                return "Require carta con MENOR valor.";
            case "Ira": 
                return "Require carta co MESMO valor.";
            case "Conspirador": 
                return "Require carta do MESMO pao.";
            case "Cinismo":
                return "Require carta dun pao e número diferente.";
            // Add others here...
            case "Codicia":
                return "Requiere carta de OUROS.";
            default: 
                return "???";
        }
    }

    playIntroSequence() {
        // 1. Find the container we just made
        const container = document.getElementById('game-container');

        // 2. Create the GIF
        const introImg = document.createElement('img');
        introImg.src = './spanish_deck/menuIntro.gif'; 
        
        // 3. Style it to overlay perfectly
        introImg.style.position = 'absolute';
        introImg.style.top = '0';
        introImg.style.left = '0';
        //introImg.style.width = '100%';  // Matches container/canvas width
        //introImg.style.height = '100%'; // Matches container/canvas height
        introImg.style.zIndex = '10';   // Sit on top of canvas
        
        // Optional: Ensure it doesn't mess with clicks if you want to skip it
        // introImg.style.pointerEvents = 'none'; 

        // 4. Add to the container
        container.appendChild(introImg);

        // 5. Remove after duration
        setTimeout(() => {
            introImg.remove();
            this.gameState = 'MENU';
            // Force a re-render to show the menu immediately
            this.render(); 
        }, this.introDuration);
    }

    drawMenuScene() {
        // 1. Draw Background
        const menuBg = this.assets['menu_bg'];
        if (menuBg) {
             this.ctx.drawImage(menuBg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
             this.ctx.fillStyle = "#1a1a1a";
             this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 2. Draw Start Button based on State
        let btnKey = 'btn_normal'; // Default

        if (this.startBtn.state === 'hover') {
            btnKey = 'btn_hover';
        } else if (this.startBtn.state === 'pressed') {
            btnKey = 'btn_pressed';
        }

        const btnImg = this.assets[btnKey];
        if (btnImg) {
            this.ctx.drawImage(btnImg, 
                this.startBtn.x, 
                this.startBtn.y, 
                this.startBtn.width, 
                this.startBtn.height
            );
        }
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
        //else if (this.gameState === 'PLAYING') targetBtns = [this.drawActionBtn];

        let cursorActive = false;

        // Non sei
        if (this.gameState === 'MENU') {
            const hovering = this.isInside(mouseX, mouseY, this.startBtn);
            
            // Only update if we aren't currently clicking it (pressed)
            if (this.startBtn.state !== 'pressed') {
                if (hovering) {
                    this.startBtn.state = 'hover';
                    cursorActive = true;
                } else {
                    this.startBtn.state = 'normal';
                }
            }
        }
        // Non sei

        targetBtns.forEach(btn => {
            const hovering = this.isInside(mouseX, mouseY, btn);
            if (btn.isHovered !== hovering) {
                btn.isHovered = hovering;
                this.render();
            }
            if (hovering) cursorActive = true;
        });

        // --- NEW: FLUSH BTN HOVER ---
        // Only interact if NOT disabled and NOT currently pressed
        if (this.flushBtn.state !== 'disabled' && this.flushBtn.state !== 'pressed') {
            if (this.isInside(mouseX, mouseY, this.flushBtn)) {
                this.flushBtn.state = 'hover';
                cursorActive = true;
            } else {
                this.flushBtn.state = 'normal';
            }
        }

        this.canvas.style.cursor = cursorActive ? 'pointer' : 'default';
        this.render();

        
    }

    isInside(x, y, btn) { return x > btn.x && x < btn.x + btn.width && y > btn.y && y < btn.y + btn.height; }
}