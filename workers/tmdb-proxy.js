/**
 * Cinema Nest – TMDB API Proxy
 * Deploy this as a Cloudflare Worker.
 *
 * Purpose: Hide the public TMDB API key from client-side code.
 * All TMDB requests from the frontend go through this proxy instead of directly to TMDB.
 *
 * ENV VARS to set in Cloudflare Worker Settings:
 *   TMDB_API_KEY      → Your TMDB API key (keep secret)
 *   ALLOWED_ORIGINS   → Comma-separated domains (e.g., "https://yourdomain.com")
 *
 * Benefits:
 *   1. API key is never exposed in browser DevTools
 *   2. Can add rate limiting per user/IP
 *   3. Can log suspicious requests
 *   4. Can validate query parameters server-side
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Whitelist of allowed TMDB endpoints to prevent misuse
const ALLOWED_ENDPOINTS = [
  '/discover/movie',
  '/discover/tv',
  '/search/movie',
  '/search/tv',
  '/trending/movie',
  '/trending/tv',
  '/movie/',
  '/tv/',
  '/genre/movie/list',
  '/genre/tv/list',
];

export default {
  async fetch(request, env) {
    // CORS: Check origin
    const origin = request.headers.get('origin');
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return new Response('Forbidden: Invalid origin', { status: 403 });
    }

    // Only GET requests allowed
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse request path
    const url = new URL(request.url);
    const pathAndQuery = url.pathname.replace('/tmdb', '') + url.search;

    // Validate endpoint is whitelisted
    const isAllowed = ALLOWED_ENDPOINTS.some(endpoint => pathAndQuery.startsWith(endpoint));
    if (!isAllowed) {
      console.warn(`🚫 Blocked disallowed endpoint: ${pathAndQuery}`);
      return new Response('Endpoint not allowed', { status: 403 });
    }

    // Add TMDB API key server-side (never exposed to client)
    const proxyUrl = `${TMDB_BASE}${pathAndQuery}&api_key=${env.TMDB_API_KEY}`;

    try {
      const response = await fetch(proxyUrl);
      const data = await response.json();

      // Add CORS headers
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } catch (err) {
      console.error('TMDB proxy error:', err);
      return new Response('Gateway error', { status: 502 });
    }
  },
};
