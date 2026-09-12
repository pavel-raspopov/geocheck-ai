import './styles.css';
import { createApp } from './ui/app';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Элемент #app не найден');
}

createApp(app);
