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
let currentActiveIndex = -1; // Guarda la línea actual para no sobrecargar el DOM

// ==========================================
// 2. CONTROLES DEL REPRODUCTOR
// ==========================================

// actualiza los iconos de play/pausa
function updatePlayIcons() {
  if (audioPlayer.paused) {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  } else {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
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
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
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
        if (!track.syncedLyrics) return alert("Esta canción no tiene letra sincronizada en la base de datos.");
// ... código anterior ...
        const coverUrl = await fetchCoverArt(track.artistName, track.trackName);

        const coverImg = document.getElementById('albumCover');
        if (coverUrl) {
          // 1. FUNDAMENTAL: Permitir extraer color de otra web sin bloqueos de seguridad
          coverImg.crossOrigin = "Anonymous";

          // 2. Extraer el color cuando la imagen termine de cargar
          coverImg.onload = () => {
            try {
              const colorThief = new ColorThief();
              // Devuelve un arreglo con colores RGB [R, G, B]
              const color = colorThief.getColor(coverImg);

              // 3. Cambiar la variable CSS en todo el documento
              const rgbColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
              document.documentElement.style.setProperty('--accent-color', rgbColor);

            } catch (e) {
              console.warn("No se pudo extraer el color, usando color por defecto.", e);
              document.documentElement.style.setProperty('--accent-color', '#1db954');
            }
          };

          // Asignamos la imagen (esto dispara el evento onload de arriba)
          coverImg.src = coverUrl;
          coverImg.classList.remove('hidden');
        } else {
          coverImg.classList.add('hidden');
          document.documentElement.style.setProperty('--accent-color', '#1db954');
        }
        // ... resto del código (parseLRC, showView, etc.) ...

        parseLRC(track.syncedLyrics);
        document.getElementById('selectedTitle').innerText = track.trackName;
        document.getElementById('displayTitle').innerText = track.trackName;
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
  if (file) {
    audioPlayer.src = URL.createObjectURL(file);
    showView('view-player');
    audioPlayer.play();
    updatePlayIcons();
  }
});

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
      if (oldEl) oldEl.classList.remove('active', 'text-green-500', 'font-bold', 'scale-105');
    }

    const newEl = document.getElementById(`line-${newActiveIndex}`);
    if (newEl) {
      newEl.classList.add('active', 'text-green-500', 'font-bold', 'scale-105');
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    currentActiveIndex = newActiveIndex;
  }
});
