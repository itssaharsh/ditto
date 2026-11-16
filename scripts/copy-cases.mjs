// Copies recorded cases into the built console so the published site replays them with no backend.
import { cpSync, existsSync } from 'node:fs';
if (existsSync('cases')) cpSync('cases', 'web/dist/cases', { recursive: true });
console.log('cases copied into web/dist/cases');
