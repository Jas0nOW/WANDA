import WebSocket from 'ws';
import type { AgentBus } from '@wanda/agent-bus';

export class VoxVoiceSink {
    private elevenLabsWs: WebSocket | null = null;

    constructor(
        private bus: AgentBus,
        private voiceId: string = '21m00Tcm4TlvDq8ikWAM', // Rachel default
        private apiKey: string = process.env.ELEVEN_LABS_API_KEY || ''
    ) {
        if (!this.apiKey) {
            console.warn('[Vox] No ElevenLabs API Key found. Voice output runs in simulation mode.');
        }

        // Listen for Wanda speaking
        this.bus.onOutbound((msg) => {
            // We only vocalize voice commands or specific channels. 
            // For now, let's vocalize all webchat responses.
            if (msg.platform === 'webchat' || msg.platform === 'voice') {
                this.synthesize(msg.text);
            }
        });
    }

    private synthesize(text: string) {
        if (!this.apiKey) {
            console.log(`[Vox Simulation] 🗣️ Synthesizing: "${text.substring(0, 50)}..."`);
            return;
        }

        const model = 'eleven_turbo_v2';
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=${model}`;

        this.elevenLabsWs = new WebSocket(wsUrl);

        this.elevenLabsWs.on('open', () => {
            // 1. Send the initial configuration
            const config = JSON.stringify({
                text: " ",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8
                },
                xi_api_key: this.apiKey
            });
            this.elevenLabsWs?.send(config);

            // 2. Send the actual text (we could stream this chunk by chunk if we hooked into LLM streams,
            // but for now we send the whole outbound message).
            this.elevenLabsWs?.send(JSON.stringify({ text: text }));

            // 3. Send EOS
            this.elevenLabsWs?.send(JSON.stringify({ text: "" }));
        });

        this.elevenLabsWs.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());
            if (response.audio) {
                // In a production system, this audio base64 would be piped to a speaker
                // or broadcasted over WebRTC to the WebChat UI.
                const audioBuffer = Buffer.from(response.audio, 'base64');
                console.log(`[Vox] Received ${audioBuffer.length} bytes of audio data.`);
            }
            if (response.isFinal) {
                this.elevenLabsWs?.close();
            }
        });

        this.elevenLabsWs.on('error', (err) => {
            console.error('[Vox] ElevenLabs WS Error:', err);
        });
    }
}
