# PhishGuard — Email Phishing Risk Analyzer

PhishGuard is a small, browser-based tool that reviews pasted email content for common phishing warning signs. It checks message wording, sender and reply addresses, reported email authentication results, and URLs. It explains which signals affected its risk estimate.

**The analysis runs locally in your browser.** The app does not upload or store pasted email content, make requests to URLs found in the message, or use a remote AI service. The current scoring engine uses transparent rules; it is not a trained AI model. It should be treated as a first-pass aid, not as a security guarantee.

## Run it

No build tools or package installation are required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Paste a full email, including headers when available, or choose **Enter details** to fill in individual fields.
4. Select **Analyze email** and review the findings and explanations.

For a local web server, run `python3 -m http.server 8000` from this directory and visit `http://localhost:8000`.

## What it checks

- **Sender and routing:** missing sender address, differing `Reply-To` or `Return-Path` domains.
- **Authentication results:** SPF, DKIM, and DMARC pass or failure text when included in the supplied headers.
- **URLs:** non-HTTPS links, common URL shorteners, IP address hosts, embedded user information, IDN/punycode domains, some brand-like domains, and mismatches between a link's visible text and its destination.
- **Message cues:** urgency, account threats, requests around login details, financial pressure, unexpected attachments, and prize language.

The score combines these signals into a low, medium, or high estimate. Positive authentication results and lack of obvious suspicious URL patterns can reduce the score slightly, but never establish that an email is safe.

## Limits and safe use

- PhishGuard does not resolve redirects, fetch URLs, check domain age, query threat-intelligence services, inspect attachments, validate DKIM signatures, or independently verify SPF/DMARC. It only interprets text present in the email you provide.
- Authentication results can be absent, forged in pasted text, or affected by forwarding and mail configuration. Trust results shown by your own email provider more than copied headers.
- Link pattern checks are heuristic and may miss new attacks or flag legitimate links. A URL that looks ordinary can still be malicious.
- The score is an estimate, not an antivirus verdict. If an email asks for a password, one-time code, payment, or urgent action, verify through a separate channel you already trust.
- Avoid pasting confidential or regulated information into tools unless your organization permits it, even when an app says processing is local.

## Project files

- `index.html` — accessible app structure and interface
- `styles.css` — responsive visual design
- `app.js` — local parsing, scoring, and results rendering
- `docs/analysis.md` — scoring and design notes

## License

MIT. See [LICENSE](LICENSE).
