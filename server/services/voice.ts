import OpenAI from "openai";
import { Readable } from "stream";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const FIRST_GREETINGS = [
  "Hi, I'm Sunny VS01. I'm here to help you search - just tell me exactly what you're looking for, and you can be as specific as you like.",
  "Hello! I'm Sunny, your shopping assistant. Tell me what you need - the more detail the better!",
  "Hey there! I'm Sunny. Looking for something specific? Just tell me - I can search over a million products for you.",
  "Hi! Sunny here. Whether it's shoes for the kids or a gift for grandma, just tell me what you need.",
  "Hello! I'm Sunny VS01. I search across hundreds of retailers to find exactly what you're looking for. What do you need today?",
  "Hi there! I'm Sunny. Tell me what you're shopping for - you can even say things like 'a gift for a 5 year old who loves dinosaurs under twenty pounds'.",
  "Hey! I'm Sunny, and I'm here to make shopping easier. What can I help you find?",
  "Hello! Sunny here. I can search for toys, clothes, shoes, restaurants, cinema - just tell me what you need.",
  "Hi! I'm Sunny VS01. Think of me as your personal shopping helper. What are we looking for today?",
  "Hey there! I'm Sunny. Just describe what you need, and I'll find it for you.",
  "Hello! I'm Sunny. Whether you need school shoes or birthday presents, I've got you covered. What do you need?",
  "Hi! Sunny here. I search across all the major retailers to find you the best options. What are you looking for?",
  "Hey! I'm Sunny VS01. Tell me what you need - I love a challenge!",
  "Hello there! I'm Sunny. From LEGO to Nike trainers, I can find it all. What do you need today?",
  "Hi! I'm Sunny, your family shopping assistant. What can I help you find?",
  "Hey! Sunny here. Just tell me what you're after - be as specific as you like.",
  "Hello! I'm Sunny VS01. Ready to help you find exactly what you need. What's on your list?",
  "Hi there! I'm Sunny. Shopping made simple - just tell me what you want.",
  "Hey! I'm Sunny. Looking for something? I search over a million products in seconds.",
  "Hello! Sunny here. Let's find what you're looking for. What do you need?"
];

export const FOLLOWUP_GREETINGS = [
  "What else can I help you with?",
  "Looking for something else?",
  "What else do you need?",
  "Anything else I can find for you?",
  "What's next on your list?",
  "Need help finding something else?",
  "What else can I search for?",
  "Ready when you are - what else do you need?",
  "I'm here - what else are you looking for?",
  "What other products can I find for you?",
  "Still here! What else do you need?",
  "Let me know what else you're after.",
  "Happy to help - what else?",
  "What's the next thing on your list?",
  "I can keep searching - what else do you need?",
  "Found those okay? What else can I get you?",
  "What else shall we look for?",
  "Ready for your next search - go ahead!",
  "What else would you like to find?",
  "I'm listening - what else do you need?"
];

export const CLARIFICATIONS = {
  size: [
    "No problem! What size were you looking for?",
    "Sure thing - what size do you need?",
    "Got it! And what size?",
    "Lovely - what size did you need?"
  ],
  age: [
    "Great choice! What age is it for?",
    "Sure - what age are we looking at?",
    "No problem! How old is the little one?"
  ],
  budget: [
    "Did you have a budget in mind?",
    "Any price range you're thinking of?",
    "How much were you looking to spend?"
  ],
  gender: [
    "Is that for a boy or a girl?",
    "For a boy or girl?"
  ]
};

export const SEARCH_TRANSITIONS = [
  "Perfect, let me find those for you.",
  "On it! Here's what I found.",
  "Great, searching now.",
  "Let me see what we've got.",
  "Got it - one moment.",
  "Sure thing, here we go.",
  "Searching for you now.",
  "Let's see what's available."
];

