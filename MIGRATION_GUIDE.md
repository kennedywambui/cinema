# Frontend Migration: TMDB Proxy Integration

## Files to Update

### 1. `browse.html`

**Step 1: Remove hardcoded API key (line 334)**

```javascript
// ❌ OLD:
const API_KEY = "1d3ae144acfb6bfcb25f70361cedcf29";
const API = "https://api.themoviedb.org/3";

// ✅ NEW:
const TMDB_PROXY = "https://tmdb-proxy.YOUR-ACCOUNT.workers.dev";
```

**Step 2: Update all fetch calls**

Find all instances of:
```javascript
// ❌ OLD PATTERN:
const url = `${API}/discover/${currentType}?api_key=${API_KEY}&sort_by=${currentSort}&page=${page}...`;
```

Replace with:
```javascript
// ✅ NEW PATTERN:
const url = `${TMDB_PROXY}/discover/${currentType}?sort_by=${currentSort}&page=${page}...`;
// Remove: &api_key=${API_KEY}
```

**Changes needed at lines:**
- Line 383: `fetchPage()` function
- Line 487: `openModal()` function (also has IMG_W constant which is OK)

**Example fix (line 383):**
```javascript
// OLD:
const url = `${API}/discover/${currentType}?api_key=${API_KEY}&sort_by=${currentSort}&page=${page}${genreParam}${yearParam}${voteParam}`;

// NEW:
const url = `${TMDB_PROXY}/discover/${currentType}?sort_by=${currentSort}&page=${page}${genreParam}${yearParam}${voteParam}`;
```

---

### 2. `index.html`

**Step 1: Remove hardcoded API key (around line 907)**

The API key is inside the Firebase init code. Remove it:

```javascript
// ❌ Remove this line:
const API_KEY = "1d3ae144acfb6bfcb25f70361cedcf29";

// ✅ Add this instead:
const TMDB_PROXY = "https://tmdb-proxy.YOUR-ACCOUNT.workers.dev";
const IMG_W = 'https://image.tmdb.org/t/p/w500'; // Keep this for image CDN
```

**Step 2: Update fetch calls**

Search for all instances of `${API}` and `api_key=${API_KEY}` and remove them.

**Common patterns to replace:**

```javascript
// ❌ OLD:
await fetch(`${API}/trending/movie/week?api_key=${API_KEY}`);

// ✅ NEW:
await fetch(`${TMDB_PROXY}/trending/movie/week`);
```

**Lines to check:**
- Search for "api_key" in the file
- Search for "${API}/" patterns
- Update each one to use `${TMDB_PROXY}/` without the api_key param

---

### 3. `includes/paywall-enhanced.html`

**Already included in the security fix commit!**

Just replace the old paywall section in `browse.html` with the new one.

**In browse.html, find:**
```html
<!-- ── Subscription Gate ── -->
<script type="module">
  import { initializeApp } from "...
  // ... old paywall code ...
</script>
```

**Replace the entire section with:**
```html
<!-- ── Subscription Gate (Enhanced) ── -->
<!-- Copy entire contents of includes/paywall-enhanced.html -->
```

---

## Step-by-Step Migration

### For `browse.html`:

1. **Line 334-337:** Replace API constants
   ```javascript
   const TMDB_PROXY = "https://tmdb-proxy.{your-account}.workers.dev";
   const IMG_W = "https://image.tmdb.org/t/p/w500";
   const IMG = "https://image.tmdb.org/t/p/original";
   // Remove: const API_KEY = "...";
   // Remove: const API = "https://api.themoviedb.org/3";
   ```

2. **Line 383:** Update `fetchPage()` function
   ```javascript
   // Change:
   const url = `${API}/discover/${currentType}?api_key=${API_KEY}&sort_by=${currentSort}&page=${page}${genreParam}${yearParam}${voteParam}`;
   
   // To:
   const url = `${TMDB_PROXY}/discover/${currentType}?sort_by=${currentSort}&page=${page}${genreParam}${yearParam}${voteParam}`;
   ```

3. **Line 487:** Update `openModal()` function
   ```javascript
   // Change:
   const res = await fetch(`${API}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos`);
   
   // To:
   const res = await fetch(`${TMDB_PROXY}/${type}/${id}?append_to_response=videos`);
   ```

4. **Line 578-698:** Replace entire paywall section
   Copy contents from `includes/paywall-enhanced.html`
   Update `VERIFY_ENDPOINT` to your subscription-check Worker URL

---

### For `index.html`:

1. **Around line 969:** Replace IMG_W definition with proxy setup
   ```javascript
   // Add near top of main script:
   const TMDB_PROXY = "https://tmdb-proxy.{your-account}.workers.dev";
   const IMG_W = 'https://image.tmdb.org/t/p/w500';
   
   // Remove: const API_KEY = "...";
   ```

2. **Search and replace all patterns:**
   ```javascript
   // Find all: ${API}/
   // Replace with: ${TMDB_PROXY}/
   
   // Find all: ?api_key=${API_KEY}
   // Remove them completely
   ```

3. **Example locations to check:**
   - Search for "trending"
   - Search for "discover"
   - Search for "search"
   - Search for "/movie/"
   - Search for "/tv/"

---

## Testing After Migration

### 1. Check DevTools
- Open Chrome DevTools (F12)
- Go to Network tab
- Refresh page
- **Verify:** No requests show `api_key=` in URL
- **Verify:** Requests go to `tmdb-proxy.*.workers.dev`

### 2. Test Functionality
- [ ] Browse page loads
- [ ] Search works
- [ ] Trending/Top Rated sections populate
- [ ] Modal opens with movie details
- [ ] Trailer loads
- [ ] Images load

### 3. Security Verification
- [ ] Try to extract API key from DevTools → Should fail
- [ ] Try to make direct TMDB call → Should fail (no key in browser)
- [ ] Try to manipulate localStorage to bypass paywall → Should fail (server checks)

### 4. Paywall Testing
- [ ] Logged-out users see paywall
- [ ] Trial users see content
- [ ] Expired subscribers see paywall
- [ ] Active subscribers see content

---

## Common Mistakes to Avoid

❌ **Don't forget to update:**
- Image URL bases (keep using CDN)
- Modal/search API calls
- Genre/language endpoints

❌ **Don't remove:**
- `IMG_W` and `IMG` constants (still needed for images)
- Movie/show data processing logic
- UI/styling code

❌ **Don't hardcode:**
- Worker URLs (use environment variables)
- API keys anywhere
- Secrets in code

✅ **Do remember to:**
- Test in multiple browsers
- Check mobile responsiveness
- Monitor Cloudflare logs
- Verify all endpoints work

---

## Rollback Plan

If issues occur:

1. **Temporarily revert to old code**
   ```bash
   git checkout main -- browse.html index.html
   ```

2. **Check logs for errors**
   - Cloudflare Worker logs
   - Browser console (F12)
   - Network tab (F12)

3. **Fix specific issues**
   - Update Worker URLs
   - Check CORS headers
   - Verify API responses

4. **Re-test and redeploy**

---

## Support

For issues during migration:
1. Check SECURITY_FIXES.md for detailed setup
2. Verify Worker URLs are correct
3. Check Cloudflare Worker logs
4. Verify all env vars are set
5. Test each Worker independently first

---

**Last Updated:** July 3, 2026
**Migration Version:** 1.0
