const API_KEY = "1d3ae144acfb6bfcb25f70361cedcf29";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// FETCH MOVIES
fetchMovies(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`, "trending");
fetchMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28`, "action");
fetchMovies(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35`, "comedy");
fetchMovies(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`, "toprated");

async function fetchMovies(url, containerId) {
  try {
    const res = await fetch(url);
    const data = await res.json();

    displayMovies(data.results, containerId);
  } catch (error) {
    console.log("Movie fetch error:", error);
  }
}

// DISPLAY MOVIES
function displayMovies(movies, containerId) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.log(`Container ${containerId} not found`);
    return;
  }

  container.innerHTML = "";

  movies.forEach(movie => {
    if (!movie.poster_path) return;

    const card = document.createElement("div");
    card.className = "movie-card";

    const img = document.createElement("img");
    img.src = IMG_URL + movie.poster_path;
    img.alt = movie.title;

    const info = document.createElement("div");
    info.className = "movie-info";

    info.innerHTML = `
      <h4>${movie.title}</h4>
      <p>⭐ ${movie.vote_average}</p>
    `;

    card.appendChild(img);
    card.appendChild(info);

    card.addEventListener("click", () => {
      getTrailer(movie.id);
    });

    container.appendChild(card);
  });
}

// TRAILER
async function getTrailer(movieId) {
  try {
    const res = await fetch(
      `${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`
    );

    const data = await res.json();

    const trailer = data.results.find(
      video =>
        video.type === "Trailer" &&
        video.site === "YouTube"
    );

    if (trailer) {
      openPlayer(trailer.key);
    } else {
      alert("Trailer not available");
    }

  } catch (error) {
    console.log("Trailer error:", error);
  }
}

// OPEN PLAYER
function openPlayer(key) {
  const player = document.getElementById("player");
  const frame = document.getElementById("videoFrame");

  frame.src = `https://www.youtube.com/embed/${key}?autoplay=1`;
  player.style.display = "flex";
}

// CLOSE PLAYER
function closePlayer() {
  document.getElementById("player").style.display = "none";
  document.getElementById("videoFrame").src = "";
}

// SEARCH
let timeout;

function debounceSearch(query) {
  clearTimeout(timeout);

  timeout = setTimeout(() => {
    searchMovies(query);
  }, 500);
}

async function searchMovies(query) {
  const container = document.getElementById("searchResults");

  if (query.length < 3) {
    container.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(
      `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}`
    );

    const data = await res.json();

    displaySearchResults(data.results);

  } catch (error) {
    console.log("Search error:", error);
  }
}

function displaySearchResults(movies) {
  const container = document.getElementById("searchResults");

  container.innerHTML = `
    <h2>Search Results</h2>
    <div class="movies search-movies"></div>
  `;

  const moviesDiv = container.querySelector(".movies");

  movies.forEach(movie => {
    if (!movie.poster_path) return;

    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <img src="${IMG_URL + movie.poster_path}">
      <div class="movie-info">
        <h4>${movie.title}</h4>
        <p>⭐ ${movie.vote_average}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      getTrailer(movie.id);
    });

    moviesDiv.appendChild(card);
  });
}
