import OpenAI from 'openai';
import { config } from '../utils/config.js';
import { createChildLogger } from '../utils/logger.js';
import { AIServiceError } from '../types/index.js';
import type { SeedData, GeneratedAngle, Locale, Platform, LocalizedContentData } from '../types/index.js';

const logger = createChildLogger('ai-service');

// Mock data for development without API key
const MOCK_ANGLES: GeneratedAngle[] = [
  {
    hook: "Stop wasting money on solutions that don't work",
    problemAgitation:
      "Every day, you're losing time and money trying to fix problems that keep coming back. The frustration builds as you watch competitors pull ahead while you're stuck in the same cycle.",
    solution:
      "Our product cuts through the noise and delivers real results. Built by experts who understand your pain points, it transforms your workflow in days, not months.",
    cta: "Start your free trial today and see the difference",
    visualDirection:
      "Open with frustrated person at desk, transition to confident user with product, end with success metrics",
    audioNotes: "Start with tense background music, shift to uplifting tone at solution reveal",
    estimatedDuration: 30,
    generationNotes: "Focus on pain-solution narrative with strong emotional appeal",
  },
  {
    hook: "What if you could 10x your productivity overnight?",
    problemAgitation:
      "You're working harder than ever, but the results aren't matching your effort. Tasks pile up, deadlines loom, and there's never enough time.",
    solution:
      "Introducing a smarter way to work. Our AI-powered solution handles the heavy lifting so you can focus on what matters most.",
    cta: "Join thousands who've already transformed their workflow",
    visualDirection:
      "Split screen: chaos vs calm. Show before/after transformation with real user testimonials",
    audioNotes: "Energetic opening, testimonial background music, triumphant closing",
    estimatedDuration: 45,
    generationNotes: "Productivity angle with social proof emphasis",
  },
  {
    hook: "The secret top performers don't want you to know",
    problemAgitation:
      "While you're grinding through the same old methods, industry leaders are using tools that give them an unfair advantage. The gap grows wider every day.",
    solution:
      "Now you can access the same technology that's driving success for the top 1%. No complex setup, no steep learning curve - just results.",
    cta: "Level up your game - get started free",
    visualDirection:
      "Mysterious opening, reveal of 'insider' knowledge, empowerment montage",
    audioNotes: "Intrigue-building intro, confident reveal, motivational close",
    estimatedDuration: 35,
    generationNotes: "Exclusivity and FOMO angle targeting ambitious professionals",
  },
];

const LOCALE_NAMES: Record<Locale, string> = {
  'en-US': 'English (US)',
  'es-ES': 'Spanish (Spain)',
  'fr-FR': 'French (France)',
  'de-DE': 'German (Germany)',
  'pt-BR': 'Portuguese (Brazil)',
};

const PLATFORM_STYLES: Record<Platform, string> = {
  tiktok: 'casual, trendy, use hooks and quick cuts',
  instagram: 'polished, aspirational, story-driven',
  youtube: 'informative, thorough, value-packed',
};

class AIService {
  private openai: OpenAI | null = null;
  private mockMode: boolean;

  constructor() {
    // Production guard: Never allow mock mode in production
    if (config.NODE_ENV === 'production' && config.AI_MOCK_MODE) {
      logger.warn(
        'AI_MOCK_MODE was set in production environment but has been disabled for security. ' +
        'Mock mode is only allowed in development and test environments.'
      );
    }

    // Force mock mode OFF in production regardless of env vars
    const isProduction = config.NODE_ENV === 'production';
    this.mockMode = isProduction ? false : (config.AI_MOCK_MODE || !config.OPENAI_API_KEY);

    if (!this.mockMode && config.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    } else if (isProduction && !config.OPENAI_API_KEY) {
      // In production, we must have a real API key
      throw new Error('OPENAI_API_KEY is required in production environment');
    }

    logger.info({
      mockMode: this.mockMode,
      environment: config.NODE_ENV,
      hasApiKey: !!config.OPENAI_API_KEY
    }, 'AI Service initialized');
  }

  async generateAngles(seedData: SeedData, count: number): Promise<GeneratedAngle[]> {
    if (this.mockMode) {
      logger.info({ count }, 'Generating mock angles');
      return this.generateMockAngles(seedData, count);
    }

    return this.generateRealAngles(seedData, count);
  }

  private generateMockAngles(seedData: SeedData, count: number): GeneratedAngle[] {
    // Create variations based on seed data
    return MOCK_ANGLES.slice(0, count).map((angle, index) => ({
      ...angle,
      hook: `${angle.hook} - ${seedData.product_name}`,
      solution: angle.solution.replace('Our product', seedData.product_name),
      generationNotes: `Mock generation #${index + 1} for ${seedData.product_name}. Tone: ${seedData.tone}`,
    }));
  }

