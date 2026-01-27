export default class AssetLoader {
    constructor() {
        this.images = {}; // Will hold { "1": Image, "2": Image ... "back": Image }
        this.totalImages = 41; // 40 cards + 1 back
        this.loadedCount = 0;
    }

    async loadAll() {
        const promises = [];

        // 1. Load cards 1-40
        for (let i = 1; i <= 40; i++) {
            promises.push(this.loadImage(i.toString(), `./spanish_deck/${i}.png`));
        }

        // 2. Load the back
        promises.push(this.loadImage('back', `./spanish_deck/back.png`));

        // 2. Load Mascaras 1-4 (NEW)
        for (let i = 1; i <= 4; i++) {
            const name = `mascara_${i}`;
            promises.push(this.loadImage(name, `./spanish_deck/${name}.png`));
        }

        // Wait for all to finish
        await Promise.all(promises);
        return this.images;
    }

    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => { this.images[key] = img; resolve(img); };
            img.onerror = () => { console.error(`Error loading ${src}`); reject(); };
        });
    }
}