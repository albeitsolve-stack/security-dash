const express = require('express');
const path = require('path');
const app = express();

// Railway provides a dynamic port, fallback to 3000 for local testing
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies from frontend telemetry
app.use(express.json());

// Serve static HTML/CSS files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to receive telemetry from browser and forward to Discord
app.post('/api/security-telemetry', async (req, res) => {
    try {
        const telemetry = req.body;
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error('DISCORD_WEBHOOK_URL is not set in environment variables!');
            return res.status(500).json({ error: 'Webhook configuration missing' });
        }

        // Format the collected data neatly for Discord
        const discordPayload = {
            embeds: [{
                title: "🛡️ New Security Telemetry Log",
                color: 3447003, // Blue
                fields: [
                    { name: "🖥️ Screen & Device", value: `Resolution: ${telemetry.screen}\nColor Depth: ${telemetry.colorDepth}\nPixelRatio: ${telemetry.pixelRatio}\nCPU Cores: ${telemetry.cpuCores}\nMemory: ${telemetry.deviceMemory}\nTouch Points: ${telemetry.maxTouchPoints}`, inline: false },
                    { name: "🤖 Automation / Bot Check", value: `Webdriver: ${telemetry.webdriver}`, inline: false },
                    { name: "🎨 Canvas & GPU", value: `Canvas Sig: \`${telemetry.canvasSignature}\`\nGPU: ${telemetry.gpu}`, inline: false },
                    { name: "⚡ Battery & Network", value: `Battery: ${telemetry.battery}\nNetwork: ${JSON.stringify(telemetry.network)}`, inline: false },
                    { name: "🌐 WebRTC IPs", value: `${telemetry.webrtcIps}`, inline: false },
                    { name: "🔌 Peripherals", value: telemetry.peripherals && telemetry.peripherals.length > 0 ? telemetry.peripherals.join('\n') : 'None exposed', inline: false }
                ],
                timestamp: new Date().toISOString()
            }]
        };

        // Send the payload to Discord
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
        console.error('Error forwarding telemetry to Discord:', err);
        res.status(500).json({ error: 'Failed to process telemetry' });
    }
});

// Bind to '0.0.0.0' so Railway's proxy can route external traffic to your app
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Security Dashboard server running on port ${PORT}`);
});