  private async generateRealAngles(seedData: SeedData, count: number): Promise<GeneratedAngle[]> {
    if (!this.openai) {
      throw new AIServiceError('OpenAI client not initialized');
    }

    const prompt = this.buildAngleGenerationPrompt(seedData, count);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert UGC (User Generated Content) creative director specializing in short-form video ads.
            You create compelling angle cards that convert viewers into customers.
            Always respond with valid JSON arrays.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content) as { angles: GeneratedAngle[] };
      return parsed.angles;
    } catch (error) {
      logger.error({ error }, 'Failed to generate angles');
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('Failed to generate angles', { originalError: String(error) });
    }
  }

  private buildAngleGenerationPrompt(seedData: SeedData, count: number): string {
    return `Generate ${count} unique UGC ad angle cards for the following product:

Product: ${seedData.product_name}
Description: ${seedData.product_description}
Target Audience: ${seedData.target_audience}
Key Benefits: ${seedData.key_benefits.join(', ')}
Pain Points: ${seedData.pain_points.join(', ')}
Tone: ${seedData.tone}
Platforms: ${seedData.platforms.join(', ')}
${seedData.brand_guidelines ? `Brand Guidelines: ${seedData.brand_guidelines}` : ''}
${seedData.unique_selling_points?.length ? `USPs: ${seedData.unique_selling_points.join(', ')}` : ''}

For each angle, provide:
1. hook: A compelling opening line (5-15 words) that stops the scroll
2. problemAgitation: Describe the pain point vividly (2-3 sentences)
3. solution: Present the product as the solution (2-3 sentences)
4. cta: A clear call to action (1 sentence)
5. visualDirection: Brief notes for video visuals
6. audioNotes: Suggestions for music/voiceover tone
7. estimatedDuration: Recommended video length in seconds (15-60)
8. generationNotes: Your reasoning for this angle

Each angle should take a different approach - vary the emotional hooks, pain points emphasized, and creative direction.

Respond with JSON in this exact format:
{
  "angles": [
    {
      "hook": "...",
      "problemAgitation": "...",
      "solution": "...",
      "cta": "...",
      "visualDirection": "...",
      "audioNotes": "...",
      "estimatedDuration": 30,
      "generationNotes": "..."
    }
  ]
}`;
  }

  async localizeContent(
    angle: GeneratedAngle,
    targetLocale: Locale,
    targetPlatform: Platform,
    seedData: SeedData
  ): Promise<LocalizedContentData> {
    if (this.mockMode) {
      return this.generateMockLocalization(angle, targetLocale, targetPlatform);
    }

    return this.generateRealLocalization(angle, targetLocale, targetPlatform, seedData);
  }

  private generateMockLocalization(
    angle: GeneratedAngle,
    targetLocale: Locale,
    targetPlatform: Platform
  ): LocalizedContentData {
    const localeName = LOCALE_NAMES[targetLocale];
    const platformStyle = PLATFORM_STYLES[targetPlatform];

    // Create mock localized content
    const script = `[${localeName} - ${targetPlatform}]\n\n${angle.hook}\n\n${angle.problemAgitation}\n\n${angle.solution}\n\n${angle.cta}`;

    return {
      script,
      captions: [
        { timestamp_start: 0, timestamp_end: 3, text: angle.hook, style: 'emphasis' },
        { timestamp_start: 3, timestamp_end: 12, text: angle.problemAgitation, style: 'normal' },
        { timestamp_start: 12, timestamp_end: 22, text: angle.solution, style: 'normal' },
        { timestamp_start: 22, timestamp_end: 30, text: angle.cta, style: 'emphasis' },
      ],
      onScreenText: [
        { timestamp: 0, duration: 3, text: angle.hook.substring(0, 50), position: 'center', animation: 'pop' },
        { timestamp: 22, duration: 5, text: 'Link in bio!', position: 'bottom', animation: 'fade' },
      ],
      culturalNotes: `Adapted for ${localeName} market. Style adjusted for ${platformStyle}.`,
      platformAdjustments: `Optimized for ${targetPlatform}: ${platformStyle}`,
    };
  }

  private async generateRealLocalization(
    angle: GeneratedAngle,
    targetLocale: Locale,
    targetPlatform: Platform,
    seedData: SeedData
  ): Promise<LocalizedContentData> {
    if (!this.openai) {
      throw new AIServiceError('OpenAI client not initialized');
    }

    const prompt = `Localize this UGC ad script for ${LOCALE_NAMES[targetLocale]} audience on ${targetPlatform}.

Original Script:
Hook: ${angle.hook}
Problem: ${angle.problemAgitation}
Solution: ${angle.solution}
CTA: ${angle.cta}

Product: ${seedData.product_name}
Platform Style: ${PLATFORM_STYLES[targetPlatform]}

Requirements:
1. Translate and culturally adapt the content
2. Maintain the emotional impact and persuasive elements
3. Adjust for platform-specific norms (${targetPlatform})
4. Add appropriate captions with timestamps
5. Suggest on-screen text placements
6. Note any cultural considerations

Respond with JSON:
{
  "script": "Full adapted script",
  "captions": [{"timestamp_start": 0, "timestamp_end": 3, "text": "...", "style": "normal|emphasis|whisper"}],
  "onScreenText": [{"timestamp": 0, "duration": 3, "text": "...", "position": "top|center|bottom", "animation": "fade|slide|pop"}],
  "culturalNotes": "Notes on cultural adaptations made",
  "platformAdjustments": "Platform-specific changes"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert localization specialist for social media advertising.
            You understand cultural nuances and platform-specific requirements.
            Always respond with valid JSON.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError('Empty response from OpenAI');
      }

      return JSON.parse(content) as LocalizedContentData;
    } catch (error) {
      logger.error({ error, targetLocale, targetPlatform }, 'Failed to localize content');
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('Failed to localize content', { originalError: String(error) });
    }
  }

  async analyzeWinnerPatterns(
    winners: Array<{
      angle: GeneratedAngle;
      metrics: { ctr: number; roas: number | null; conversions: number };
    }>
  ): Promise<{ patterns: string[]; recommendations: string[] }> {
    if (this.mockMode) {
      return {
        patterns: [
          'Strong emotional hooks perform 40% better',
          'Questions in hooks increase CTR by 25%',
          'Shorter problem statements (< 50 words) convert better',
          'Clear, single CTAs outperform multiple CTAs',
        ],
        recommendations: [
          'Focus on curiosity-gap hooks',
          'Keep problem agitation concise but impactful',
          'Use social proof in solution sections',
          'Test urgency-based CTAs',
        ],
      };
    }

    if (!this.openai) {
      throw new AIServiceError('OpenAI client not initialized');
    }

    const prompt = `Analyze these top-performing UGC ad angles and identify patterns:

${winners
  .map(
    (w, i) => `
Angle ${i + 1} (CTR: ${w.metrics.ctr.toFixed(2)}%, ROAS: ${w.metrics.roas?.toFixed(2) ?? 'N/A'}):
Hook: ${w.angle.hook}
Problem: ${w.angle.problemAgitation}
Solution: ${w.angle.solution}
CTA: ${w.angle.cta}
`
  )
  .join('\n')}

Identify:
1. Common patterns in successful hooks
2. Structural similarities in messaging
3. Tone and language patterns
4. Recommendations for next iteration

Respond with JSON:
{
  "patterns": ["pattern 1", "pattern 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert performance marketing analyst.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError('Empty response from OpenAI');
      }

      return JSON.parse(content) as { patterns: string[]; recommendations: string[] };
    } catch (error) {
      logger.error({ error }, 'Failed to analyze patterns');
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('Failed to analyze patterns', { originalError: String(error) });
    }
  }

  async generateIterations(
    winnerAngles: GeneratedAngle[],
    patterns: string[],
    seedData: SeedData,
    count: number
  ): Promise<GeneratedAngle[]> {
    if (this.mockMode) {
      return winnerAngles.slice(0, count).map((angle, i) => ({
        ...angle,
        hook: `[ITERATION] ${angle.hook}`,
        generationNotes: `Iteration based on winner #${i + 1}. Applied patterns: ${patterns.slice(0, 2).join(', ')}`,
      }));
    }

    if (!this.openai) {
      throw new AIServiceError('OpenAI client not initialized');
    }

    const prompt = `Generate ${count} new UGC ad angles based on these winning patterns:

Winning Patterns:
${patterns.map((p) => `- ${p}`).join('\n')}

Top Performing Angles for Reference:
${winnerAngles
  .map(
    (a, i) => `
Winner ${i + 1}:
Hook: ${a.hook}
Problem: ${a.problemAgitation}
Solution: ${a.solution}
CTA: ${a.cta}
`
  )
  .join('\n')}

Product: ${seedData.product_name}
Description: ${seedData.product_description}
Target Audience: ${seedData.target_audience}

Create new angles that:
1. Apply the winning patterns identified
2. Maintain what worked but test new variations
3. Push creative boundaries while staying on-brand

Respond with JSON:
{
  "angles": [
    {
      "hook": "...",
      "problemAgitation": "...",
      "solution": "...",
      "cta": "...",
      "visualDirection": "...",
      "audioNotes": "...",
      "estimatedDuration": 30,
      "generationNotes": "Explain how this applies winning patterns"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert UGC creative director focused on iterative optimization.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIServiceError('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content) as { angles: GeneratedAngle[] };
      return parsed.angles;
    } catch (error) {
      logger.error({ error }, 'Failed to generate iterations');
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('Failed to generate iterations', { originalError: String(error) });
    }
  }
}

export const aiService = new AIService();
