// ==========================================
// 1. VARIABLES GLOBALES Y ELEMENTOS DEL DOM
// ==========================================
const audioPlayer = document.getElementById('audioPlayer');
const progressBar = document.getElementById('progressBar');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const lyricsDisplay = document.getElementById('lyricsDisplay');

let parsedLyrics = [];
let searchResults = [];
let currentArtist = '';
let currentCoverUrl = '';
let currentActiveIndex = -1;

// ==========================================
// 2. CONTROLES DEL REPRODUCTOR
// ==========================================

// actualiza los iconos de play/pausa
function updatePlayIcons() {
  if (audioPlayer.paused) {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    // Pausa el giro en el ángulo exacto donde está
    playPauseBtn.classList.remove('is-playing');
  } else {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    // Reanuda el giro
    playPauseBtn.classList.add('is-playing');
  }
}

// botón pausa y play
playPauseBtn.addEventListener('click', () => {
  audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
  updatePlayIcons();
});

// cuando la canción termina
audioPlayer.addEventListener('ended', updatePlayIcons);

// barra de progreso (arrastrar)
progressBar.addEventListener('input', () => {
  audioPlayer.currentTime = progressBar.value;
});

// ==========================================
// 3. NAVEGACIÓN Y UTILIDADES
// ==========================================

function showView(viewId) {
  const current = document.querySelector('.view.active');
  const next = document.getElementById(viewId);

  if (!current || current === next) {
    next.classList.add('visible');
    requestAnimationFrame(() => next.classList.add('active'));
    return;
  }

  current.classList.remove('active');
  setTimeout(() => {
    current.classList.remove('visible');
    next.classList.add('visible');
    requestAnimationFrame(() => next.classList.add('active'));
  }, 500);
}

// formato de tiempo (Minutos:Segundos)
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// reiniciar
function resetApp() {
  audioPlayer.pause();
  audioPlayer.src = '';
  document.getElementById('lyricsDisplay').innerHTML = '';
  document.getElementById('displayTitle').innerText = '';
  document.getElementById('albumCover').classList.add('hidden');
  document.getElementById('searchInput').value = '';
  currentActiveIndex = -1;
  document.getElementById('readyFalls').innerHTML = '';
  currentArtist  = '';
  currentCoverUrl = '';
  showView('view-search');
}

// ==========================================
// 4. BÚSQUEDA Y CARGA DE DATOS
// ==========================================

async function fetchCoverArt(artist, track) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + track)}&entity=song&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
    }
  } catch (e) {
    console.error("Error obteniendo portada:", e);
  }
  return null;
}

async function buscarCancion() {
  const query = document.getElementById('searchInput').value;
  const list = document.getElementById('resultsList');

  if (!query) return; // evita buscar si el input está vacío

  list.innerHTML = '<p class="text-gray-400">Buscando...</p>';

  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
    searchResults = await res.json();
    list.innerHTML = '';

    searchResults.forEach((track) => {
      const div = document.createElement('div');
      div.className = 'p-3 bg-[#181818] hover:bg-gray-700 cursor-pointer rounded-lg text-sm transition';
      div.innerText = `${track.trackName} - ${track.artistName} - ${formatTime(track.duration)}`;

      div.onclick = async () => {
        if (!track.syncedLyrics) {
          list.innerHTML = '<p class="text-yellow-400 text-sm p-2">⚠️ Esta canción no tiene letra sincronizada.</p>';
          return;
        }


        const coverUrl = await fetchCoverArt(track.artistName, track.trackName);

        currentCoverUrl = coverUrl || '';
        currentArtist = track.artistName;

        const coverImg = document.getElementById('albumCover');
        if (coverUrl) {
          // 1. FUNDAMENTAL: Permitir extraer color de otra web sin bloqueos de seguridad
          coverImg.crossOrigin = "Anonymous";

          // 2. Extraer el color cuando la imagen termine de cargar
          coverImg.onload = () => {
            try {
              const colorThief = new ColorThief();
              const color = colorThief.getColor(coverImg);

              // 3. Cambiar la variable CSS en todo el documento
              const rgbColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
              document.documentElement.style.setProperty('--accent-color', rgbColor);
              document.documentElement.style.setProperty('--shadow-color', rgbColor);
              document.title = `${track.trackName} - ${track.artistName}`;
            } catch (e) {
              console.warn("No se pudo extraer el color, usando color por defecto.", e);
              document.documentElement.style.setProperty('--accent-color', '#1db954');
            }
          };

          // Asignamos la imagen (esto dispara el evento onload de arriba)
          coverImg.src = coverUrl;
          createFallingCovers(coverUrl);
          coverImg.classList.remove('hidden');
        } else {
          coverImg.classList.add('hidden');
          document.documentElement.style.setProperty('--accent-color', '#1db954');
        }

        parseLRC(track.syncedLyrics);
        document.getElementById('selectedTitle').innerText = track.trackName;
        document.getElementById('displayTitle').innerText = track.trackName;
        document.getElementById('duration').innerText = formatTime(track.duration);
        showView('view-upload');
      };

      list.appendChild(div);
    });
  } catch (error) {
    list.innerHTML = '<p class="text-red-500">Error al buscar la canción.</p>';
  }
}

