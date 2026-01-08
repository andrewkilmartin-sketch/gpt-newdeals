/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SUNNY PRODUCTION TEST SUITE - REALISTIC MULTI-USER CONVERSATIONS
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * This simulates REAL parents having REAL conversations with Sunny.
 * Tests natural conversation, shopping, nights in, attractions, and affiliates.
 * 
 * RUN: node sunny-production-test.js
 * 
 * OR with custom URL:
 * BASE_URL=https://your-replit-url.dev node sunny-production-test.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATED USERS - Real parents with real needs
// ═══════════════════════════════════════════════════════════════════════════════

const SIMULATED_USERS = [
  {
    name: "Sarah (Tired Mum, Birmingham)",
    scenario: "Rainy weekend, needs to entertain kids",
    conversation: [
      "Hi!",
      "It's raining and the kids are driving me mad. Any ideas?",
      "What about soft play places near Birmingham?",
      "Actually we might just stay in. What's good on Netflix for a 5 year old?",
      "Perfect! Can you recommend something to keep them busy while I order pizza?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'soft play', 'Netflix'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "Dave (Weekend Dad, London)",
    scenario: "Has the kids this weekend, wants a special day out",
    conversation: [
      "Hey Sunny",
      "I've got my two kids this weekend, 7 and 9 years old. Want to do something special.",
      "What theme parks are near London?",
      "Are there any deals on?",
      "What about somewhere with animals instead?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'theme park', 'zoo', 'save'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "Emma (Birthday Party Mum, Manchester)",
    scenario: "Planning daughter's 6th birthday",
    conversation: [
      "Hi, I need help planning my daughter's birthday party",
      "She's turning 6 and loves dinosaurs",
      "Can you find party venues near Manchester?",
      "What about dinosaur party supplies I could buy?",
      "And maybe a dinosaur themed cake?"
    ],
    expectations: {
      shouldMention: ['party', 'dinosaur'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "Tom (Movie Night Dad, Bristol)",
    scenario: "Planning a cosy family movie night",
    conversation: [
      "We're having a movie night tonight",
      "What's a good family film on Disney Plus?",
      "The kids are 4 and 8 so needs to suit both",
      "What snacks should we get?",
      "Can we get pizza delivered with any deals?"
    ],
    expectations: {
      shouldMention: ['Disney', 'movie', 'film'],
      shouldNotMention: ['cinema', 'Kids Pass cinema'],
      shouldHaveAffiliates: true,
      shouldHaveFoodDeals: true
    }
  },
  {
    name: "Lisa (Budget Mum, Leeds)",
    scenario: "Looking for cheap days out",
    conversation: [
      "Hiya",
      "Need some cheap days out ideas for the summer holidays",
      "Got 3 kids, ages 3, 6 and 10",
      "What's the best value with Kids Pass?",
      "Any free activities we could do at home on rainy days?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'save', 'free'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "James (New Dad, Edinburgh)",
    scenario: "First time looking for toddler activities",
    conversation: [
      "Hello!",
      "Just found out about Kids Pass. What can I use it for?",
      "I've got an 18 month old - what's suitable for toddlers?",
      "Soft play near Edinburgh?",
      "What toys would you recommend for that age?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'toddler', 'soft play'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "Rachel (Safari Fan, Midlands)",
    scenario: "Specifically wants safari parks",
    conversation: [
      "Safari parks!",
      "What safari parks are near the Midlands?",
      "Do you have discount codes for any of them?",
      "What should we take for a day at the safari?",
      "Binoculars for the kids maybe?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'safari'],
      shouldNotMention: ['Longleat'],
      shouldHaveAffiliates: true,
      shouldNotHallucinate: true
    }
  },
  {
    name: "Chris (Cinema Dad, Newcastle)",
    scenario: "Wants to take kids to the cinema",
    conversation: [
      "What's on at the cinema this weekend?",
      "Anything good for a 7 year old?",
      "How much can I save with Kids Pass?",
      "Is Odeon or Vue better value?"
    ],
    expectations: {
      shouldMention: ['Kids Pass', 'cinema', 'save'],
      shouldHaveAffiliates: false,
      shouldNotHallucinate: true
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function log(color, ...args) {
  console.log(color, ...args, COLORS.reset);
}

async function chat(message) {
  try {
    const response = await fetch(`${BASE_URL}/sunny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return await response.json();
  } catch (error) {
    return { error: error.message, success: false };
  }
}

async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/sunny/health`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeResponse(response, expectations, apiResults) {
  const issues = [];
  const passes = [];
  const responseText = response.toLowerCase();

  // Check for expected mentions
  if (expectations.shouldMention) {
    for (const term of expectations.shouldMention) {
      if (responseText.includes(term.toLowerCase())) {
        passes.push(`✓ Mentioned "${term}"`);
      } else {
        issues.push(`✗ Should mention "${term}" but didn't`);
      }
    }
  }

  // Check for things that should NOT be mentioned
  if (expectations.shouldNotMention) {
    for (const term of expectations.shouldNotMention) {
      if (responseText.includes(term.toLowerCase())) {
        issues.push(`✗ Should NOT mention "${term}" but did`);
      } else {
        passes.push(`✓ Correctly avoided "${term}"`);
      }
    }
  }

  // Check for hallucinations
  if (expectations.shouldNotHallucinate && apiResults) {
    const apiNames = [];
    if (apiResults.apiResults) {
      apiResults.apiResults.forEach(r => {
        if (r.names) apiNames.push(...r.names.map(n => n.toLowerCase()));
      });
    }

    // Common attractions that get hallucinated
    const commonHallucinations = [
      'longleat', 'alton towers', 'thorpe park', 'chessington', 
      'legoland', 'drayton manor', 'blackpool pleasure beach'
    ];

    for (const name of commonHallucinations) {
      if (responseText.includes(name) && apiNames.length > 0) {
        const isInApi = apiNames.some(api => api.includes(name));
        if (!isInApi) {
          issues.push(`✗ HALLUCINATION: Mentioned "${name}" but not in API results`);
        }
      }
    }

    if (issues.filter(i => i.includes('HALLUCINATION')).length === 0) {
      passes.push(`✓ No hallucinations detected`);
    }
  }

  // Check for affiliate links
  if (expectations.shouldHaveAffiliates) {
    if (responseText.includes('amazon') || responseText.includes('awin') ||
        responseText.includes('http') || responseText.includes('shop')) {
      passes.push(`✓ Contains shopping/affiliate references`);
    }
  }

  // Check for food deals (for movie night scenarios)
  if (expectations.shouldHaveFoodDeals) {
    if (responseText.includes('uber') || responseText.includes('deliveroo') ||
        responseText.includes('pizza') || responseText.includes('order')) {
      passes.push(`✓ Contains food delivery mention`);
    } else {
      issues.push(`✗ Should mention food delivery for movie night`);
    }
  }

  // Check conversational quality
  if (response.length < 50) {
    issues.push(`✗ Response too short (${response.length} chars) - not conversational`);
  } else if (response.length > 100) {
    passes.push(`✓ Good response length (${response.length} chars)`);
  }

  // Check for questions (engagement)
  if (response.includes('?')) {
    passes.push(`✓ Asks follow-up question (engaging)`);
  }

  return { issues, passes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runFullTest() {
  console.log(`
${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ${COLORS.bright}SUNNY PRODUCTION TEST SUITE${COLORS.cyan}                                            ║
║   ${COLORS.white}Simulating real parent conversations${COLORS.cyan}                                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  // Health check first
  log(COLORS.yellow, '\n🏥 Checking Sunny health...');
  const health = await checkHealth();
  if (health.error) {
    log(COLORS.red, `\n❌ FAILED: Cannot connect to Sunny at ${BASE_URL}`);
    log(COLORS.red, `   Error: ${health.error}`);
    log(COLORS.yellow, '\n   Make sure your server is running!');
    process.exit(1);
  }
  log(COLORS.green, `✓ Sunny is online: ${health.status || health.version || 'OK'}`);

  // Results tracking
  const results = {
    totalConversations: 0,
    totalMessages: 0,
    totalPasses: 0,
    totalIssues: 0,
    hallucinations: 0,
    users: []
  };

  // Run each user's conversation
  for (const user of SIMULATED_USERS) {
    console.log(`
${COLORS.magenta}══════════════════════════════════════════════════════════════════════════════
${COLORS.bright}👤 ${user.name}${COLORS.reset}
${COLORS.gray}📝 Scenario: ${user.scenario}
${COLORS.magenta}══════════════════════════════════════════════════════════════════════════════${COLORS.reset}`);

    const userResult = {
      name: user.name,
      messages: [],
      passes: 0,
      issues: 0
    };

    for (let i = 0; i < user.conversation.length; i++) {
      const message = user.conversation[i];
      
      log(COLORS.blue, `\n💬 User: "${message}"`);
      
      const startTime = Date.now();
      const response = await chat(message);
      const elapsed = Date.now() - startTime;
      
      results.totalMessages++;

      if (response.error || !response.success) {
        log(COLORS.red, `❌ ERROR: ${response.error || 'Unknown error'}`);
        userResult.issues++;
        continue;
      }

      // Show response
      const respText = response.response || '';
      const preview = respText.length > 200 ? respText.substring(0, 200) + '...' : respText;
      log(COLORS.green, `🌞 Sunny (${elapsed}ms):`);
      log(COLORS.white, `   ${preview}`);

      // Show debug info if available
      if (response.debug) {
        const d = response.debug;
        if (d.intents && d.intents.length > 0) {
          log(COLORS.gray, `   📊 Intents: ${d.intents.map(i => i.type).join(', ')}`);
        }
        if (d.apiResults && d.apiResults.length > 0) {
          const counts = d.apiResults.map(r => `${r.type}:${r.count}`).join(', ');
          log(COLORS.gray, `   📦 API Results: ${counts}`);
        }
        if (d.kidsPassPromo) {
          log(COLORS.cyan, `   🎫 Kids Pass Promo: ${d.kidsPassPromo}`);
        }
        if (d.upsellCount > 0) {
          log(COLORS.yellow, `   🛒 Upsells: ${d.upsellCount}`);
        }
      }

      // Analyze final message in conversation
      if (i === user.conversation.length - 1) {
        const analysis = analyzeResponse(respText, user.expectations, response.debug);
        
        if (analysis.passes.length > 0) {
          log(COLORS.green, '\n   Analysis:');
          analysis.passes.forEach(p => log(COLORS.green, `   ${p}`));
          userResult.passes += analysis.passes.length;
        }
        
        if (analysis.issues.length > 0) {
          log(COLORS.red, '\n   Issues:');
          analysis.issues.forEach(i => log(COLORS.red, `   ${i}`));
          userResult.issues += analysis.issues.length;
          
          // Count hallucinations
          const hallCount = analysis.issues.filter(i => i.includes('HALLUCINATION')).length;
          results.hallucinations += hallCount;
        }
      }

      userResult.messages.push({
        user: message,
        sunny: respText,
        elapsed
      });
    }

    results.totalConversations++;
    results.totalPasses += userResult.passes;
    results.totalIssues += userResult.issues;
    results.users.push(userResult);
  }

  // Final summary
  console.log(`
${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════════════╗
║                           ${COLORS.bright}TEST SUMMARY${COLORS.cyan}                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝${COLORS.reset}

${COLORS.white}📊 Overall Results:${COLORS.reset}
   • Conversations: ${results.totalConversations}
   • Total Messages: ${results.totalMessages}
   • Passes: ${COLORS.green}${results.totalPasses}${COLORS.reset}
   • Issues: ${results.totalIssues > 0 ? COLORS.red : COLORS.green}${results.totalIssues}${COLORS.reset}
   • Hallucinations: ${results.hallucinations > 0 ? COLORS.red : COLORS.green}${results.hallucinations}${COLORS.reset}

${COLORS.white}👥 Per-User Results:${COLORS.reset}`);

  for (const user of results.users) {
    const status = user.issues === 0 ? `${COLORS.green}✓ PASS${COLORS.reset}` : `${COLORS.red}✗ ${user.issues} ISSUES${COLORS.reset}`;
    console.log(`   • ${user.name}: ${status}`);
  }

  // Final verdict
  if (results.totalIssues === 0 && results.hallucinations === 0) {
    console.log(`
${COLORS.green}╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ✓ ALL TESTS PASSED - Sunny is production ready!                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝${COLORS.reset}
`);
  } else {
    console.log(`
${COLORS.yellow}╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ⚠ SOME TESTS NEED ATTENTION                                               ║
║   Issues: ${results.totalIssues}, Hallucinations: ${results.hallucinations}                                            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝${COLORS.reset}
`);
  }
}

// Run tests
runFullTest().catch(console.error);