export const ERROR_RESPONSES = {
  inappropriate: [
    "I don't think we stock those! Anything else I can help with?",
    "Ha! That's not quite my area. What else do you need?",
    "We don't have those in the catalogue! What else can I find?"
  ],
  not_understood: [
    "Sorry, I didn't quite catch that. Could you try again?",
    "I missed that - could you say it once more?",
    "One more time? I want to make sure I get it right."
  ],
  off_topic: [
    "I'm just here to help you find products! What are you shopping for?",
    "I'm best at finding things to buy - what do you need?",
    "Let's stick to shopping - what can I find for you?"
  ],
  no_results: [
    "I couldn't find exactly that, but here are some similar options.",
    "Nothing exact, but these might work for you.",
    "Let me show you what's close to that."
  ]
};

export function getRandomGreeting(isFirstInteraction: boolean): string {
  const greetings = isFirstInteraction ? FIRST_GREETINGS : FOLLOWUP_GREETINGS;
  return greetings[Math.floor(Math.random() * greetings.length)];
}

export function getRandomTransition(): string {
  return SEARCH_TRANSITIONS[Math.floor(Math.random() * SEARCH_TRANSITIONS.length)];
}

export function getRandomClarification(field: keyof typeof CLARIFICATIONS): string {
  const options = CLARIFICATIONS[field];
  return options[Math.floor(Math.random() * options.length)];
}

export function getRandomError(type: keyof typeof ERROR_RESPONSES): string {
  const options = ERROR_RESPONSES[type];
  return options[Math.floor(Math.random() * options.length)];
}

export async function textToSpeech(text: string, voice: string = 'shimmer'): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice as 'shimmer' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova',
    input: text,
    response_format: 'mp3'
  });
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function speechToText(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  const file = new File([audioBuffer], 'audio.webm', { type: mimeType });
  
  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'en'
  });
  
  return transcription.text;
}

const INTENT_PARSER_PROMPT = `You are Sunny's intent parser. Extract shopping intent from natural speech.

RULES:
1. Extract ONE or MORE searches from the input
2. Identify if clarification is needed (size, age, budget, gender)
3. Normalise UK English (mum, colour, trainers, etc.)
4. Handle multi-intent: "shoes and pizza" = 2 searches
5. Flag inappropriate requests
6. Search types: "product" for shopping, "restaurant" for food/dining, "cinema" for movies, "attraction" for places to visit

INPUT: User's spoken words
OUTPUT: JSON only

EXAMPLES:

Input: "school shoes for a little girl"
Output: {
  "searches": [{"query": "school shoes girls", "type": "product"}],
  "needsClarification": true,
  "clarifyField": "size",
  "clarifyingQuestion": "What size were you looking for?"
}

Input: "size 8"
Context: Previous was "school shoes girls"
Output: {
  "searches": [{"query": "school shoes girls size 8", "type": "product"}],
  "needsClarification": false
}

Input: "Nike trainers for my son he's 7 and some pizza places near me"
Output: {
  "searches": [
    {"query": "Nike trainers boys age 7", "type": "product"},
    {"query": "pizza restaurants", "type": "restaurant"}
  ],
  "needsClarification": false
}

Input: "something rude or inappropriate"
Output: {
  "searches": [],
  "isInappropriate": true,
  "needsClarification": false
}

Input: "what's the weather"
Output: {
  "searches": [],
  "isOffTopic": true,
  "needsClarification": false
}

Now parse this input:`;

export interface ParsedIntent {
  searches: Array<{ query: string; type: 'product' | 'restaurant' | 'cinema' | 'attraction' }>;
  needsClarification: boolean;
  clarifyField?: 'size' | 'age' | 'budget' | 'gender';
  clarifyingQuestion?: string;
  isInappropriate?: boolean;
  isOffTopic?: boolean;
}

export async function parseIntent(
  text: string, 
  context: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ParsedIntent> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: INTENT_PARSER_PROMPT }
  ];
  
  for (const msg of context) {
    messages.push({ role: msg.role, content: msg.content });
  }
  
  messages.push({ role: 'user', content: text });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: 500
  });
  
  const content = response.choices[0]?.message?.content || '{}';
  
  try {
    return JSON.parse(content) as ParsedIntent;
  } catch {
    return {
      searches: [],
      needsClarification: false,
      isOffTopic: true
    };
  }
}
