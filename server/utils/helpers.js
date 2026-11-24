import db from "../config/db.js";

export const genreMap = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
};

const sportsRegex =
  /\b(sport|sports|football|soccer|volleyball|basketball|boxing|boxer|baseball|tennis|skating|swimming|swimmer|table tennis|ping pong|badminton|rugby|judo|karate|wrestling|athlete|athletics|striker)\b/i;

export function formatCommentText(text) {
  if (!text) return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\B@\w+/g,
      (match) => `<span class="comment-mention">${match}</span>`,
    );
}

export const formatCard = (item, defaultType = "MOVIE", forcedGenre = null) => {
  const mType = item.media_type || (defaultType === "MOVIE" ? "movie" : "tv");
  let type = defaultType;

  if (item.media_type) {
    if (item.media_type === "movie") type = "MOVIE";
    else if (item.original_language === "ja") type = "ANIME";
    else type = "SERIES";
  }

  let genres = (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean);
  if (type === "ANIME") {
    genres = genres.filter((g) => g !== "Animation");
  }

  const rawText = `${item.title || item.name || ""} ${item.overview || ""}`;
  const isSports = forcedGenre === "Sports" || sportsRegex.test(rawText);

  if (isSports) {
    genres = ["Sports", ...genres.filter((g) => g !== "Sports")];
  } else if (forcedGenre) {
    genres = [forcedGenre, ...genres.filter((g) => g !== forcedGenre)];
  }

  let picked = genres.slice(0, 2);
  if (picked.join(", ").length > 16) {
    picked = picked.slice(0, 1);
  }

  const genreLabel =
    picked.join(", ") || (type === "MOVIE" ? "Cinema" : "Drama");
  const year = (item.release_date || item.first_air_date || "2026").split(
    "-",
  )[0];

  return {
    id: item.id,
    title: item.title || item.name,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "assets/posters/poster-odyssey.webp",
    score: item.vote_average ? item.vote_average.toFixed(1) : "N/A",
    type,
    mediaType: mType,
    ageBadge: item.adult ? "R" : type === "MOVIE" ? "PG-13" : "TV-14",
    meta: year,
    subtitle: `${genreLabel} • ${year}`,
  };
};

export async function getUserWatchlistIds(userId) {
  if (!userId) return [];
  try {
    const res = await db.query(
      "SELECT tmdb_id FROM watchlist WHERE user_id = $1",
      [userId],
    );
    return res.rows.map((r) => r.tmdb_id.toString());
  } catch (err) {
    console.error("Watchlist fetch error:", err);
    return [];
  }
}

export async function getUserLikedMediaIds(userId) {
  if (!userId) return [];
  try {
    const res = await db.query(
      "SELECT tmdb_id FROM liked_media WHERE user_id = $1",
      [userId],
    );
    return res.rows.map((r) => r.tmdb_id.toString());
  } catch (err) {
    console.error("Liked media fetch error:", err);
    return [];
  }
}
