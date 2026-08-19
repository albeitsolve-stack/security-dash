const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/security-telemetry', async (req, res) => {
    try {
        const telemetry = req.body;
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error('DISCORD_WEBHOOK_URL is not set!');
            return res.status(500).json({ error: 'Webhook configuration missing' });
        }

        // 1. Capture real client IP from Railway proxy headers
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'Unknown';

        // 2. Fetch professional GeoIP data (Location, ISP, VPN/Proxy check)
        let geoData = { country: 'Unknown', region: 'Unknown', city: 'Unknown', isp: 'Unknown', org: 'Unknown', hosting: false };
        try {
            if (clientIp !== 'Unknown' && clientIp !== '127.0.0.1' && clientIp !== '::1') {
                const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,regionName,city,isp,org,hosting,query`);
                const geoJson = await geoRes.json();
                if (geoJson.status === 'success') {
                    geoData = geoJson;
                }
            }
        } catch (geoErr) {
            console.error('Failed to fetch GeoIP:', geoErr);
        }

        // 3. Format network parameters cleanly
        const netType = telemetry.network?.effectiveType ? telemetry.network.effectiveType.toUpperCase() : '4G';
        const downlink = telemetry.network?.downlink ? `${telemetry.network.downlink} Mbps` : 'Unknown';
        const rtt = telemetry.network?.rtt ? `${telemetry.network.rtt} ms` : 'Unknown';

        // 4. Build professional, highly organized single Discord embed
        const discordPayload = {
            embeds: [{
                title: "🛡️ Security Telemetry & Visitor Report",
                color: geoData.hosting ? 0xef4444 : 0x3b82f6, // Red accent if VPN/Proxy, Blue if normal user
                description: "A secure session handshake was intercepted and fully analyzed.",
                fields: [
                    {
                        name: "🌐 Network & Geolocation",
                        value: [
                            `• **IP Address:** \`${clientIp}\``,
                            `• **Location:** \`${geoData.city}, ${geoData.region}, ${geoData.country}\``,
                            `• **ISP / Org:** \`${geoData.isp} (${geoData.org})\``,
                            `• **VPN / Datacenter:** ${geoData.hosting ? '🚨 **Yes (Hosting/Proxy detected)**' : '✅ No (Residential/Mobile)'}`,
                            `• **Connection:** \`${netType}\` (Downlink: \`${downlink}\`, RTT: \`${rtt}\`)`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: "💻 Hardware & Display",
                        value: [
                            `• **Resolution:** \`${telemetry.screen}\` (${telemetry.colorDepth}-bit, \`${telemetry.pixelRatio}x\` ratio)`,
                            `• **CPU Cores:** \`${telemetry.cpuCores}\` | **RAM:** \`${telemetry.deviceMemory}\``,
                            `• **Touch Points:** \`${telemetry.maxTouchPoints}\` | **Battery:** \`${telemetry.battery}\``
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: "🤖 Browser & Bot Fingerprint",
                        value: [
                            `• **WebDriver Flag:** ${telemetry.webdriver ? '🚨 True (Headless Bot)' : '✅ False (Standard Browser)'}`,
                            `• **GPU Renderer:** \`${telemetry.gpu}\``,
                            `• **Canvas Signature:** \`${telemetry.canvasSignature}\``
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: "🔌 Connected Peripherals",
                        value: `\`\`\`${telemetry.peripherals && telemetry.peripherals.length > 0 ? telemetry.peripherals.join('\n') : 'No public devices exposed'}\`\`\``,
                        inline: false
                    }
                ],
                footer: {
                    text: "Security Telemetry Gateway • Real-time Inspection"
                },
                timestamp: new Date().toISOString()
            }]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        });

        if (!response.ok) {
            throw new Error(`Discord API responded with status ${response.status}`);
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error forwarding telemetry:', err);
        res.status(500).json({ error: 'Failed to process telemetry' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Security Dashboard server running on port ${PORT}`);
});