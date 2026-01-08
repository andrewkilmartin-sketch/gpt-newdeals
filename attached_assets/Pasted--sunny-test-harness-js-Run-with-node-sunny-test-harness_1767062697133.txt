// sunny-test-harness.js
// Run with: node sunny-test-harness.js

const API_URL = 'https://endpoint-weaver--rcxpysgzgc.replit.app/sunny/chat';

// ═══════════════════════════════════════════════════════════════════════════════
// 50 TEST USERS - Different locations, personalities, conversation flows
// ═══════════════════════════════════════════════════════════════════════════════
const testUsers = [
  // ATTRACTIONS - Various locations
  { id: 'sarah-birmingham', location: 'Birmingham', conversations: [
    ['Hi, looking for a day out with the kids this weekend', 'should greet + ask for more info OR search attractions'],
    ['They love animals', 'should search zoo/safari in Birmingham, find Dudley Zoo'],
    ['Any deals on that?', 'should call search_deals, show discount codes']
  ]},
  { id: 'dave-manchester', location: 'Manchester', conversations: [
    ['Theme parks near Manchester', 'should find theme parks, include Kids Pass promo'],
    ['Something for a 5 year old', 'should refine search OR ask clarifying question'],
    ['What about indoor options if it rains?', 'should search soft play/indoor play Manchester']
  ]},
  { id: 'emma-london', location: 'London', conversations: [
    ['Best zoos in London', 'should find London Zoo, ZSL, etc'],
    ['Which is best for toddlers?', 'should remember context, give toddler-specific advice']
  ]},
  { id: 'tom-leeds', location: 'Leeds', conversations: [
    ['Soft play near Leeds', 'should find soft play venues in Leeds/Yorkshire'],
    ['Any cheaper options?', 'should search_deals or filter by price']
  ]},
  { id: 'lisa-bristol', location: 'Bristol', conversations: [
    ['Safari parks near Bristol', 'should find attractions, possibly Longleat'],
    ['How much is it?', 'should have price info from previous search']
  ]},
  { id: 'mike-newcastle', location: 'Newcastle', conversations: [
    ['Things to do with kids Newcastle', 'should search attractions with specific query NOT "attractions"'],
    ['Something educational', 'should search museums/science centres']
  ]},
  { id: 'jenny-liverpool', location: 'Liverpool', conversations: [
    ['Aquariums near Liverpool', 'should find aquariums/sea life'],
    ['Any deals for Kids Pass members?', 'should show Kids Pass promo clearly']
  ]},
  { id: 'chris-sheffield', location: 'Sheffield', conversations: [
    ['Trampoline parks Sheffield', 'should find trampoline/bounce venues'],
    ['Birthday party options?', 'should search party venues or adapt']
  ]},
  { id: 'karen-nottingham', location: 'Nottingham', conversations: [
    ['Museums for kids Nottingham', 'should find museums'],
    ['Free ones?', 'should filter or mention free options']
  ]},
  { id: 'paul-edinburgh', location: 'Edinburgh', conversations: [
    ['Zoos in Edinburgh', 'should find Edinburgh Zoo'],
    ['What else is nearby?', 'should search more attractions Edinburgh']
  ]},
  
  // SHOPPING - Product searches
  { id: 'amy-shopping-1', location: 'London', conversations: [
    ['Marvel pyjamas for my 7 year old son', 'should search_products, find Marvel pyjamas with REAL affiliate links'],
    ['What about Spiderman specifically?', 'should refine search to Spiderman']
  ]},
  { id: 'ben-shopping-2', location: 'Manchester', conversations: [
    ['Dinosaur toys for 4 year old', 'should find dinosaur toys'],
    ['Under £20', 'should filter by price or show cheaper options']
  ]},
  { id: 'carol-shopping-3', location: 'Birmingham', conversations: [
    ['Frozen dress up costume', 'should find Frozen/Elsa costumes'],
    ['Size for 5 year old', 'should show age-appropriate sizes']
  ]},
  { id: 'dan-shopping-4', location: 'Leeds', conversations: [
    ['LEGO sets for 8 year old', 'should find LEGO'],
    ['Star Wars ones', 'should refine to Star Wars LEGO']
  ]},
  { id: 'ella-shopping-5', location: 'Bristol', conversations: [
    ['Kids birthday present ideas', 'should ask for age/interests OR show variety'],
    ['Girl turning 6 who likes unicorns', 'should find unicorn products']
  ]},
  
  // STREAMING - Movie night
  { id: 'frank-streaming-1', location: 'London', conversations: [
    ['Family film for tonight on Netflix', 'should search_streaming with familyFriendly=true, NO adult films'],
    ['Something funny', 'should refine to comedy']
  ]},
  { id: 'grace-streaming-2', location: 'Manchester', conversations: [
    ['Disney plus movie for 5 year old', 'should find age-appropriate Disney films'],
    ['She loves princesses', 'should suggest princess films']
  ]},
  { id: 'harry-streaming-3', location: 'Birmingham', conversations: [
    ['Movie night with the kids', 'should suggest family films + maybe popcorn upsell'],
    ['They are 8 and 10', 'should suggest age-appropriate films']
  ]},
  { id: 'iris-streaming-4', location: 'Leeds', conversations: [
    ['Rainy day, need something to watch', 'should search_streaming NOT attractions'],
    ['Something adventurous', 'should find adventure films']
  ]},
  { id: 'jack-streaming-5', location: 'Bristol', conversations: [
    ['Film recommendations for a 3 year old', 'should find toddler-appropriate films (U rated)'],
    ['On Amazon Prime', 'should filter to Prime']
  ]},
  
  // CINEMA
  { id: 'kate-cinema-1', location: 'London', conversations: [
    ["What's on at the cinema this weekend", 'should search_cinema, show current films'],
    ['Anything good for kids?', 'should filter to family films']
  ]},
  { id: 'liam-cinema-2', location: 'Manchester', conversations: [
    ['Cinema times for family films', 'should search_cinema with family filter'],
    ['Any Kids Pass deals?', 'should show Kids Pass cinema promo']
  ]},
  
  // DEALS - Direct deal queries
  { id: 'mary-deals-1', location: 'Birmingham', conversations: [
    ['Any deals on days out?', 'should search_deals NOT attractions'],
    ['Theme park discounts?', 'should find theme park deals/codes']
  ]},
  { id: 'neil-deals-2', location: 'Leeds', conversations: [
    ["What's on offer for families?", 'should search_deals'],
    ['Toy discounts?', 'should find toy deals']
  ]},
  { id: 'olivia-deals-3', location: 'Bristol', conversations: [
    ['Discount codes for kids stuff', 'should search_deals, return actual codes'],
    ['Anything for M&S?', 'should filter to M&S deals if available']
  ]},
  
  // ACTIVITIES - At home
  { id: 'pete-activities-1', location: 'London', conversations: [
    ['Rainy day activities at home', 'should search_activities NOT attractions'],
    ['For a 4 year old', 'should filter by age']
  ]},
  { id: 'quinn-activities-2', location: 'Manchester', conversations: [
    ['Craft ideas for kids', 'should search_activities'],
    ['Something easy with stuff we have at home', 'should suggest simple crafts']
  ]},
  { id: 'rose-activities-3', location: 'Birmingham', conversations: [
    ['Kids are bored, what can we do?', 'should ask if home or out, or search_activities'],
    ['We are staying in', 'should definitely search_activities']
  ]},
  
  // EDGE CASES - Tricky queries
  { id: 'sam-edge-1', location: 'Glasgow', conversations: [
    ['oi mate', 'should handle casual greeting'],
    ['soft play near me', 'should search soft play Glasgow']
  ]},
  { id: 'tina-edge-2', location: 'Cardiff', conversations: [
    ['hi', 'should greet warmly'],
    ['what can u do', 'should explain capabilities'],
    ['ok show me zoos', 'should ask for location OR search Cardiff']
  ]},
  { id: 'uma-edge-3', location: 'Belfast', conversations: [
    ['I need activity books for my kid', 'should search_products, if none found say so honestly'],
    ['What about colouring books?', 'should search colouring books']
  ]},
  { id: 'vic-edge-4', location: 'Plymouth', conversations: [
    ['Book a table at pizza hut', 'should say cannot book, but offer restaurant search'],
    ['Ok what restaurants are near me', 'should search restaurants Plymouth']
  ]},
  { id: 'will-edge-5', location: 'Norwich', conversations: [
    ['Safari parks', 'should ask for location OR search generally'],
    ['Near Norwich', 'should search safari parks near Norwich/East Anglia']
  ]},
  
  // MULTI-INTENT
  { id: 'xena-multi-1', location: 'Oxford', conversations: [
    ['Planning a birthday party for my 6 year old who loves dinosaurs', 'should offer multiple options - venues, products, etc'],
    ['What venues do you have?', 'should search party venues/attractions Oxford'],
    ['And dinosaur decorations?', 'should search_products dinosaur party supplies']
  ]},
  { id: 'yusuf-multi-2', location: 'Cambridge', conversations: [
    ['Day out then movie night at home', 'should handle both - attractions then streaming'],
    ['Near Cambridge', 'should search attractions Cambridge'],
    ['And film suggestions for later?', 'should search_streaming']
  ]},
  { id: 'zoe-multi-3', location: 'Brighton', conversations: [
    ['Beach stuff and somewhere to visit', 'should search products AND attractions'],
    ['In Brighton', 'should search Brighton attractions'],
    ['What beach toys do you have?', 'should search_products beach toys']
  ]},
  
  // MORE LOCATIONS FOR COVERAGE
  { id: 'user-40', location: 'Southampton', conversations: [['Zoos near Southampton', 'should find zoos']]},
  { id: 'user-41', location: 'Portsmouth', conversations: [['Aquariums Portsmouth', 'should find aquariums']]},
  { id: 'user-42', location: 'Leicester', conversations: [['Theme parks Leicester', 'should find theme parks']]},
  { id: 'user-43', location: 'Coventry', conversations: [['Soft play Coventry', 'should find soft play']]},
  { id: 'user-44', location: 'Hull', conversations: [['Days out Hull', 'should search with specific query NOT "days out"']]},
  { id: 'user-45', location: 'Bradford', conversations: [['Indoor play Bradford', 'should find indoor play']]},
  { id: 'user-46', location: 'Stoke', conversations: [['Museums Stoke', 'should find museums']]},
  { id: 'user-47', location: 'Wolverhampton', conversations: [['Bowling Wolverhampton', 'should find bowling']]},
  { id: 'user-48', location: 'Derby', conversations: [['Farm visits Derby', 'should find farms']]},
  { id: 'user-49', location: 'Swansea', conversations: [['Beaches Swansea', 'should find beaches/attractions']]},
  { id: 'user-50', location: 'Aberdeen', conversations: [['Kids activities Aberdeen', 'should ask home/out or search both']]}
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING CRITERIA
// ═══════════════════════════════════════════════════════════════════════════════
function scoreResponse(response, debug, expected, userMessage) {
  const scores = {
    toolCalled: false,
    rightTool: false,
    gotResults: false,
    noHallucination: true,
    kidsPassPromo: false,
    hasAffiliateLinks: false,
    noBannedQueries: true,
    contextAware: true,
    total: 0,
    issues: []
  };

  const toolsUsed = debug?.toolsUsed || [];
  const responseText = response || '';

  // 1. Did it call a tool?
  scores.toolCalled = toolsUsed.length > 0;
  if (!scores.toolCalled && !userMessage.toLowerCase().match(/^(hi|hello|hey|oi|what can)/)) {
    scores.issues.push('NO_TOOL_CALLED');
  }

  // 2. Right tool for the query?
  const msg = userMessage.toLowerCase();
  const toolNames = toolsUsed.map(t => t.tool);
  
  if (msg.includes('deal') || msg.includes('offer') || msg.includes('discount') || msg.includes('code')) {
    scores.rightTool = toolNames.includes('search_deals');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_DEALS');
  } else if (msg.includes('netflix') || msg.includes('disney') || msg.includes('watch') || (msg.includes('film') && msg.includes('home'))) {
    scores.rightTool = toolNames.includes('search_streaming');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_STREAMING');
  } else if (msg.includes('cinema') || msg.includes('pictures') || msg.includes('showing')) {
    scores.rightTool = toolNames.includes('search_cinema');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_CINEMA');
  } else if (msg.includes('buy') || msg.includes('pyjamas') || msg.includes('toys') || msg.includes('costume') || msg.includes('lego')) {
    scores.rightTool = toolNames.includes('search_products');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_PRODUCTS');
  } else if (msg.includes('bored') || (msg.includes('rainy') && msg.includes('home')) || msg.includes('craft')) {
    scores.rightTool = toolNames.includes('search_activities');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_ACTIVITIES');
  } else if (msg.includes('zoo') || msg.includes('safari') || msg.includes('theme park') || msg.includes('soft play') || msg.includes('aquarium')) {
    scores.rightTool = toolNames.includes('search_attractions');
    if (!scores.rightTool && toolsUsed.length > 0) scores.issues.push('SHOULD_USE_ATTRACTIONS');
  } else {
    scores.rightTool = true; // Can't determine, give benefit of doubt
  }

  // 3. Got results?
  const totalResults = toolsUsed.reduce((sum, t) => sum + (t.resultCount || 0), 0);
  scores.gotResults = totalResults > 0;
  if (!scores.gotResults && toolsUsed.length > 0) {
    scores.issues.push('ZERO_RESULTS');
  }

  // 4. Check for hallucinations (fake URLs)
  if (responseText.includes('example.com') || responseText.includes('placeholder') || 
      responseText.match(/amazon\.co\.uk\/dp\/[A-Z0-9]+/) && !responseText.includes('awin')) {
    scores.noHallucination = false;
    scores.issues.push('HALLUCINATED_LINKS');
  }

  // 5. Kids Pass promo present for attractions?
  if (toolNames.includes('search_attractions') && totalResults > 0) {
    scores.kidsPassPromo = responseText.toLowerCase().includes('kids pass') || responseText.includes('kidspass.co.uk');
    if (!scores.kidsPassPromo) scores.issues.push('MISSING_KIDS_PASS_PROMO');
  } else {
    scores.kidsPassPromo = true; // N/A
  }

  // 6. Real affiliate links for products?
  if (toolNames.includes('search_products') && totalResults > 0) {
    scores.hasAffiliateLinks = responseText.includes('awin1.com') || responseText.includes('awin.com');
    if (!scores.hasAffiliateLinks) scores.issues.push('MISSING_AFFILIATE_LINKS');
  } else {
    scores.hasAffiliateLinks = true; // N/A
  }

  // 7. Banned query terms used?
  for (const t of toolsUsed) {
    const query = (t.args?.query || '').toLowerCase();
    if (['attraction', 'attractions', 'activity', 'activities', 'product', 'products', 'deal', 'deals', 'offer', 'offers'].includes(query)) {
      scores.noBannedQueries = false;
      scores.issues.push(`BANNED_QUERY: "${query}"`);
    }
  }

  // Calculate total (out of 7)
  scores.total = [
    scores.toolCalled || userMessage.toLowerCase().match(/^(hi|hello|hey|oi|what can)/),
    scores.rightTool,
    scores.gotResults || !scores.toolCalled,
    scores.noHallucination,
    scores.kidsPassPromo,
    scores.hasAffiliateLinks,
    scores.noBannedQueries
  ].filter(Boolean).length;

  return scores;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════════════════
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SUNNY V3 COMPREHENSIVE TEST - 50 USERS, MULTI-TURN CONVERSATIONS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const results = {
    totalConversations: 0,
    totalMessages: 0,
    passed: 0,
    failed: 0,
    issues: {},
    userResults: [],
    overallScore: 0
  };

  for (const user of testUsers) {
    const userResult = {
      id: user.id,
      location: user.location,
      turns: [],
      score: 0,
      maxScore: 0
    };

    const sessionId = `test-${user.id}-${Date.now()}`;
    results.totalConversations++;

    console.log(`\n┌─ USER: ${user.id} (${user.location})`);

    for (const [message, expected] of user.conversations) {
      results.totalMessages++;
      
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId })
        });
        const data = await res.json();
        
        const scores = scoreResponse(data.response, data.debug, expected, message);
        userResult.turns.push({ message, scores, response: data.response?.substring(0, 100) });
        userResult.score += scores.total;
        userResult.maxScore += 7;

        if (scores.total >= 6) {
          results.passed++;
          console.log(`│  ✅ "${message.substring(0, 40)}..." (${scores.total}/7)`);
        } else {
          results.failed++;
          console.log(`│  ❌ "${message.substring(0, 40)}..." (${scores.total}/7) - ${scores.issues.join(', ')}`);
        }

        // Track issues
        for (const issue of scores.issues) {
          results.issues[issue] = (results.issues[issue] || 0) + 1;
        }

      } catch (e) {
        results.failed++;
        console.log(`│  ❌ "${message.substring(0, 40)}..." - ERROR: ${e.message}`);
        userResult.turns.push({ message, error: e.message });
        userResult.maxScore += 7;
      }

      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }

    const userPct = Math.round((userResult.score / userResult.maxScore) * 100);
    console.log(`└─ USER SCORE: ${userResult.score}/${userResult.maxScore} (${userPct}%)`);
    results.userResults.push(userResult);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════════
  const totalScore = results.userResults.reduce((sum, u) => sum + u.score, 0);
  const maxScore = results.userResults.reduce((sum, u) => sum + u.maxScore, 0);
  results.overallScore = Math.round((totalScore / maxScore) * 100);

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Total Users:        ${testUsers.length}`);
  console.log(`  Total Messages:     ${results.totalMessages}`);
  console.log(`  Passed (6+/7):      ${results.passed}`);
  console.log(`  Failed (<6/7):      ${results.failed}`);
  console.log(`  Overall Score:      ${totalScore}/${maxScore} (${results.overallScore}%)`);
  console.log('');
  console.log('  TOP ISSUES:');
  const sortedIssues = Object.entries(results.issues).sort((a, b) => b[1] - a[1]);
  for (const [issue, count] of sortedIssues.slice(0, 10)) {
    console.log(`    ${count}x ${issue}`);
  }
  console.log('');
  
  if (results.overallScore >= 95) {
    console.log('  ✅ READY FOR PRODUCTION');
  } else if (results.overallScore >= 80) {
    console.log('  ⚠️  NEEDS FIXES BEFORE PRODUCTION');
  } else {
    console.log('  ❌ NOT READY - MAJOR ISSUES');
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Output JSON for detailed analysis
  console.log('\n--- DETAILED JSON RESULTS ---\n');
  console.log(JSON.stringify({
    summary: {
      users: testUsers.length,
      messages: results.totalMessages,
      passed: results.passed,
      failed: results.failed,
      score: `${results.overallScore}%`
    },
    issues: results.issues,
    failedUsers: results.userResults.filter(u => (u.score / u.maxScore) < 0.85)
  }, null, 2));
}

runTests();
