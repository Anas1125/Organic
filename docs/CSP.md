# Content Security Policy rollout

Cloudflare Pages copies frontend/public/_headers into dist during the Vite build. The initial policy is **report-only**: browsers log violations but do not block resources. The other three security headers are enforced immediately. Cloudflare Pages Functions must set their own response headers if serving HTML.

The early branding script is now a same-origin external file. Inline styles remain permitted for React dynamic styling and payment widgets; inline scripts and eval are not permitted by the proposed policy. HTTPS images and media are allowed to support seller media and configurable storage. The policy allows the existing API, Razorpay, Google Fonts, YouTube and Vimeo. This is a starting allowlist, not a verified list of every provider resource.

## Preview checklist

1. Build with npm run build and check dist/_headers and dist/branding-init.js exist.
2. On the Pages preview deployment inspect the document response in DevTools Network. Confirm Content-Security-Policy-Report-Only is present on both / and a directly loaded SPA route.
3. Open DevTools Console and test registration, login, OTP, password reset, buyer/seller/admin dashboards, product photos/videos, YouTube/Vimeo embeds, uploads, private documents and Razorpay checkout in test mode (success, failure and cancellation).
4. Investigate CSP warnings; add only required trusted origins. Do not add unsafe-inline or unsafe-eval to script-src just to silence warnings.
5. After preview testing passes, rename Content-Security-Policy-Report-Only to Content-Security-Policy in _headers, redeploy, and repeat tests. Roll back to report-only if a critical flow breaks.

There is no remote violation collector configured; review browser console output during testing. CSP is defense in depth and does not replace output encoding or server-side authorization. This change does not migrate authentication tokens to cookies.
