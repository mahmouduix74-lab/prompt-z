import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { EXACT_SYSTEM_INSTRUCTION, DOMAINS, DEPTHS } from './src/constants';
import { refineLocalPromptText } from './src/services/localRefiner';
import { generateLocalStructuredPrompt } from './src/services/localEngine';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasServerKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Helper to ensure only active, modern models are invoked and map deprecated ones
function sanitizeModelId(raw?: string): string {
  if (!raw || !raw.trim()) return 'gemini-3.8-flash';
  const clean = raw.trim().replace(/^models\//, '');
  // Map deprecated or retired models to active recommended models
  if (clean.includes('2.5-flash') || clean.includes('2.0-flash') || clean.includes('1.5-flash')) {
    return 'gemini-3.6-flash';
  }
  if (clean.includes('2.5-pro') || clean.includes('2.0-pro') || clean.includes('1.5-pro')) {
    return 'gemini-3.1-pro-preview';
  }
  return clean || 'gemini-3.8-flash';
}

// Robust Generation helper with automatic failover cascade on 503 (high demand) or 429 (rate limits)
async function generateWithGeminiCascade(
  client: GoogleGenAI,
  primaryModel: string | undefined,
  params: {
    contents: any;
    config: any;
  }
): Promise<{ text: string; modelUsed: string }> {
  const cleanPrimary = sanitizeModelId(primaryModel);
  // Candidate models to attempt sequentially if one encounters high demand (503) or rate limits (429)
  const candidates = Array.from(
    new Set([
      cleanPrimary,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ])
  );

  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const response = await client.models.generateContent({
        model: candidate,
        contents: params.contents,
        config: params.config,
      });

      let text = (response.text || '').trim();
      if (!text && response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text && !part.thought) {
            text += part.text;
          }
        }
        text = text.trim();
      }

      if (text) {
        return { text, modelUsed: candidate };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        err?.status === 503 ||
        err?.status === 429;

      if (isTransient && i < candidates.length - 1) {
        console.warn(
          `[Model Failover] ${candidate} busy (${err?.status || 503}), attempting ${candidates[i + 1]}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('No candidate model could fulfill the request.');
}

// Endpoint: Fetch available models
app.get('/api/models', async (req, res) => {
  try {
    const userApiKey = (req.headers['x-api-key'] as string) || '';
    const activeKey = userApiKey.trim() || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'No API key provided and no server key configured.',
        },
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      activeKey
    )}`;

    const googleRes = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': activeKey,
      },
    });

    const data = await googleRes.json().catch(() => null);

    if (!googleRes.ok) {
      return res.status(googleRes.status).json(data);
    }

    // Deprecated models that return 404 or are prohibited by guidelines
    const DEPRECATED_SUBSTRINGS = ['gemini-1.5', 'gemini-2.0', 'gemini-2.5', 'gemini-pro', 'aqa'];

    const eligibleModels = (data.models || [])
      .filter((m: any) => {
        const methods: string[] = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        const rawName: string = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        // Exclude deprecated / retired models
        if (DEPRECATED_SUBSTRINGS.some((dep) => cleanId.includes(dep))) {
          return false;
        }
        return true;
      })
      .map((m: any) => {
        const rawName: string = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        return {
          id: cleanId,
          name: rawName,
          displayName: m.displayName || cleanId,
          description: m.description,
          supportedGenerationMethods: m.supportedGenerationMethods,
        };
      })
      .sort((a: any, b: any) => {
        const priorityOrder = [
          'gemini-3.8-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3.1-flash-lite',
          'gemini-3.1-pro-preview',
        ];
        const idxA = priorityOrder.indexOf(a.id);
        const idxB = priorityOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.id.localeCompare(b.id);
      });

    // If Google returned only legacy models, ensure the primary models are provided
    if (eligibleModels.length === 0) {
      eligibleModels.push(
        { id: 'gemini-3.8-flash', name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (افتراضي)' },
        { id: 'gemini-3.6-flash', name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash' },
        { id: 'gemini-3.1-pro-preview', name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro' },
        { id: 'gemini-3.1-flash-lite', name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' }
      );
    }

    return res.json({ models: eligibleModels });
  } catch (err: any) {
    return res.status(500).json({
      error: {
        code: 500,
        message: err?.message || 'Failed to fetch models from Gemini server.',
      },
    });
  }
});

// Endpoint: Generate Structured Prompt via Server-side Gemini API
app.post('/api/generate', async (req, res) => {
  const { rawText, exclusions, domain, depth, model, systemInstruction, outputLanguage } = req.body || {};

  if (!rawText || !rawText.trim()) {
    return res.status(400).json({
      error: { code: 400, message: 'Text input is required.' },
    });
  }

  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const activeKey = userApiKey.trim() || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    const fallbackPrompt = generateLocalStructuredPrompt({
      rawText: rawText.trim(),
      domain: (domain as any) || 'general',
      depth: (depth as any) || 'standard',
      outputLanguage: (outputLanguage as any) || 'match',
    });
    return res.json({ result: fallbackPrompt, fallbackUsed: true, modelUsed: 'Local Smart Engine' });
  }

  try {
    const domainObj = DOMAINS.find((d) => d.id === domain) || DOMAINS[0];
    const depthObj = DEPTHS.find((d) => d.id === depth) || DEPTHS[1];
    const baseInstruction = (systemInstruction || EXACT_SYSTEM_INSTRUCTION).trim();

    let fullSystemInstruction = `${baseInstruction}\n\n${domainObj.instructionLine}\n${depthObj.instructionLine}`;

    if (exclusions && exclusions.trim()) {
      fullSystemInstruction += `\nUser explicitly specified the following exclusions (append as negative lines under # OUTPUT RULES):\n${exclusions.trim()}`;
    }

    const client = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const { text: generatedText, modelUsed } = await generateWithGeminiCascade(client, model, {
      contents: [{ role: 'user', parts: [{ text: rawText.trim() }] }],
      config: {
        systemInstruction: fullSystemInstruction,
        temperature: 0.3,
      },
    });

    return res.json({ result: generatedText, modelUsed });
  } catch (err: any) {
    console.warn('[Generate Resilience] Gemini unavailable/busy, using smart local engine fallback:', err?.message || err);
    const fallbackPrompt = generateLocalStructuredPrompt({
      rawText: rawText.trim(),
      domain: (domain as any) || 'general',
      depth: (depth as any) || 'standard',
      outputLanguage: (outputLanguage as any) || 'match',
    });
    return res.json({ result: fallbackPrompt, fallbackUsed: true, modelUsed: 'Local Smart Engine' });
  }
});

