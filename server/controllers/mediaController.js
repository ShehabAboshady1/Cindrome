import axios from "axios";
import db from "../config/db.js";
import { formatCard } from "../utils/helpers.js";

const API_KEY = process.env.TMDB_API_KEY;

export const renderHome = async (req, res) => {
  try {
    const baseParams = { api_key: API_KEY, page: 1 };

    const [heroRes, trendingRes, mustWatchRes, tvRes, animeRes] =
      await Promise.all([
        axios.get("https://api.themoviedb.org/3/trending/movie/week", {
          params: baseParams,
        }),
        axios.get("https://api.themoviedb.org/3/trending/all/week", {
          params: baseParams,
        }),
        axios.get("https://api.themoviedb.org/3/discover/movie", {
          params: {
            ...baseParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 1000,
            "vote_average.gte": 7.5,
          },
        }),
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: {
            ...baseParams,
            without_genres: "16",
            sort_by: "popularity.desc",
            "vote_count.gte": 600,
            "vote_average.gte": 7.5,
          },
        }),
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: {
            ...baseParams,
            with_original_language: "ja",
            with_genres: "16",
            sort_by: "popularity.desc",
            "vote_count.gte": 300,
          },
        }),
      ]);

    const rawHero = heroRes.data.results[0];
    let heroMovie = null;

    if (rawHero) {
      const detailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${rawHero.id}`,
        { params: { api_key: API_KEY } },
      );
      const d = detailRes.data;
      const hrs = Math.floor((d.runtime || 120) / 60);
      const mins = (d.runtime || 120) % 60;

      heroMovie = {
        id: d.id,
        mediaType: "movie",
        title: d.title,
        overview: d.overview || "No synopsis available.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-odyssey1.webp",
        duration: `${hrs}h ${mins < 10 ? "0" : ""}${mins}m`,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    const trendingList = trendingRes.data.results.filter(
      (item) => item.vote_count >= 150 && item.vote_average >= 6.0,
    );

    let topCommunityLists = [];
    try {
      const sql = `
        SELECT 
          l.id, 
          l.title, 
          u.username AS author,
          (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS "itemsCount",
          (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) AS likes,
          (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) AS "commentsCount",
          (
            SELECT array_agg(mc.poster_path) 
            FROM (
              SELECT tmdb_id, media_type 
              FROM list_items 
              WHERE list_id = l.id 
              ORDER BY order_index ASC 
              LIMIT 4
            ) li_sub
            JOIN media_cache mc ON li_sub.tmdb_id = mc.tmdb_id AND li_sub.media_type = mc.media_type
          ) AS posters
        FROM lists l
        JOIN users u ON l.user_id = u.id
        WHERE l.is_private = false
        ORDER BY likes DESC
        LIMIT 8;
      `;
      const listsRes = await db.query(sql);
      topCommunityLists = listsRes.rows.map((row) => {
        const posters = Array.isArray(row.posters)
          ? row.posters
              .map((p) =>
                p
                  ? p.startsWith("http")
                    ? p
                    : `https://image.tmdb.org/t/p/w500${p}`
                  : null,
              )
              .filter(Boolean)
          : [];
        return { ...row, posters };
      });
    } catch (err) {
      console.error("Lists fetch error:", err.message);
    }

    res.render("index.ejs", {
      heroMovie,
      trendingNow: trendingList.slice(0, 8).map((i) => formatCard(i, "MOVIE")),
      mustWatchMovies: mustWatchRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      topTVShows: tvRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      topAnime: animeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "ANIME")),
      topCommunityLists,
    });
  } catch (err) {
    console.error("Home render error:", err.message);
    res.render("index.ejs", {
      heroMovie: null,
      trendingNow: [],
      mustWatchMovies: [],
      topTVShows: [],
      topAnime: [],
      topCommunityLists: [],
    });
  }
};

