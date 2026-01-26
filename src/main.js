import Game from './Game.js';
import AssetLoader from './AssetLoader.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loader = new AssetLoader();

loader.loadAll().then((loadedAssets) => {
    const game = new Game(canvas, ctx, loadedAssets);
    
    // Initial Render (Shows the Menu)
    game.render();

    // Event Listeners
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        game.handleClick(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        game.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
    });
});