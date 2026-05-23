/**
 * Cinema Nest — TMDB API Proxy
 * api/tmdb.js  (Vercel Serverless Function)
 *
 * All TMDB requests from the browser go through here.
 * The API key lives only in Vercel's environment — never in client code.
 *
 * Usage from your HTML/JS:
 *   fetch('/api/tmdb?endpoint=trending/movie/week')
 *   fetch('/api/tmdb?endpoint=search/multi&query=inception')
 *   fetch('/api/tmdb?endpoint=movie/550&append_to_response=videos,credits')
 *
 * Set up:
 *   Vercel Dashboard → Your Project → Settings → Environment Variables
 *   Add: TMDB_API_KEY = your_key_here
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

// Allowlist — only these endpoint patterns are permitted.
// Prevents your function being abused as a general TMDB proxy.
const ALLOWED_ENDPOINTS = [
  /^trending\/movie\/week$/,
  /^trending\/tv\/week$/,
  /^movie\/top_rated$/,
  /^movie\/popular$/,
  /^tv\/popular$/,
  /^search\/multi$/,
  /^discover\/movie$/,
  /^discover\/tv$/,
  /^movie\/\d+$/,
  /^tv\/\d+$/,
  /^tv\/\d+\/season\/\d+$/,
];

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { endpoint, ...rest } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: "Missing required 'endpoint' parameter." });
  }

  // Validate against allowlist
  const isAllowed = ALLOWED_ENDPOINTS.some((pattern) => pattern.test(endpoint));
  if (!isAllowed) {
    return res.status(403).json({ error: `Endpoint '${endpoint}' is not permitted.` });
  }

  const API_KEY = process.env.TMDB_API_KEY;
  if (!API_KEY) {
    console.error("TMDB_API_KEY environment variable is not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  // Forward any extra query params (with_genres=, query=, page=, etc.)
  const extraParams = new URLSearchParams(rest).toString();
  const upstreamUrl = `${TMDB_BASE}/${endpoint}?api_key=${API_KEY}${extraParams ? "&" + extraParams : ""}`;

  try {
    const response = await fetch(upstreamUrl);
    const data = await response.json();

    // Cache successful responses for 5 minutes at the CDN edge
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(response.status).json(data);
  } catch (err) {
    console.error("TMDB fetch failed:", err);
    return res.status(502).json({ error: "Failed to reach TMDB API." });
  }
}
