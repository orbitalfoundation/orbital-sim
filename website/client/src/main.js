import './app.css';
import App from './App.svelte';

console.log('[orbital] build', __BUILD_DATE__);
import { mount } from 'svelte';

const app = mount(App, { target: document.getElementById('app') });

export default app;
