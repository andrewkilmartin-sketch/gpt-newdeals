import { Express } from 'express';
import multer from 'multer';
import { textToSpeech, speechToText, parseIntent, getRandomGreeting, getRandomTransition, getRandomError } from '../services/voice';

export function registerVoiceRoutes(app: Express): void {
  const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post('/api/voice/tts', async (req, res) => {
    try {
      const { text, voice = 'shimmer' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`[Voice TTS] Generating speech for: "${text.substring(0, 50)}..." with voice: ${voice}`);
      
      const audioBuffer = await textToSpeech(text, voice);
      
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error: any) {
      console.error('[Voice TTS] Error:', error);
      res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
    }
  });

  app.post('/api/voice/stt', voiceUpload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }
      
      console.log(`[Voice STT] Transcribing audio: ${req.file.size} bytes, type: ${req.file.mimetype}`);
      
      const text = await speechToText(req.file.buffer, req.file.mimetype);
      
      console.log(`[Voice STT] Transcription: "${text}"`);
      
      res.json({ text });
    } catch (error: any) {
      console.error('[Voice STT] Error:', error);
      res.status(500).json({ error: 'Speech-to-text failed', details: error.message });
    }
  });

  app.post('/api/voice/parse-intent', async (req, res) => {
    try {
      const { text, context = [] } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`[Voice Intent] Parsing: "${text}"`);
      
      const intent = await parseIntent(text, context);
      
      console.log(`[Voice Intent] Result:`, JSON.stringify(intent));
      
      res.json(intent);
    } catch (error: any) {
      console.error('[Voice Intent] Error:', error);
      res.status(500).json({ error: 'Intent parsing failed', details: error.message });
    }
  });

  app.get('/api/voice/greeting', (req, res) => {
    const isFirst = req.query.first !== 'false';
    const greeting = getRandomGreeting(isFirst);
    res.json({ greeting, isFirst });
  });

  app.get('/api/voice/transition', (req, res) => {
    const transition = getRandomTransition();
    res.json({ transition });
  });

  app.get('/api/voice/error', (req, res) => {
    const type = (req.query.type as 'not_understood' | 'inappropriate' | 'off_topic' | 'no_results') || 'not_understood';
    const message = getRandomError(type);
    res.json({ message, type });
  });
}