export const renderAnime = async (req, res) => {
  try {
    const url = "https://api.themoviedb.org/3/discover/tv";
    const baseParams = {
      api_key: API_KEY,
      with_original_language: "ja",
      include_adult: false,
      page: 1,
    };

    const [topRes, sportsRes, mysteryRes, trendingRes] = await Promise.all([
      axios.get(url, {
        params: {
          ...baseParams,
          with_genres: "16",
          sort_by: "vote_average.desc",
          "vote_count.gte": 500,
        },
      }),
      axios.get(url, {
        params: {
          ...baseParams,
          with_genres: "16",
          with_keywords: "6075",
          sort_by: "popularity.desc",
          "vote_count.gte": 50,
        },
      }),
      axios.get(url, {
        params: {
          ...baseParams,
          with_genres: "16,9648",
          sort_by: "popularity.desc",
          "vote_count.gte": 50,
        },
      }),
      axios.get(url, {
        params: {
          ...baseParams,
          with_genres: "16",
          sort_by: "popularity.desc",
          "vote_count.gte": 150,
        },
      }),
    ]);

    const items = trendingRes.data.results || [];
    const picked =
      items.find(
        (item) =>
          item.backdrop_path &&
          item.vote_count >= 200 &&
          item.vote_average >= 7.0,
      ) ||
      items.find((item) => item.backdrop_path && item.vote_count >= 100) ||
      items[0];

    let heroAnime = null;
    if (picked) {
      const detailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${picked.id}`,
        { params: { api_key: API_KEY } },
      );
      const d = detailRes.data;
      heroAnime = {
        id: d.id,
        mediaType: "anime",
        title: d.name,
        overview: d.overview || "No synopsis available.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-onepiece.webp",
        episodes: d.number_of_episodes
          ? `${d.number_of_episodes} Episodes`
          : "TV Series",
        year: d.first_air_date ? d.first_air_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Fantasy",
      };
    }

    res.render("anime.ejs", {
      heroAnime,
      topRatedAnime: topRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
      actionAnime: sportsRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME", "Sports")),
      mysteryAnime: mysteryRes.data.results
        .slice(0, 10)
        .map((i) => formatCard(i, "ANIME")),
    });
  } catch (err) {
    console.error("Anime render error:", err.message);
    res.render("anime.ejs", {
      heroAnime: null,
      topRatedAnime: [],
      actionAnime: [],
      mysteryAnime: [],
    });
  }
};

export const renderMovies = async (req, res) => {
  try {
    const url = "https://api.themoviedb.org/3/discover/movie";
    const baseParams = {
      api_key: API_KEY,
      include_adult: false,
      page: 1,
    };

    const [trendingRes, latestRes, actionRes, thrillerRes, horrorRes] =
      await Promise.all([
        axios.get(url, {
          params: {
            ...baseParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 150,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            primary_release_year: 2026,
            sort_by: "popularity.desc",
            "vote_count.gte": 10,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_genres: "28,878",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_genres: "80,9648",
            sort_by: "popularity.desc",
            "vote_count.gte": 100,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_genres: "27",
            sort_by: "popularity.desc",
            "vote_count.gte": 80,
          },
        }),
      ]);

    const items = trendingRes.data.results || [];
    const picked =
      items.find(
        (m) => m.backdrop_path && m.vote_count >= 300 && m.vote_average >= 6.8,
      ) || items[0];

    let heroMovie = null;
    if (picked) {
      const detailRes = await axios.get(
        `https://api.themoviedb.org/3/movie/${picked.id}`,
        { params: { api_key: API_KEY } },
      );
      const d = detailRes.data;
      const hrs = Math.floor((d.runtime || 120) / 60);
      const mins = (d.runtime || 120) % 60;
      heroMovie = {
        id: d.id,
        title: d.title,
        overview: d.overview || "No synopsis available.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "assets/backdrops/backdrop-thedeathofrobinhood.webp",
        duration: `${hrs}h ${mins < 10 ? "0" : ""}${mins}m`,
        year: d.release_date ? d.release_date.split("-")[0] : "2026",
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Action, Adventure, Drama",
      };
    }

    res.render("movies.ejs", {
      heroMovie,
      latestMovies: latestRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      actionSciFiMovies: actionRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      thrillerMovies: thrillerRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
      horrorMovies: horrorRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "MOVIE")),
    });
  } catch (err) {
    console.error("Movies render error:", err.message);
    res.render("movies.ejs", {
      heroMovie: null,
      latestMovies: [],
      actionSciFiMovies: [],
      thrillerMovies: [],
      horrorMovies: [],
    });
  }
};

