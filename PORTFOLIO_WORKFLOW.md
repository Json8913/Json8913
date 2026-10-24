# Portfolio Workflow

## Repository layout

Keep each project in a focused repository:

- port-scanner — scoped TCP scanning for loopback and private lab addresses
- pcap-traffic-analyzer — offline summaries of authorised packet captures
- firewall-simulator — deterministic rule evaluation over sample traffic
- ubuntu-homelab-security — Ubuntu Server and Jellyfin security notes
- lab-ids — offline alerting exercise using saved lab captures

Use a separate repository for CTF writeups, and follow each platform’s publication rules.

## Weekly routine

- Build one small feature in a focused session.
- Update the README with current behaviour and limitations.
- Review the changes and add one or two useful commits with specific messages.
- Add a redacted screenshot only when it helps explain the result.
- Keep project status accurate: Planned, In progress, or Complete.

## Do not publish

- Passwords, API keys, tokens, private SSH keys, Wi-Fi credentials, or local environment files.
- Client information, personal identifiers, unredacted logs, or packet captures containing other people’s data.
- Public IP addresses, private hostnames, or configuration details that expose a home network.
- University assessment content or screenshots when course rules prohibit sharing.
- Code or results from systems you do not own or have permission to assess.
