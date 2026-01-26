import Card from './Card.js';

export default class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
        this.shuffle();
    }

    reset() {
        // Create array [1, 2, ..., 40]
        this.cards = Array.from({ length: 40 }, (_, i) => i + 1);
        this.shuffle();
    }

    draw() {
        return this.cards.pop(); // Returns the last card number
    }

    createDeck() {
        // Create cards 1 through 40
        for (let i = 1; i <= 40; i++) {
            this.cards.push(new Card(i));
        }
    }

    shuffle() {
        // Fisher-Yates Shuffle Algorithm
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
    
    remaining() {
        return this.cards.length;
    }
}