export const renderSeries = async (req, res) => {
  try {
    const url = "https://api.themoviedb.org/3/discover/tv";
    const baseParams = {
      api_key: API_KEY,
      without_genres: "16",
      include_adult: false,
      page: 1,
    };

    const [trendingRes, topRes, actionRes, crimeRes, mysteryRes] =
      await Promise.all([
        axios.get(url, {
          params: {
            ...baseParams,
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            sort_by: "vote_average.desc",
            "vote_count.gte": 1000,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_genres: "10759|10765",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_genres: "80",
            sort_by: "popularity.desc",
            "vote_count.gte": 400,
            "vote_average.gte": 7.2,
          },
        }),
        axios.get(url, {
          params: {
            ...baseParams,
            with_keywords: "9799|6152",
            sort_by: "popularity.desc",
            "vote_count.gte": 200,
            "vote_average.gte": 7.0,
          },
        }),
      ]);

    const items = trendingRes.data.results || [];
    const picked =
      items.find(
        (t) => t.backdrop_path && t.vote_count >= 300 && t.vote_average >= 7.0,
      ) || items[0];

    let heroSeries = null;
    if (picked) {
      const detailRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${picked.id}`,
        { params: { api_key: API_KEY } },
      );
      const d = detailRes.data;
      const startYr = d.first_air_date
        ? d.first_air_date.split("-")[0]
        : "2026";
      const endYr =
        d.status === "Ended" && d.last_air_date
          ? d.last_air_date.split("-")[0]
          : "Present";

      heroSeries = {
        id: d.id,
        mediaType: "tv",
        title: d.name,
        overview: d.overview || "No synopsis available.",
        score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
        backdrop: d.backdrop_path
          ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
          : "/assets/backdrops/backdrop-sherlock.webp",
        duration: `${d.number_of_seasons || 1} Seasons • ${d.number_of_episodes || 10} Episodes`,
        year: startYr === endYr ? startYr : `${startYr} – ${endYr}`,
        genres:
          d.genres && d.genres.length > 0
            ? d.genres
                .map((g) => g.name)
                .slice(0, 3)
                .join(", ")
            : "Crime, Drama, Mystery",
      };
    }

    res.render("series.ejs", {
      heroSeries,
      topRatedSeries: topRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      actionSciFiSeries: actionRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      crimeSeries: crimeRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
      mysterySeries: mysteryRes.data.results
        .slice(0, 8)
        .map((i) => formatCard(i, "SERIES")),
    });
  } catch (err) {
    console.error("Series render error:", err.message);
    res.render("series.ejs", {
      heroSeries: null,
      topRatedSeries: [],
      actionSciFiSeries: [],
      crimeSeries: [],
      mysterySeries: [],
    });
  }
};

export const renderDetails = async (req, res) => {
  try {
    const id = req.query.id || "1396";
    const type = req.query.type || "tv";
    const url =
      type === "movie"
        ? `https://api.themoviedb.org/3/movie/${id}`
        : `https://api.themoviedb.org/3/tv/${id}`;

    const detailRes = await axios.get(url, {
      params: {
        api_key: API_KEY,
        append_to_response: "credits,recommendations,keywords",
      },
    });
    const d = detailRes.data;

    let episodes = [];
    if (type === "tv") {
      try {
        const seasonRes = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/1`,
          { params: { api_key: API_KEY } },
        );
        episodes = seasonRes.data.episodes || [];
      } catch (err) {
        episodes = [];
      }
    }

    const duration =
      type === "movie"
        ? `${Math.floor((d.runtime || 120) / 60)}h ${(d.runtime || 120) % 60}m`
        : `${d.number_of_seasons || 1} Seasons`;
    const badge =
      type === "movie"
        ? "Movie"
        : d.original_language === "ja"
          ? "Anime"
          : "TV Series";

    let creatorLabel = type === "movie" ? "Director" : "Creators";
    let creator = "N/A";
    if (type === "movie") {
      const dir = d.credits?.crew?.find((c) => c.job === "Director");
      creator = dir ? dir.name : "N/A";
    } else if (d.created_by && d.created_by.length > 0) {
      creator = d.created_by.map((c) => c.name).join(", ");
    } else {
      const animeCreator = d.credits?.crew?.find((c) =>
        [
          "Original Creator",
          "Original Story",
          "Series Director",
          "Director",
        ].includes(c.job),
      );
      if (animeCreator) {
        creatorLabel = animeCreator.job.includes("Original")
          ? "Original Manga"
          : "Director";
        creator = animeCreator.name;
      } else if (d.production_companies && d.production_companies.length > 0) {
        creatorLabel = "Studio";
        creator = d.production_companies[0].name;
      }
    }

    let genres = (d.genres || []).map((g) => g.name);
    if (badge === "Anime") {
      genres = genres.filter((g) => g !== "Animation");
      const kwList = d.keywords?.results || d.keywords?.keywords || [];
      const hasSports = kwList.some(
        (k) =>
          k.id === 6075 ||
          (typeof k.name === "string" &&
            k.name.toLowerCase().includes("sport")),
      );
      if (hasSports) {
        genres = ["Sports", ...genres.filter((g) => g !== "Sports")];
      }
    }

    const media = {
      id: d.id,
      type,
      badge,
      title: d.title || d.name,
      year: (d.release_date || d.first_air_date || "2026").split("-")[0],
      score: d.vote_average ? d.vote_average.toFixed(1) : "N/A",
      duration,
      genres: genres.length > 0 ? genres.slice(0, 3).join(", ") : "Drama",
      overview: d.overview || "No synopsis available.",
      poster: d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : "assets/posters/poster-sherlock.webp",
      backdrop: d.backdrop_path
        ? `https://image.tmdb.org/t/p/original${d.backdrop_path}`
        : "assets/backdrops/backdrop-sherlock.webp",
      creatorLabel,
      creator,
      status: d.status || "Released",
      cast: (d.credits?.cast || []).slice(0, 10).map((actor) => ({
        name: actor.name,
        character: actor.character || "Cast Member",
        image: actor.profile_path
          ? `https://image.tmdb.org/t/p/w300${actor.profile_path}`
          : "assets/profile-avatar.jpg",
      })),
      episodes,
      seasonsCount: d.number_of_seasons || 1,
      recommendations: (d.recommendations?.results || [])
        .slice(0, 8)
        .map((rec) => formatCard(rec, type === "movie" ? "MOVIE" : "SERIES")),
    };

    let reviews = [];
    try {
      const types =
        type === "tv" || type === "anime" ? ["tv", "anime"] : [type];
      const sql = `
        SELECT r.id as review_id, r.rating, r.review_text, r.has_spoilers, r.season_number, r.episode_number, u.username, p.avatar_url,
          (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) as likes_count,
          (SELECT COUNT(*) FROM review_comments rc WHERE rc.review_id = r.id) as comments_count,
          ${req.user ? `EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
        FROM reviews r JOIN users u ON r.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE r.tmdb_id = $1 AND r.media_type = ANY($2::varchar[]) ORDER BY r.created_at DESC LIMIT 10;
      `;
      const revRes = await db.query(sql, [id, types]);
      reviews = revRes.rows;
    } catch (err) {
      console.error("Details reviews error:", err.message);
    }

    media.reviews = reviews;
    res.render("details.ejs", { media });
  } catch (err) {
    console.error("Details render error:", err.message);
    res.redirect("/");
  }
};

export const getSeasonEpisodes = async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;
    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`,
      { params: { api_key: API_KEY } },
    );
    res.json(response.data.episodes || []);
  } catch (err) {
    res.status(500).json([]);
  }
};

export const renderDiscover = (req, res) => res.render("discover.ejs");

const GENRES = {
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
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function formatDiscoverItem(item) {
  const isAnime = item.original_language === "ja";
  const isMovie = item.media_type === "movie" || item.title !== undefined;
  const badge = isMovie ? "Movie" : isAnime ? "Anime" : "Series";
  const year =
    (item.release_date || item.first_air_date || "").split("-")[0] || "N/A";
  const score = item.vote_average ? item.vote_average.toFixed(1) : "NR";
  const genres = (item.genre_ids || [])
    .filter((id) => id !== 16)
    .map((id) => GENRES[id])
    .filter(Boolean)
    .slice(0, 2);
  const genreDisplay =
    genres.length > 0
      ? genres.join(", ")
      : badge === "Anime"
        ? "Anime"
        : "General";

  return {
    id: item.id,
    title: item.title || item.name,
    mediaType: isMovie ? "movie" : "tv",
    badge,
    year,
    genres: genreDisplay,
    score,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
  };
}

const prefixCache = new Map();
const PREFIX_TTL = 5 * 60 * 1000;

async function searchPrefixItems(rawQuery, apiKey) {
  const trimmed = rawQuery.trim();
  const clean = trimmed.toLowerCase();

  const cached = prefixCache.get(clean);
  if (cached && Date.now() - cached.ts < PREFIX_TTL) {
    return cached.results;
  }

  const queries = [trimmed];
  if (clean.length === 2) {
    for (const ch of ["a", "e", "i", "l", "o", "r", "s", "u"]) {
      queries.push(`${trimmed}${ch}`);
    }
  } else if (clean.length === 1) {
    for (const ch of ["a", "e", "i", "o", "u", "r", "t", "h"]) {
      queries.push(`${trimmed}${ch}`);
    }
  }

  const requests = [];
  for (const qVar of queries) {
    requests.push(
      axios
        .get("https://api.themoviedb.org/3/search/movie", {
          params: { api_key: apiKey, query: qVar, page: 1 },
        })
        .then((r) =>
          (r.data?.results || []).map((it) => ({ ...it, media_type: "movie" })),
        )
        .catch(() => []),
    );
    requests.push(
      axios
        .get("https://api.themoviedb.org/3/search/tv", {
          params: { api_key: apiKey, query: qVar, page: 1 },
        })
        .then((r) =>
          (r.data?.results || []).map((it) => ({ ...it, media_type: "tv" })),
        )
        .catch(() => []),
    );
  }

  const [dbRes, ...batches] = await Promise.all([
    db
      .query(
        `SELECT tmdb_id, media_type, title, poster_path, vote_average, release_year
         FROM media_cache
         WHERE title ILIKE $1
         LIMIT 50`,
        [`${trimmed}%`],
      )
      .catch(() => ({ rows: [] })),
    ...requests,
  ]);

  const seen = new Set();
  const matched = [];

  for (const batch of batches) {
    for (const item of batch) {
      const key = `${item.media_type}-${item.id}`;
      if (seen.has(key)) continue;

      const title = (item.title || item.name || "").trim().toLowerCase();
      if (!title.startsWith(clean)) continue;

      seen.add(key);
      matched.push(item);
    }
  }

  for (const row of dbRes.rows || []) {
    const mType = row.media_type === "movie" ? "movie" : "tv";
    const key = `${mType}-${row.tmdb_id}`;
    if (seen.has(key)) continue;

    const title = (row.title || "").trim().toLowerCase();
    if (!title.startsWith(clean)) continue;

    seen.add(key);
    matched.push({
      id: row.tmdb_id,
      media_type: mType,
      title: mType === "movie" ? row.title : undefined,
      name: mType === "tv" ? row.title : undefined,
      poster_path: row.poster_path || null,
      vote_average: row.vote_average ? parseFloat(row.vote_average) : 0,
      vote_count: 50,
      popularity: 20,
      release_date:
        mType === "movie" && row.release_year
          ? `${row.release_year}-01-01`
          : undefined,
      first_air_date:
        mType === "tv" && row.release_year
          ? `${row.release_year}-01-01`
          : undefined,
      genre_ids: [],
      original_language: row.media_type === "anime" ? "ja" : "en",
    });
  }

  matched.sort((a, b) => {
    const scoreA =
      (a.popularity || 0) + Math.log10((a.vote_count || 0) + 1) * 25;
    const scoreB =
      (b.popularity || 0) + Math.log10((b.vote_count || 0) + 1) * 25;
    return scoreB - scoreA;
  });

  if (prefixCache.size >= 50) {
    const oldest = prefixCache.keys().next().value;
    prefixCache.delete(oldest);
  }
  prefixCache.set(clean, { ts: Date.now(), results: matched });

  return matched;
}

export const apiDiscover = async (req, res) => {
  try {
    const {
      q = "",
      type = "all",
      genre = "all",
      rating = "0",
      sort = "popular",
      year = "all",
      page = 1,
    } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = 21;

    const movieGenres = {
      action: 28,
      scifi: 878,
      drama: 18,
      mystery: 9648,
      fantasy: 14,
      comedy: 35,
    };
    const tvGenres = {
      action: 10759,
      scifi: 10765,
      drama: 18,
      mystery: 9648,
      fantasy: 10765,
      comedy: 35,
    };

    async function withWatchlistStatus(list) {
      const results = list.map(formatDiscoverItem);
      if (req.user && results.length > 0) {
        try {
          const ids = results.map((r) => r.id);
          const wlRes = await db.query(
            "SELECT tmdb_id, media_type FROM watchlist WHERE user_id = $1 AND tmdb_id = ANY($2::int[])",
            [req.user.id, ids],
          );
          const wlMap = {};
          wlRes.rows.forEach(
            (row) => (wlMap[`${row.tmdb_id}-${row.media_type}`] = true),
          );
          results.forEach((item) => {
            const dbType = item.mediaType === "anime" ? "tv" : item.mediaType;
            item.is_watchlisted =
              !!wlMap[`${item.id}-${dbType}`] || !!wlMap[`${item.id}-anime`];
          });
        } catch (err) {
          console.error("Watchlist lookup error:", err);
        }
      }
      return results;
    }

    if (q.trim() !== "") {
      let items = await searchPrefixItems(q, API_KEY);

      if (type === "movie") {
        items = items.filter((it) => it.media_type === "movie");
      } else if (type === "tv") {
        items = items.filter(
          (it) =>
            it.media_type === "tv" &&
            it.original_language !== "ja" &&
            !(it.genre_ids && it.genre_ids.includes(16)),
        );
      } else if (type === "anime") {
        items = items.filter((it) => it.original_language === "ja");
      }

      if (genre !== "all") {
        items = items.filter((it) => {
          const gid =
            it.media_type === "movie" ? movieGenres[genre] : tvGenres[genre];
          return gid && (it.genre_ids || []).includes(gid);
        });
      }

      const minRating = parseFloat(rating);
      if (minRating > 0) {
        items = items.filter((it) => (it.vote_average || 0) >= minRating);
      }

      const results = await withWatchlistStatus(items.slice(0, perPage));
      return res.json({ results, page: 1, totalPages: 1 });
    }

    function buildParams(mType, targetPage) {
      const params = { api_key: API_KEY, page: targetPage };
      if (sort === "newest") {
        params.sort_by =
          mType === "movie"
            ? "primary_release_date.desc"
            : "first_air_date.desc";
      } else if (sort === "rating") {
        params.sort_by = "vote_average.desc";
        params["vote_count.gte"] = 100;
      } else {
        params.sort_by = "popularity.desc";
      }

      const minRating = parseFloat(rating);
      if (minRating > 0) {
        params["vote_average.gte"] = minRating;
        if (minRating >= 8.0) params["vote_count.gte"] = 100;
        else if (minRating >= 7.0) params["vote_count.gte"] = 50;
        else params["vote_count.gte"] = 20;
      }
      if (year !== "all") {
        const prefix =
          mType === "movie" ? "primary_release_date" : "first_air_date";
        if (year === "2010s") {
          params[`${prefix}.gte`] = "2010-01-01";
          params[`${prefix}.lte`] = "2019-12-31";
        } else if (year === "2000s") {
          params[`${prefix}.gte`] = "2000-01-01";
          params[`${prefix}.lte`] = "2009-12-31";
        } else if (year === "90s") {
          params[`${prefix}.gte`] = "1990-01-01";
          params[`${prefix}.lte`] = "1999-12-31";
        } else if (year === "classics") {
          params[`${prefix}.lte`] = "1989-12-31";
        } else if (!isNaN(year)) {
          if (mType === "movie")
            params.primary_release_year = parseInt(year, 10);
          else params.first_air_date_year = parseInt(year, 10);
        }
      }
      if (genre !== "all") {
        const gid = mType === "movie" ? movieGenres[genre] : tvGenres[genre];
        if (gid) params.with_genres = gid;
      }
      if (type === "tv" && mType === "tv") {
        params.without_original_language = "ja";
        params.without_genres = "16";
      }
      return params;
    }

    let rawItems = [];
    let totalPages = 500;

    if (type === "all") {
      const [mInit, tInit] = await Promise.all([
        axios.get("https://api.themoviedb.org/3/discover/movie", {
          params: buildParams("movie", 1),
        }),
        axios.get("https://api.themoviedb.org/3/discover/tv", {
          params: {
            ...buildParams("tv", 1),
            without_original_language: "ja",
            without_genres: "16",
          },
        }),
      ]);
      const mTotal = mInit.data.total_results || 0;
      const tTotal = tInit.data.total_results || 0;
      totalPages = Math.min(Math.ceil((mTotal + tTotal) / perPage), 500);

      let mIdx = 0;
      let tIdx = 0;
      let mStart = 0;
      let mCount = 0;
      let tStart = 0;
      let tCount = 0;

      for (let k = 1; k <= pageNum; k++) {
        const mLeft = Math.max(0, mTotal - mIdx);
        const tLeft = Math.max(0, tTotal - tIdx);
        let mTake = Math.min(11, mLeft);
        let tTake = Math.min(perPage - mTake, tLeft);
        if (mTake + tTake < perPage && tLeft > tTake) {
          tTake = Math.min(perPage - mTake, tLeft);
        }
        if (mTake + tTake < perPage && mLeft > mTake) {
          mTake = Math.min(perPage - tTake, mLeft);
        }
        if (k === pageNum) {
          mStart = mIdx;
          mCount = mTake;
          tStart = tIdx;
          tCount = tTake;
        }
        mIdx += mTake;
        tIdx += tTake;
      }

      async function fetchSlice(mType, start, count, initData) {
        if (count <= 0) return [];
        const p1 = Math.floor(start / 20) + 1;
        const p2 = Math.floor((start + count - 1) / 20) + 1;
        const url =
          mType === "movie"
            ? "https://api.themoviedb.org/3/discover/movie"
            : "https://api.themoviedb.org/3/discover/tv";
        const p1Params = buildParams(mType, p1);
        if (mType === "tv") {
          p1Params.without_original_language = "ja";
          p1Params.without_genres = "16";
        }
        const req1 =
          p1 === 1
            ? Promise.resolve(initData)
            : axios.get(url, { params: p1Params });
        const req2 =
          p1 !== p2
            ? p2 === 1
              ? Promise.resolve(initData)
              : axios.get(url, {
                  params: {
                    ...buildParams(mType, p2),
                    ...(mType === "tv"
                      ? {
                          without_original_language: "ja",
                          without_genres: "16",
                        }
                      : {}),
                  },
                })
            : Promise.resolve({ data: { results: [] } });
        const [r1, r2] = await Promise.all([req1, req2]);
        const list = [
          ...(r1.data.results || []),
          ...(r2.data.results || []),
        ].map((it) => ({ ...it, media_type: mType }));
        const offset = start - (p1 - 1) * 20;
        return list.slice(offset, offset + count);
      }

      const [mSlice, tSlice] = await Promise.all([
        fetchSlice("movie", mStart, mCount, mInit),
        fetchSlice("tv", tStart, tCount, tInit),
      ]);
      const merged = [];
      const maxLen = Math.max(mSlice.length, tSlice.length);
      for (let i = 0; i < maxLen; i++) {
        if (mSlice[i]) merged.push(mSlice[i]);
        if (tSlice[i]) merged.push(tSlice[i]);
      }
      rawItems = merged.slice(0, perPage);
    } else {
      const start = (pageNum - 1) * perPage;
      const p1 = Math.floor(start / 20) + 1;
      const p2 = Math.floor((start + perPage - 1) / 20) + 1;
      const p1Params = buildParams(type === "movie" ? "movie" : "tv", p1);
      const p2Params = buildParams(type === "movie" ? "movie" : "tv", p2);
      if (type === "tv") {
        p1Params.without_original_language = "ja";
        p1Params.without_genres = "16";
        p2Params.without_original_language = "ja";
        p2Params.without_genres = "16";
      }
      if (type === "anime") {
        p1Params.with_original_language = "ja";
        p2Params.with_original_language = "ja";
        p1Params.with_genres = p1Params.with_genres
          ? `16,${p1Params.with_genres}`
          : 16;
        p2Params.with_genres = p2Params.with_genres
          ? `16,${p2Params.with_genres}`
          : 16;
      }
      const url =
        type === "movie"
          ? "https://api.themoviedb.org/3/discover/movie"
          : "https://api.themoviedb.org/3/discover/tv";

      const [r1, r2] = await Promise.all([
        axios.get(url, { params: p1Params }),
        p1 !== p2
          ? axios.get(url, { params: p2Params })
          : Promise.resolve({ data: { results: [] } }),
      ]);
      const list = [...(r1.data.results || []), ...(r2.data.results || [])].map(
        (m) => ({ ...m, media_type: type === "movie" ? "movie" : "tv" }),
      );
      const offset = start - (p1 - 1) * 20;
      rawItems = list.slice(offset, offset + perPage);
      totalPages = Math.min(
        Math.ceil((r1.data.total_results || 500) / perPage),
        500,
      );
    }

    const results = await withWatchlistStatus(rawItems);
    res.json({ results, page: pageNum, totalPages });
  } catch (err) {
    console.error("Discover API error:", err);
    res.status(500).json({ results: [], page: 1, totalPages: 1 });
  }
};

export const apiSearch = async (req, res) => {
  try {
    const query = req.query.q;
    const type = req.query.type || "all";
    if (!query || query.trim() === "") return res.json([]);

    let items = await searchPrefixItems(query, API_KEY);

    if (type === "movie") {
      items = items.filter((item) => item.media_type === "movie");
    } else if (type === "tv") {
      items = items.filter(
        (item) =>
          item.media_type === "tv" &&
          item.original_language !== "ja" &&
          !(item.genre_ids && item.genre_ids.includes(16)),
      );
    } else if (type === "anime") {
      items = items.filter((item) => item.original_language === "ja");
    }

    const results = items.slice(0, 20).map((item) => {
      const isAnime = item.original_language === "ja";
      const badge =
        item.media_type === "movie" ? "Movie" : isAnime ? "Anime" : "Series";
      const yr = (item.release_date || item.first_air_date || "").split("-")[0];
      const score = item.vote_average
        ? parseFloat(item.vote_average.toFixed(1))
        : 0;

      return {
        id: item.id,
        title: item.title || item.name,
        mediaType: item.media_type,
        badge,
        year: yr ? parseInt(yr, 10) : "N/A",
        numericYear: yr ? parseInt(yr, 10) : 0,
        score: score > 0 ? score.toFixed(1) : "NR",
        numericScore: score,
        genres: item.genre_ids || [],
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='255' viewBox='0 0 170 255'%3E%3Crect fill='%2311201f' width='170' height='255'/%3E%3Ctext fill='%23718096' font-family='sans-serif' font-size='14' dy='130' dx='45'%3ENo Poster%3C/text%3E%3C/svg%3E",
      };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json([]);
  }
};
