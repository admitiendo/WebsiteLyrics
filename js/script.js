let parsedLyrics = [];
const audioPlayer = document.getElementById('audioPlayer');
const progressBar = document.getElementById('progressBar');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
let searchResults = [];

playPauseBtn.addEventListener('click', () => {
  if (audioPlayer.paused) {
    audioPlayer.play();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    audioPlayer.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
});

// asegurar que el icono cambie si la canción termina sola
audioPlayer.addEventListener('ended', () => {
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
});

// -- seleccionar x parte de la letra

const lyricsDisplay = document.getElementById('lyricsDisplay');

lyricsDisplay.addEventListener('click', (e) => {
  // Verificamos que el usuario haya hecho clic en un elemento que tenga la clase 'lyric-line'
  const targetLine = e.target.closest('.lyric-line');

  if (targetLine) {
    // Obtenemos el tiempo del atributo data-time
    const time = parseFloat(targetLine.getAttribute('data-time'));

    if (!isNaN(time)) {
      audioPlayer.currentTime = time; // Saltamos al tiempo
      audioPlayer.play();            // Reproducimos automáticamente
    }
  }
});

// --- navegar entre vistas ---
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// ---  Convertir la duracion (segundos totales) a MINUTOS:SEGUNDOS ---

function convertSecondsToMinutesAndSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// --- conseguir la imagen del album ---

async function fetchCoverArt(artist, track) {
  // Buscamos en iTunes el nombre de la canción y artista
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + track)}&entity=song&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // iTunes devuelve una imagen de 100x100, cambiamos la URL a 600x600 para que se vea bien
      return data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
    }
  } catch (e) {
    console.error("No se pudo obtener la portada:", e);
  }
  return null; // Retorna null si no encuentra nada
}

// --- busqueda de cancion ---
async function buscarCancion() {
  const query = document.getElementById('searchInput').value;
  const list = document.getElementById('resultsList');
  list.innerHTML = 'Buscando...';

  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
  searchResults = await res.json();
  list.innerHTML = '';

  searchResults.forEach((track, index) => {
    const div = document.createElement('div');
    div.className = 'p-3 bg-gray-800 hover:bg-gray-700 cursor-pointer rounded-lg text-sm';
    div.innerText = `${track.trackName} - ${track.artistName} - ${convertSecondsToMinutesAndSeconds(track.duration)}`;
    // Dentro de tu función de click en el resultado
    div.onclick = async () => { // <--- Asegúrate de añadir 'async' aquí
      if(!track.syncedLyrics) return alert("No hay letra sincronizada.");

      const coverUrl = await fetchCoverArt(track.artistName, track.trackName);

      const coverImg = document.getElementById('albumCover');
      if (coverUrl) {
        coverImg.src = coverUrl;
        coverImg.classList.remove('hidden');
      } else {
        coverImg.classList.add('hidden');
      }

      parseLRC(track.syncedLyrics);
      document.getElementById('selectedTitle').innerText = track.trackName;
      document.getElementById('displayTitle').innerText = track.trackName;

      showView('view-upload');
    };
    list.appendChild(div);
  });
}

// --- cargar el mp3 de la cancion ---
document.getElementById('audioUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    audioPlayer.src = URL.createObjectURL(file);
    showView('view-player');
    audioPlayer.play();
  }
});

// --- sincronizacion ---
function parseLRC(lrcText) {
  parsedLyrics = [];
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

  const container = document.getElementById('lyricsDisplay');
  // AQUÍ ESTÁ EL CAMBIO: Agregamos data-time y clases visuales
  container.innerHTML = parsedLyrics.map((l, i) =>
    `<div class="lyric-line cursor-pointer hover:text-white transition" id="line-${i}" data-time="${l.time}">
       ${l.text}
     </div>`
  ).join('');
}

audioPlayer.addEventListener('loadedmetadata', () => {
  progressBar.max = audioPlayer.duration;
  document.getElementById('totalTime').innerText = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('timeupdate', () => {
  progressBar.value = audioPlayer.currentTime;
  document.getElementById('currentTime').innerText = formatTime(audioPlayer.currentTime);

  let activeIndex = -1;
  parsedLyrics.forEach((line, i) => {
    if (audioPlayer.currentTime >= line.time) activeIndex = i;
  });

  if (activeIndex !== -1) {
    document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`line-${activeIndex}`);
    if(activeEl) {
      activeEl.classList.add('active');
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

progressBar.addEventListener('input', () => {
  audioPlayer.currentTime = progressBar.value;
});

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function resetApp() {
  // Detener audio
  const audio = document.getElementById('audioPlayer');
  audio.pause();
  audio.src = '';

  // Volver a vista de búsqueda
  showView('view-search');

  // Limpiar campos
  document.getElementById('lyricsDisplay').innerHTML = '';
  document.getElementById('displayTitle').innerText = '';
  document.getElementById('albumCover').classList.add('hidden');
  document.getElementById('searchInput').value = '';
}
