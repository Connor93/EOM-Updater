const { ipcRenderer } = require('electron');
const output = document.getElementById('output');
const progressBar = document.getElementById('progressBar');
const playBtn = document.getElementById('playBtn');
const newsBox = document.querySelector('.news');

function log(msg) {
  const line = document.createElement('div');
  line.textContent = msg;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  if (output.children.length > 200) output.removeChild(output.firstChild);
}

function enablePlayButton() {
  playBtn.classList.add('enabled');
  playBtn.disabled = false;
}

function loadNews() {
  fetch('https://endless-memories.net/data/news.php')
    .then(res => res.json())
    .then(newsArray => {
      newsBox.innerHTML = ''; 
      for (const entry of newsArray) {
        const p = document.createElement('p');
        p.textContent = entry.content;
        newsBox.appendChild(p);
        newsBox.appendChild(document.createElement('br'));
      }
    })
    .catch(err => {
      const errMsg = 'Failed to load news: ' + err.message;
      console.error(errMsg);
      const errorEl = document.createElement('p');
      errorEl.textContent = errMsg;
      newsBox.appendChild(errorEl);
    });
}

ipcRenderer.on('sync-progress', (_, msg) => log(msg));

ipcRenderer.on('sync-progress-percent', (_, percent) => {
  progressBar.value = percent;
});

ipcRenderer.on('auto-start-sync', () => {
  output.textContent = '';
  progressBar.value = 0;
  playBtn.disabled = true;
  playBtn.classList.remove('enabled');
  loadNews();

  ipcRenderer.invoke('start-sync', { localDir: '' })
    .then(msg => {
      log(msg);
      const lowerMsg = msg.toLowerCase();
      const completionMessages = [
        'no update needed. version is up to date.',
        'update check failed. please try again later.',
        'update download failed. please try again later.'
      ];
      if (completionMessages.some(m => lowerMsg.includes(m))) {
        enablePlayButton();
      }
    })
    .catch(err => log('Error: ' + err));
});

playBtn.addEventListener('click', () => {
  if (!playBtn.disabled) ipcRenderer.send('launch-game');
});