// cargar MP3 local
document.getElementById('audioUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src);
  audioPlayer.src = URL.createObjectURL(file);

  document.getElementById('readyAlbumCover').src = currentCoverUrl;
  document.getElementById('readyTitle').innerText  = document.getElementById('displayTitle').innerText;
  document.getElementById('readyArtist').innerText = currentArtist;

  if (currentCoverUrl) createFallingCovers(currentCoverUrl, 'readyFalls');

  showView('view-ready');
});

function startPlaying() {
  showView('view-player');
  audioPlayer.play().catch(err => console.warn("Autoplay bloqueado:", err));
  updatePlayIcons();
}

// ==========================================
// 5. LÓGICA DE LETRAS (LRC) Y SINCRONIZACIÓN
// ==========================================

function parseLRC(lrcText) {
  parsedLyrics = [];
  currentActiveIndex = -1; // Reseteamos el índice al cargar nueva canción

  const lines = lrcText.split('\n');
  const timeRegex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/;

  lines.forEach((line) => {
    const match = timeRegex.exec(line);
    if (match) {
      const totalTime = (parseInt(match[1]) * 60) + parseFloat(match[2]);
      const text = match[3].trim();
      if (text) parsedLyrics.push({ time: totalTime, text: text });
    }
  });

  lyricsDisplay.innerHTML = parsedLyrics.map((l, i) =>
    `<div class="lyric-line cursor-pointer hover:text-white transition p-2" id="line-${i}" data-time="${l.time}">
       ${l.text}
     </div>`
  ).join('');
}

// saltar a tiempo específico al hacer clic en la letra
lyricsDisplay.addEventListener('click', (e) => {
  const targetLine = e.target.closest('.lyric-line');
  if (targetLine) {
    const time = parseFloat(targetLine.getAttribute('data-time'));
    if (!isNaN(time)) {
      audioPlayer.currentTime = time;
      audioPlayer.play();
      updatePlayIcons(); // Actualizamos el botón de pausa
    }
  }
});

// metadatos cargados (Duración total)
audioPlayer.addEventListener('loadedmetadata', () => {
  progressBar.max = audioPlayer.duration;
  document.getElementById('totalTime').innerText = formatTime(audioPlayer.duration);
});

// sincronización en tiempo real
audioPlayer.addEventListener('timeupdate', () => {
  progressBar.value = audioPlayer.currentTime;
  document.getElementById('currentTime').innerText = formatTime(audioPlayer.currentTime);

  if (parsedLyrics.length === 0) return;

  let newActiveIndex = -1;
  for (let i = parsedLyrics.length - 1; i >= 0; i--) {
    if (audioPlayer.currentTime >= parsedLyrics[i].time) {
      newActiveIndex = i;
      break;
    }
  }

  if (newActiveIndex !== -1 && newActiveIndex !== currentActiveIndex) {
    if (currentActiveIndex !== -1) {
      const oldEl = document.getElementById(`line-${currentActiveIndex}`);
      if (oldEl) oldEl.classList.remove('active');
    }

    const newEl = document.getElementById(`line-${newActiveIndex}`);
    if (newEl) {
      newEl.classList.add('active');
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    currentActiveIndex = newActiveIndex;
  }
});

// ==========================================
// 6. FOTO DEL ALBUM CAYENDO
// ==========================================

function createFallingCovers(coverUrl, containerId = 'fallingCoversContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < 25; i++) {
    const img = document.createElement('img');
    img.src = coverUrl;
    img.classList.add('falling-cover');

    const size     = Math.random() * 80 + 35;       // 35–115px
    const left     = Math.random() * 100;             // posición horizontal
    const duration = Math.random() * 6 + 6;           // 6–12s
    const delay    = -(Math.random() * duration);     // ya empezadas al cargar
    const rotStart = (Math.random() - 0.5) * 60;     // rotación inicial
    const rotEnd   = rotStart + (Math.random() - 0.5) * 180;
    const opacity  = Math.random() * 0.15 + 0.2;     // 0.10–0.35, sutil

    img.style.cssText = `
      width:${size}px; height:${size}px;
      left:${left}%;
      animation-duration:${duration}s;
      animation-delay:${delay}s;
      --rot-start:${rotStart}deg;
      --rot-end:${rotEnd}deg;
      --op:${opacity};
    `;
    container.appendChild(img);
  }
}

// ==========================================
// 7. ANIMACIONES
// ==========================================


window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loadingScreen');
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
      showView('view-search');
    }, 700);
  }, 1500);
});