// Endpoint: Refine & enhance prompt text with extra clarification instructions before final structuring
app.post('/api/refine', async (req, res) => {
  const { rawText, model, domain } = req.body || {};
  if (!rawText || !rawText.trim()) {
    return res.status(400).json({
      error: { code: 400, message: 'Raw text is required to refine.' },
    });
  }

  const headerApiKey = req.headers['x-api-key'] as string | undefined;
  const activeKey = headerApiKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    const localResult = refineLocalPromptText({ rawText, domain });
    return res.json({ result: localResult, fallbackUsed: true });
  }

  try {
    const domainHint = domain ? `المجال المستهدف المختار هو: (${domain}).` : '';

    const refineSystemInstruction = `أنت خبير صياغة وهندسة برومبتات ومحرر تقني رفيع المستوى.
مهمتك: إعادة صياغة وضبط النص المدخل من المستخدم لجعله أكثر دقة، وضوحاً، تفصيلاً، واحترافية قبل تحويله إلى الهيكل النهائي.

تعليمات الصياغة الدقيقة:
1. حافظ تماماً على نفس لغة المستخدم الأصلية (إذا كان باللغة العربية أجب بالعربية الفصحى الواضحة، وإذا كان بالإنجليزية أجب بالإنجليزية).
2. ${domainHint}
3. قم بتوضيح المصطلحات العامة، وحدد المعايير، المتطلبات الأساسية، وحالات الاستخدام المتوقعة بدقة تامة وبدون غموض.
4. تخلص من الحشو اللغوي والتكرار أو التردد، واجعل التعبير مباشراً، متماسكاً، وقوياً.
5. أخرج فقط النص المُعاد صياغته والمحسّن مباشرة دون أي مقدمات (مثل: "إليك النص المحسن:" أو "Sure")، ودون علامات اقتباس، ودون أي خاتمة أو عروض مساعدة.
6. لا تقم بتحويله إلى هيكل البرومبت النهائي الآن (لا تستخدم # ROLE أو # CONTEXT حالياً)، بل اجعله نص متطلبات واضح وشامل ليراجعه المستخدم أولاً.`;

    const client = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const { text: refinedText, modelUsed } = await generateWithGeminiCascade(client, model, {
      contents: [{ role: 'user', parts: [{ text: rawText.trim() }] }],
      config: {
        systemInstruction: refineSystemInstruction,
        temperature: 0.35,
      },
    });

    return res.json({ result: refinedText, modelUsed });
  } catch (err: any) {
    console.warn('[Refine Resilience] Gemini unavailable/busy, using smart local refiner fallback:', err?.message || err);
    const fallbackResult = refineLocalPromptText({ rawText, domain });
    return res.json({ result: fallbackResult, fallbackUsed: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
