# Resolving Nginx 502 Due to Oversized Upstream Headers

When Flask session data (e.g., `analysis_cache`) grows large, Nginx can reject the response with a `502 Bad Gateway` and log:

```
upstream sent too big header while reading response header from upstream
```

This indicates that Nginx’s default buffer sizes are insufficient for the size of the `Set-Cookie` (or other headers) Flask is sending.

---

## Symptoms

- Browser console shows: 
```
GET [https://...[endpoint)] 502 (Bad Gateway)
SyntaxError: Unexpected token '<', "<html>..." is not valid JSON
```
- Visiting `https://your.domain/prioritize/0` returns a 502.
- Nginx error log contains:
```
error: upstream sent too big header while reading response header from upstream
```

---

## Immediate Fix: Increase Nginx Buffer Sizes

1. **Open your Nginx vhost** (e.g., `/etc/nginx/sites-enabled/AirPrio.aifoudahub.com`).
2. **Within the `server {}` block** (above or inside `location / {}`), add:
   ```nginx
   # Allow larger upstream response headers (e.g., big Set-Cookie)
   proxy_buffer_size           256k;
   proxy_buffers               8 512k;
   proxy_busy_buffers_size     512k;
   proxy_temp_file_write_size  512k;
   ```
3. **Save** and **test configuration**:

   ```bash
   sudo nginx -t
   ```
4. **Reload Nginx**:

   ```bash
   sudo systemctl reload nginx
   ```

These settings allow Nginx to handle response headers up to several hundred kilobytes, preventing the “too big header” error.

### Example Full Nginx `server` Block

```nginx
server {
    listen 443 ssl;
    server_name aiprio.aifoudahub.com;

    ssl_certificate /etc/letsencrypt/live/aiprio.aifoudahub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aiprio.aifoudahub.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ─────────────────────────────────────────────────────────────────
    # (1) Increase proxy buffer sizes so Nginx can handle large headers
    # ─────────────────────────────────────────────────────────────────
    proxy_buffer_size           128k;
    proxy_buffers               4 256k;
    proxy_busy_buffers_size     256k;
    proxy_temp_file_write_size  256k;

    location / {
        proxy_pass http://unix:/var/www/AirPrio/airprio.sock;
        proxy_set_header Host             $host;
        proxy_set_header X-Real-IP        $remote_addr;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep your existing timeouts:
        proxy_read_timeout    300s;
        proxy_send_timeout    300s;
        proxy_connect_timeout 300s;
    }
}
```

---

## Alternative (Recommended) Fix: Reduce Cookie Size / Use Server-Side Session

* Currently, `analysis_cache` is stored in Flask’s session and sent as a large client cookie.
* **Best practice**: Move session data to a server-side store (e.g., Redis, database, or filesystem). The cookie will then only contain a small session ID.

  * Example: Remove or comment out:

    ```python
    # analysis_cache[row_index] = result_data
    # session['analysis_cache'] = analysis_cache
    ```
  * Instead, cache results on server disk (e.g., `/var/www/AirPrio/cache/<session_id>.json`) and keep only a reference in the cookie.
* This keeps response headers small (few hundred bytes) and eliminates reliance on large Nginx buffers.

---

## Why This Matters Long-Term

* **Small CSV (≈13 KB)** and minimal AI results: current 256 KB–512 KB buffers are more than enough.
* **Future growth**: If CSV or analysis results grow (e.g., 1 MB), the “too big header” error can reappear unless:

  1. Buffers are increased further (e.g., `proxy_buffer_size 512k; proxy_buffers 16 1m;`).
  2. Or, preferably, switch to server-side sessions to keep cookies small.

---

## Summary of Steps

1. **Identify** Nginx error `upstream sent too big header` in `/var/log/nginx/error.log`.
2. **Quick fix**: Increase buffer sizes in Nginx vhost:

   ```nginx
   proxy_buffer_size           256k;
   proxy_buffers               8 512k;
   proxy_busy_buffers_size     512k;
   proxy_temp_file_write_size  512k;
   ```
3. **Restart**:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. **Recommended**: Refactor Flask session logic to store large data server-side.

With these changes, Nginx will successfully proxy large response headers, and your Flask app can scale without hitting buffer limits.
