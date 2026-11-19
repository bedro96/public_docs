import { boot } from './live.js';

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
