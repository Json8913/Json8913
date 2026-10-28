# Analysis design notes

## Data flow

The app reads the user's pasted text, separates likely headers from body text, extracts a small set of header fields, and scans the content in memory. It never injects the email's HTML into the page. Link destinations are parsed as URL strings, not opened. Results are assembled as text and escaped before display.

## Score model

Each rule emits a finding with a severity, an explanation, and a point adjustment. Adjustments are added and clamped to 0–100. The result is grouped as low (0–24), medium (25–54), or high (55–100). The score makes the output easy to scan; it is not a probability that the email is malicious.

The values are intentionally simple and visible in `app.js`. They are starting heuristics, not calibrated model weights. Authentication failures and mismatched reply routing receive more weight than missing evidence. Several message cues and suspicious URL traits may add weight. Reported authentication passes and unflagged URLs reduce a small amount, because they cannot prove safety.

## Header parsing

The paste mode treats text before the first blank line as headers when it begins with a familiar email header name. It reads `From`, `Reply-To`, `Return-Path`, `Subject`, `Authentication-Results`, and `Received-SPF` text. Raw headers are often folded across lines, so continuation lines beginning with whitespace are joined for field extraction.

## URL inspection

The app finds plain HTTP(S)/`www` URLs and quoted `href` values from simple anchor markup. It does not parse or display HTML as markup. It checks a small static list of well-known shorteners, insecure HTTP, IP hosts, punycode/non-ASCII names, embedded URL credentials, common brand-like domains, and visible-label/domain mismatches. It does not follow redirects, make DNS requests, or query reputation databases.

## Future improvements

- Add robust RFC 5322 / MIME parsing for forwarded, multipart, and folded messages.
- Add carefully scoped, opt-in URL reputation checks through a server-side proxy that protects user privacy and prevents server-side request forgery.
- Calibrate scoring against a representative, labeled dataset and report uncertainty.
- Add a replaceable classifier interface only when a model and data-handling policy are chosen. Keep any secrets on a server, never in browser code.
