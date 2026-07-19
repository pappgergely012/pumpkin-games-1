import { W, H } from './constants.js';

export const canvas = document.getElementById('gameCanvas');
export const ctx    = canvas.getContext('2d');

canvas.width  = W;
canvas.height = H;
