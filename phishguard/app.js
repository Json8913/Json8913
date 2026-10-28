(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pasteTab = $('paste-tab');
  const manualTab = $('manual-tab');
  const pasteView = $('paste-view');
  const manualView = $('manual-view');
  const emailInput = $('email-input');
  const analyzerButton = $('analyze-button');
  const MAX_CHARS = 200000;
  const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'rb.gy', 'lnkd.in']);
  const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
  const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  const setMode = (mode) => {
    const paste = mode === 'paste';
    pasteView.classList.toggle('hidden', !paste);
    manualView.classList.toggle('hidden', paste);
    pasteTab.classList.toggle('active', paste);
    manualTab.classList.toggle('active', !paste);
    pasteTab.setAttribute('aria-selected', String(paste));
    manualTab.setAttribute('aria-selected', String(!paste));
    updateCount();
  };

  pasteTab.addEventListener('click', () => setMode('paste'));
  manualTab.addEventListener('click', () => setMode('manual'));

  function readInput() {
    if (!pasteView.classList.contains('hidden')) {
      const raw = emailInput.value.trim();
      if (!raw) return { error: 'Paste an email or try the sample to get started.' };
      const split = raw.split(/\r?\n\r?\n/);
      const headerBlock = split.length > 1 && /^(from|to|subject|date|received|return-path|authentication-results|reply-to):/im.test(split[0]) ? split.shift() : '';
      return { raw, headers: headerBlock, body: split.join('\n\n'), subject: getHeader(headerBlock, 'subject'), sender: getHeader(headerBlock, 'from') };
    }
    const sender = $('sender-input').value.trim();
    const subject = $('subject-input').value.trim();
    const body = $('body-input').value.trim();
    const headers = $('headers-input').value.trim();
    if (!sender && !subject && !body && !headers) return { error: 'Add some email details or try the sample to get started.' };
    return { raw: [sender && `From: ${sender}`, subject && `Subject: ${subject}`, headers, body].filter(Boolean).join('\n\n'), headers: [sender && `From: ${sender}`, headers].filter(Boolean).join('\n'), sender, subject, body };
  }

  function getHeader(block, name) {
    const match = block.match(new RegExp(`^${name}:\\s*(.+(?:\\n[ \\t].+)*)`, 'im'));
    return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
  }

  function extractLinks(text) {
    const links = [];
    const seen = new Set();
    // Read href destinations and visible anchor labels without rendering untrusted HTML.
    const anchorRegex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi;
    let anchor;
    while ((anchor = anchorRegex.exec(text)) !== null) {
      const target = cleanUrl(anchor[2]);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      const visible = anchor[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      links.push({ url: target, label: visible });
    }
    for (const match of text.matchAll(URL_REGEX)) {
      const target = cleanUrl(match[0]);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      links.push({ url: target, label: '' });
    }
    return links.slice(0, 60);
  }

  function cleanUrl(value) {
    let url = value.trim().replace(/[),.;!?\]}]+$/g, '');
    if (/^www\./i.test(url)) url = `http://${url}`;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch { return ''; }
  }

  function domainOf(value) {
    try { return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return ''; }
  }

  function getAddress(value) {
    const match = value.match(EMAIL_REGEX);
    return match ? match[0].toLowerCase() : '';
  }

  function addSignal(signals, severity, title, detail, points) {
    signals.push({ severity, title, detail, points });
  }

  function analyze(input) {
    const signals = [];
    const full = input.raw || '';
    const headers = input.headers || '';
    const body = input.body || full;
    const allText = `${input.subject || ''}\n${body}`;
    const senderAddress = getAddress(input.sender || getHeader(headers, 'from') || full);
    const replyAddress = getAddress(getHeader(headers, 'reply-to'));
    const returnAddress = getAddress(getHeader(headers, 'return-path'));

    if (!senderAddress) addSignal(signals, 'warn', 'Sender address not available', 'A display name alone cannot confirm who sent this message. Check the full address in your mail app.', 4);
    if (senderAddress && replyAddress && senderAddress.split('@')[1] !== replyAddress.split('@')[1]) {
      addSignal(signals, 'bad', 'Reply-To domain differs from sender', `Replies go to ${replyAddress.split('@')[1]}, while the sender is ${senderAddress.split('@')[1]}.`, 22);
    }
    if (senderAddress && returnAddress && senderAddress.split('@')[1] !== returnAddress.split('@')[1]) {
      addSignal(signals, 'warn', 'Return-Path domain differs', `The delivery return address uses ${returnAddress.split('@')[1]} rather than the sender’s domain. This can be legitimate for mailing services, but deserves a check.`, 8);
    }
    const auth = headers.match(/(?:authentication-results|received-spf):[^\n]*(?:\n[ \t][^\n]*)*/ig) || [];
    const authText = auth.join(' ').toLowerCase();
    const authFails = ['spf', 'dkim', 'dmarc'].filter((name) => new RegExp(`${name}\\s*=\\s*fail|${name}\\s+fail|${name}\\s*=\\s*softfail`).test(authText));
    if (authFails.length) addSignal(signals, 'bad', 'Email authentication failure reported', `Headers report ${authFails.map(s => s.toUpperCase()).join(', ')} failure. This can indicate spoofing, though forwarding and misconfiguration can also cause failures.`, Math.min(28, authFails.length * 12));
    else if (/spf\s*=\s*pass/.test(authText) && /dkim\s*=\s*pass/.test(authText) && /dmarc\s*=\s*pass/.test(authText)) {
      addSignal(signals, 'good', 'SPF, DKIM, and DMARC pass', 'The provided headers report successful authentication. This supports sender authenticity but does not prove the message is safe.', -12);
    } else if (authText) addSignal(signals, 'warn', 'Authentication results are mixed or incomplete', 'The available headers do not show a clear pass for all common email authentication checks.', 5);
    else addSignal(signals, 'warn', 'Authentication results unavailable', 'No Authentication-Results header was found in the supplied text. Your mail provider may show these checks separately.', 3);

    const links = extractLinks(full);
    const linkFlags = [];
    for (const link of links) {
      const domain = domainOf(link.url);
      const parsed = new URL(link.url);
      const flags = [];
      if (parsed.protocol !== 'https:') flags.push('No HTTPS');
      if (SHORTENERS.has(domain)) flags.push('Shortened URL');
      if (parsed.username || parsed.password) flags.push('Hidden credentials');
      if (domain.startsWith('xn--') || /[^\x00-\x7F]/.test(domain)) flags.push('Unusual domain characters');
      if (/\d{1,3}(?:\.\d{1,3}){3}/.test(domain)) flags.push('IP address as domain');
      if (link.label) {
        const labelDomain = domainOf(link.label);
        if (labelDomain && labelDomain !== domain && !labelDomain.endsWith(`.${domain}`) && !domain.endsWith(`.${labelDomain}`)) flags.push('Visible link text differs');
      }
      const brandWords = ['paypal', 'microsoft', 'apple', 'google', 'amazon', 'outlook', 'office365', 'icloud'];
      const secondLevel = domain.split('.').slice(-2, -1)[0] || domain;
      if (brandWords.some((brand) => secondLevel.includes(brand) && !domain.endsWith(`${brand}.com`) && !domain.endsWith(`${brand}.com.au`))) flags.push('Brand-like domain');
      if (flags.length) linkFlags.push({ ...link, domain, flags });
    }
    if (linkFlags.length) {
      const flagCount = linkFlags.reduce((n, item) => n + item.flags.length, 0);
      addSignal(signals, flagCount >= 3 ? 'bad' : 'warn', `${linkFlags.length} link${linkFlags.length === 1 ? '' : 's'} with suspicious traits`, `${linkFlags.slice(0, 2).map(item => `${item.domain}: ${item.flags.join(', ')}`).join('; ')}${linkFlags.length > 2 ? '; and more' : ''}.`, Math.min(35, 9 + flagCount * 5));
    } else if (links.length) addSignal(signals, 'good', 'No obvious link pattern flagged', `${links.length} link${links.length === 1 ? '' : 's'} checked for common suspicious patterns. This does not verify their live destination or reputation.`, -3);
    else addSignal(signals, 'good', 'No web links found', 'No HTTP or HTTPS links were detected in the supplied content.', -2);

    const cues = [
      { re: /\b(urgent|immediately|act now|within 24 hours|right away|final notice|expires today)\b/i, title: 'Urgent or deadline pressure', detail: 'The message pushes you to act quickly, a common way to discourage careful checks.', points: 12 },
      { re: /\b(verify|confirm|restore|suspend|locked|unusual activity|account will be|account has been)\b/i, title: 'Account threat or verification request', detail: 'It mentions account access or asks for verification. Confirm requests through the service’s official app or website.', points: 12 },
      { re: /\b(password|sign in|log ?in|credentials|one[- ]time code|security code|2fa|mfa)\b/i, title: 'Login or security details mentioned', detail: 'The message refers to credentials or sign-in codes. Never share a one-time code from an email link.', points: 10 },
      { re: /\b(gift card|wire transfer|bank details|payment|invoice overdue|payment failed|crypto|cryptocurrency)\b/i, title: 'Payment or financial pressure', detail: 'Financial actions or payment problems are mentioned. Verify payment requests independently.', points: 11 },
      { re: /\b(attachment|attached file|open the document|enable macros|download the file)\b/i, title: 'Attachment or download prompt', detail: 'The message encourages opening or downloading a file. Unexpected attachments can carry malware.', points: 8 },
      { re: /\b(you have won|claim your prize|lottery|free money|congratulations)\b/i, title: 'Prize or unexpected reward', detail: 'Unexpected prizes and rewards are often used to lure people into sharing information.', points: 9 }
    ];
    for (const cue of cues) if (cue.re.test(allText)) addSignal(signals, 'warn', cue.title, cue.detail, cue.points);
    if (signals.length === 0) addSignal(signals, 'good', 'No common warning signs detected', 'This message did not match the basic checks. A clean result cannot guarantee an email is safe.', 0);

    let score = Math.max(0, Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0)));
    const level = score >= 55 ? 'high' : score >= 25 ? 'medium' : 'low';
    // Present a neutral result when the message is too sparse to support a useful estimate.
    const sparse = full.replace(/\s/g, '').length < 25;
    return { score: sparse ? Math.max(score, 15) : score, level: sparse ? 'limited' : level, signals, links, linkFlags };
  }

  function displayResult(result) {
    $('empty-state').classList.add('hidden');
    $('results').classList.remove('hidden');
    const score = result.score;
    const isLimited = result.level === 'limited';
    $('score-value').textContent = score;
    $('verdict-title').textContent = isLimited ? 'Not enough detail' : result.level === 'high' ? 'High risk detected' : result.level === 'medium' ? 'Some warning signs' : 'Few warning signs found';
    $('verdict-summary').textContent = isLimited ? 'Add the email body, sender, or headers for a more useful analysis.' : result.level === 'high' ? 'Several strong warning signs are present. Treat this email as suspicious and verify it independently.' : result.level === 'medium' ? 'This email has some patterns worth checking before you respond or follow any links.' : 'The checks found few common phishing indicators. This is not proof that the email is safe.';
    $('risk-label').textContent = isLimited ? 'LIMITED' : result.level.toUpperCase();
    $('risk-label').style.color = result.level === 'high' ? '#cc5362' : result.level === 'medium' ? '#d28c34' : result.level === 'limited' ? '#868697' : '#438f70';
    $('meter-fill').style.width = `${score}%`;
    $('meter-fill').style.background = result.level === 'high' ? '#d95865' : result.level === 'medium' ? '#e7a24d' : '#50ad82';
    $('score-badge').style.borderColor = result.level === 'high' ? '#f1cdd1' : result.level === 'medium' ? '#f5e2c9' : '#e6e3f6';
    $('score-badge').style.color = result.level === 'high' ? '#c34e5b' : result.level === 'medium' ? '#bd8339' : '#5141b8';
    $('signal-count').textContent = `${result.signals.length} signal${result.signals.length === 1 ? '' : 's'}`;
    $('signal-list').innerHTML = result.signals.map(signal => `<div class="signal"><span class="signal-icon ${signal.severity}">${signal.severity === 'good' ? '✓' : '!'}</span><div class="signal-text"><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.detail)}</p></div></div>`).join('');
    const linkSummary = $('link-summary');
    if (result.links.length) {
      linkSummary.classList.remove('hidden');
      $('link-count').textContent = `${result.links.length} found`;
      $('link-list').innerHTML = result.links.slice(0, 8).map(link => {
        const domain = domainOf(link.url) || link.url;
        const flagged = result.linkFlags.find(f => f.url === link.url);
        const badge = flagged ? flagged.flags[0] : 'No pattern flagged';
        return `<div class="link-row"><span title="${escapeHtml(link.url)}">${escapeHtml(domain)}</span><em class="${flagged ? '' : 'safe'}">${escapeHtml(badge)}</em></div>`;
      }).join('');
    } else linkSummary.classList.add('hidden');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function updateCount() {
    const text = !pasteView.classList.contains('hidden') ? emailInput.value : ['sender-input','subject-input','body-input','headers-input'].map(id => $(id).value).join(' ');
    $('char-count').textContent = `${text.length.toLocaleString()} characters`;
  }
  [emailInput, $('sender-input'), $('subject-input'), $('body-input'), $('headers-input')].forEach(el => el.addEventListener('input', updateCount));

  analyzerButton.addEventListener('click', () => {
    $('input-error').hidden = true;
    const input = readInput();
    if (input.error) { $('input-error').textContent = input.error; $('input-error').hidden = false; return; }
    if (input.raw.length > MAX_CHARS) { $('input-error').textContent = 'This email is too large to analyze. Please use a message under 200,000 characters.'; $('input-error').hidden = false; return; }
    displayResult(analyze(input));
  });

  $('sample-button').addEventListener('click', () => {
    setMode('paste');
    emailInput.value = `From: Security Team <security@micros0ft-account.net>\nReply-To: helpdesk@verify-access.co\nSubject: Urgent: Your account will be suspended\nAuthentication-Results: mx.example.net; spf=fail; dkim=fail; dmarc=fail\n\nWe noticed unusual activity on your account. Verify your password immediately to avoid suspension. Your access expires today.\n\n<a href="http://bit.ly/secure-login">Sign in to Microsoft</a>`;
    updateCount();
    emailInput.focus();
  });

  $('reset-button').addEventListener('click', () => {
    $('results').classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    document.querySelector('.analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  updateCount();
})();
