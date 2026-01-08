// Full Sunny Family Help Playbook - structured knowledge base
// Preserves all metadata for rich filtering and GPT retrieval
// EXPANDED VERSION: 160+ activities

export interface PlaybookActivity {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  age_bands: string[];
  constraints: {
    supervision: string;
    noise: string;
  };
  steps: string[];
  variations: string[];
}

export interface PlaybookData {
  kb_name: string;
  version: string;
  last_updated: string;
  language: string;
  purpose: string;
  tag_legend: {
    time: string[];
    energy: string[];
    setting: string[];
    screen: string[];
    mess: string[];
    prep: string[];
    age_bands: string[];
    topics: string[];
  };
  chunks: PlaybookActivity[];
}

// Full playbook data with all metadata preserved
export const familyPlaybook: PlaybookData = {
  kb_name: "SUNNY_FAMILY_HELP_PLAYBOOK",
  version: "2.0.0",
  last_updated: "2025-12-18",
  language: "en-GB",
  purpose: "Offline knowledge base for Sunny: activities, routines, chores, calm-down tools, travel/car boredom busters, rainy-day plans, crafts, games, homework support, bedtime/morning systems.",
  tag_legend: {
    time: ["T5", "T10", "T20", "T45", "T90"],
    energy: ["ELOW", "EMED", "EHIGH"],
    setting: ["SINDOOR", "SOUTDOOR", "SCAR", "STRAVEL", "SSMALL_SPACE", "SRAINY", "SQUIET_ONLY", "SNOISE_OK"],
    screen: ["NS", "SL", "SY"],
    mess: ["M0", "M1", "M2"],
    prep: ["P0", "P1", "P2"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12", "A13_16"],
    topics: ["KEEP_BUSY", "RAINY_DAY", "OUTDOOR", "INDOOR", "CAR", "QUIET_TIME", "SIBLINGS", "CHORES", "ROUTINES", "BEDTIME", "MORNING", "HOMEWORK", "BIG_FEELINGS", "CRAFT", "SCIENCE", "BUILDING", "LEGO", "MEALS_SIMPLE", "PLAYDATE", "SLEEP_OVER", "BIRTHDAY", "SICK_DAY_LIGHT"]
  },
  chunks: [
    // ============ KEEP BUSY / INDOOR ACTIVITIES ============
    {
      id: "ACT_0001",
      title: "3-Item Challenge",
      summary: "Instant boredom-buster: find 3 items matching prompts.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T5", "EMED", "SSMALL_SPACE"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Say: 'Find 3 things that are soft / blue / make noise.'", "Time it (60–120 seconds).", "Swap roles: kid chooses prompts."],
      variations: ["Texture hunt (rough/smooth)", "Shape hunt (circle/triangle)", "Emotion hunt (something that makes you happy)"]
    },
    {
      id: "ACT_0002",
      title: "Statue DJ (Freeze Dance)",
      summary: "Music on/off freeze game.",
      tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T5", "EHIGH", "SNOISE_OK"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Play music for 20–40 seconds.", "Pause: everyone freezes.", "Add silly rules (one foot, superhero pose)."],
      variations: ["Quiet version: slow-motion only", "Balance challenge: freeze on one leg (older kids)"]
    },
    {
      id: "ACT_0003",
      title: "One-Minute Draw",
      summary: "Draw fast with a constraint (only circles, only triangles, etc.).",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Pick a theme (animal/robot/house).", "Set 60 seconds timer.", "Add a rule (only shapes / non-dominant hand)."],
      variations: ["Comic strip 4 panels (T20)", "Guess-the-drawing round"]
    },
    {
      id: "ACT_0004",
      title: "Sock Basketball",
      summary: "Rolled socks into a laundry basket target.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SSMALL_SPACE"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Roll 6–12 socks into balls.", "Place basket as hoop; mark a throwing line.", "Take turns; keep score."],
      variations: ["Different point zones", "Trick shots (older kids)"]
    },
    {
      id: "ACT_0005",
      title: "Animal Walk Relay",
      summary: "Burn energy with bear crawl, crab walk, frog jumps.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Set a safe route (hall/room).", "Call an animal movement.", "Race the timer, not each other."],
      variations: ["Obstacle add-ons (pillows)", "Quiet version: slow animal walks"]
    },
    {
      id: "ACT_0006",
      title: "Mystery Bag (Touch Guess)",
      summary: "Guess items by touch only.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Put 5–10 safe items in a bag.", "Kid feels one item without peeking.", "They guess; score 1 point per correct guess."],
      variations: ["Theme bag (kitchen items)", "Timed round"]
    },
    {
      id: "ACT_0007",
      title: "Treasure Hunt (5 Clues)",
      summary: "Hide 5 items, solve clues to find a prize.",
      tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P0", "M0", "T20", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Hide a final prize (snack/sticker).", "Write or say 5 clues.", "Let kids solve each clue to find the next."],
      variations: ["Hot/cold for younger kids", "Rhyming clues for older kids"]
    },
    {
      id: "ACT_0008",
      title: "Build a Den (Fort)",
      summary: "Chairs + blanket + pillows = cosy play/reading den.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M1", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Choose 2 chairs/sofa edge.", "Drape blanket; add pillows.", "Add torch + 2 books or quiet toys."],
      variations: ["Den rules sign", "Snack picnic inside"]
    },
    {
      id: "ACT_0009",
      title: "Paper Plane Olympics",
      summary: "Distance + accuracy + trick flight scoring.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Fold 2–3 planes.", "Run 3 events: distance, accuracy, trick.", "Record scores; crown a champion."],
      variations: ["Make a 'wind tunnel' with a fan (adult controls)", "Design challenge: must carry a paperclip (older)"]
    },
    {
      id: "ACT_0010",
      title: "Mini Home Olympics (5 Stations)",
      summary: "Structured energy burn with safe stations.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M1", "T45", "EHIGH", "SNOISE_OK", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "high" },
      steps: ["Set 5 stations: hops, toss, balance, crawl, target.", "30–60 seconds per station.", "Give paper medals; end with water break."],
      variations: ["Team mode (siblings vs timer)", "Quiet mode: balance + yoga stations"]
    },
    {
      id: "ACT_0011",
      title: "Pillow Lava Floor",
      summary: "The floor is lava - navigate using pillows and cushions.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M1", "T10", "EHIGH", "SNOISE_OK"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Scatter pillows across the room.", "Announce 'The floor is lava!'", "Navigate from one side to the other without touching floor."],
      variations: ["Add a time limit", "Carry an object while crossing", "Rescue a stuffed toy mission"]
    },
    {
      id: "ACT_0012",
      title: "Indoor Bowling",
      summary: "Set up plastic bottles as pins; roll a soft ball.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "EMED", "SSMALL_SPACE"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Line up 6-10 empty plastic bottles.", "Mark a throwing line.", "Roll a soft ball to knock them down; keep score."],
      variations: ["Add water to bottles for stability", "Use different sized balls", "Create tournament brackets"]
    },
    {
      id: "ACT_0013",
      title: "Simon Says",
      summary: "Classic listening game - follow commands only when Simon says.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EMED", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["One person is Simon.", "Give commands with or without 'Simon says'.", "Players who move without 'Simon says' are out."],
      variations: ["Speed round version", "Theme: animal movements only", "Let kids take turns being Simon"]
    },
    {
      id: "ACT_0014",
      title: "Obstacle Course",
      summary: "Create an indoor course using furniture and household items.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T20", "EHIGH", "SNOISE_OK"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "high" },
      steps: ["Set up stations: crawl under table, hop over pillows, balance on line.", "Demonstrate the course once.", "Time each run; try to beat personal best."],
      variations: ["Backwards course", "Blindfolded section (with spotter)", "Carry an egg on a spoon"]
    },
    {
      id: "ACT_0015",
      title: "Hide and Seek Stuffed Toy",
      summary: "Hide a toy instead of people - perfect for small spaces.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "ELOW", "SSMALL_SPACE"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["One person hides the stuffed toy.", "Others search with 'warmer/colder' hints.", "Finder becomes the next hider."],
      variations: ["Multiple toys hidden", "Photo clue for location", "Timed search challenge"]
    },
    {
      id: "ACT_0016",
      title: "Indoor Hopscotch",
      summary: "Use tape to create hopscotch grid on floor.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Create hopscotch pattern with masking tape.", "Use a beanbag or soft toy as marker.", "Hop through the course following rules."],
      variations: ["Number recognition for younger kids", "Math problems on each square", "Alphabet version"]
    },
    {
      id: "ACT_0017",
      title: "Balloon Keep-Up",
      summary: "Keep balloon in the air as long as possible.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T10", "EHIGH", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Blow up a balloon.", "Count how many taps to keep it airborne.", "Try to beat your record."],
      variations: ["No hands allowed", "Multiple balloons", "Team challenge: pass around circle"]
    },
    {
      id: "ACT_0018",
      title: "Dress-Up Fashion Show",
      summary: "Raid wardrobes for creative outfits and strut the runway.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M1", "T20", "ELOW", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Gather old clothes, accessories, scarves.", "Each person creates an outfit.", "Walk the 'runway' and describe your look."],
      variations: ["Theme: decades, professions, fantasy", "Photo shoot at the end", "Award categories"]
    },
    {
      id: "ACT_0019",
      title: "Flashlight Tag",
      summary: "Indoor tag using flashlight beams in dim room.",
      tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T15", "EHIGH", "SIBLINGS"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Dim the lights (not pitch black).", "One person is 'it' with the flashlight.", "Tag others by shining light on them."],
      variations: ["Multiple taggers", "Safe zones", "Glow stick accessories"]
    },
    {
      id: "ACT_0020",
      title: "Cup Stacking Speed",
      summary: "Stack and unstack cups in pyramid as fast as possible.",
      tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T10", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get 10-15 plastic cups.", "Stack into pyramid, then back to single stack.", "Time yourself; try to beat your record."],
      variations: ["Relay race version", "One-hand only", "Blindfolded with guide"]
    },

    // ============ RAINY DAY ACTIVITIES ============
    {
      id: "RAIN_0001",
      title: "Shadow Puppets",
      summary: "Torch + hands = animals and stories.",
      tags: ["RAINY_DAY", "INDOOR", "SL", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Dim lights; aim torch at wall.", "Make simple shapes (bird, dog).", "Create a 2-minute puppet story."],
      variations: ["Cut-out paper puppets (adult cuts)", "Let kid narrate while parent puppets"]
    },
    {
      id: "RAIN_0002",
      title: "Indoor Scavenger Hunt (10 items)",
      summary: "Find items by colour/shape/use.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T20", "EMED", "SSMALL_SPACE"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Call 10 things to find (soft, shiny, something you wear).", "Set a 5-minute timer.", "Review items; ask why they picked each."],
      variations: ["Photo hunt (SL)", "Riddle hunt (older kids)"]
    },
    {
      id: "RAIN_0003",
      title: "Tape Roads for Toy Cars",
      summary: "Masking tape roads + parking = long play.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M1", "T45", "EMED"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Use tape to make roads on floor/table.", "Add car park, petrol station, car wash.", "Create 'delivery missions' (drop toy at X)."],
      variations: ["Add paper buildings", "Traffic rules game (stop/go)"]
    },
    {
      id: "RAIN_0004",
      title: "Escape Room Lite (6 Clues)",
      summary: "Simple puzzle chain leads to a small prize.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T45", "EMED", "SIBLINGS"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Make 6 clues (math, riddle, letter swap).", "Hide each clue leading to the next.", "Final prize: snack, sticker, or 'coupon'."],
      variations: ["Theme (pirate/space)", "Team vs timer"]
    },
    {
      id: "RAIN_0005",
      title: "Balloon Volleyball",
      summary: "Keep balloon off the floor; great for siblings.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T20", "EHIGH", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Blow up a balloon.", "Mark a 'net' line (string/tape).", "Rules: 3 hits max per side; no catching."],
      variations: ["Must clap before hit", "Quiet mode: slow hits only"]
    },
    {
      id: "RAIN_0006",
      title: "Cardboard Box Creations",
      summary: "Transform boxes into cars, houses, robots.",
      tags: ["RAINY_DAY", "INDOOR", "CRAFT", "NS", "P1", "M2", "T45", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Gather cardboard boxes of various sizes.", "Plan what to build (car, spaceship, castle).", "Cut, tape, and decorate together."],
      variations: ["Add working 'controls' with paper plates", "Paint when dry", "Create a whole town"]
    },
    {
      id: "RAIN_0007",
      title: "Rainy Window Art",
      summary: "Draw on foggy windows or use window markers.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SRAINY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Use washable window markers or crayons.", "Draw weather scenes, rainbows, messages.", "Watch the rain through your art."],
      variations: ["Trace raindrops racing down", "Create a stained glass effect", "Tell stories about what you draw"]
    },
    {
      id: "RAIN_0008",
      title: "Indoor Camping",
      summary: "Set up a tent or blanket fort for camping adventure.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M1", "T90", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Set up tent or build blanket fort.", "Add sleeping bags, pillows, torches.", "Tell stories, have snacks, play quiet games inside."],
      variations: ["Star projection on ceiling", "Nature sounds playlist", "Indoor s'mores with microwave"]
    },
    {
      id: "RAIN_0009",
      title: "Puzzle Marathon",
      summary: "Complete one or more jigsaw puzzles together.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose age-appropriate puzzle.", "Work together, sorting edges first.", "Celebrate completion with a photo."],
      variations: ["Timed challenge", "Multiple puzzles relay", "Puzzle swap with friend"]
    },
    {
      id: "RAIN_0010",
      title: "Board Game Tournament",
      summary: "Play through several board games with points system.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T90", "ELOW", "SIBLINGS"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Select 3-4 quick games.", "Award points for each game (3 for win, 1 for play).", "Crown the tournament champion."],
      variations: ["Card game version", "Video game included", "Prize for winner"]
    },
    {
      id: "RAIN_0011",
      title: "Kitchen Disco",
      summary: "Clear the kitchen floor and have a dance party.",
      tags: ["RAINY_DAY", "INDOOR", "SL", "P0", "M0", "T20", "EHIGH", "SNOISE_OK"],
      age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "high" },
      steps: ["Create a playlist of favourite songs.", "Turn up the volume.", "Dance freely - no rules, just fun!"],
      variations: ["Freeze dance version", "Learn a TikTok dance", "Glow sticks in dim lighting"]
    },
    {
      id: "RAIN_0012",
      title: "Blanket Burrito Roll",
      summary: "Roll kids up in blankets like burritos - silly sensory fun.",
      tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A0_2", "A3_5", "A6_8"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Lay blanket flat.", "Child lies at edge.", "Roll gently; give 'burrito squeezes'."],
      variations: ["Pretend to add toppings", "Gentle rocking", "Unroll slowly or quickly by request"]
    },

    // ============ CAR / TRAVEL ACTIVITIES ============
    {
      id: "CAR_0001",
      title: "I Spy (Colours/Shapes)",
      summary: "Classic car game for younger kids.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Say: 'I spy with my little eye something (colour/shape)...'", "Let kids take turns picking.", "Switch to 'I spy something you use for...' (older)."],
      variations: ["Alphabet I Spy", "Texture I Spy (imagined)"]
    },
    {
      id: "CAR_0002",
      title: "20 Questions",
      summary: "Yes/no guessing game, great for all ages.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["One person thinks of a person/place/thing.", "Others ask yes/no questions (max 20).", "Rotate roles."],
      variations: ["Theme: animals only", "Hard mode: no 'is it a...?' questions"]
    },
    {
      id: "CAR_0003",
      title: "Story Ping-Pong (One Sentence Each)",
      summary: "Collaborative story-building, no screens.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T20", "ELOW", "SIBLINGS"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Adult starts with 1 sentence.", "Each person adds 1 sentence.", "End after 10–20 sentences; give it a title."],
      variations: ["Genre mode: mystery/sci-fi", "Add a word constraint: must include 'banana'"]
    },
    {
      id: "CAR_0004",
      title: "Alphabet Hunt (Signs/Plates)",
      summary: "Find A–Z in the environment.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T45", "EMED"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Start at A, work toward Z.", "Letters can come from signs, shops, plates.", "Celebrate milestones (A–F, etc.)."],
      variations: ["Team mode", "Only use one source type (signs only)"]
    },
    {
      id: "CAR_0005",
      title: "Category Sprint (60 seconds)",
      summary: "Name 10 things in a category before time runs out.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T10", "EMED"],
      age_bands: ["A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Pick category (foods, movies, animals).", "Set 60 seconds.", "Count items; rotate categories."],
      variations: ["Hard mode: no repeats", "Theme: things you'd pack for..."]
    },
    {
      id: "CAR_0006",
      title: "Would You Rather",
      summary: "Fun choices game sparking conversation and giggles.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Ask 'Would you rather... or...' questions.", "Everyone answers and explains why.", "Take turns making up questions."],
      variations: ["Silly mode: impossible scenarios", "Themed: food, superpowers, animals", "Deep questions for teens"]
    },
    {
      id: "CAR_0007",
      title: "Numberplate Bingo",
      summary: "Spot specific letters or numbers on passing plates.",
      tags: ["CAR", "SCAR", "NS", "P1", "M0", "T45", "ELOW"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Create simple bingo cards with letters/numbers.", "Mark off when spotted on plates.", "First to complete a line wins."],
      variations: ["Full house version", "Colour car bingo", "Lorry/bus spotting"]
    },
    {
      id: "CAR_0008",
      title: "Name That Tune",
      summary: "Hum or tap songs for others to guess.",
      tags: ["CAR", "SCAR", "SL", "P0", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["One person hums a song.", "Others guess the title.", "Award points; take turns humming."],
      variations: ["Use only the radio", "Decade theme", "Film soundtracks only"]
    },
    {
      id: "CAR_0009",
      title: "Road Trip Bingo",
      summary: "Spot common roadside items from a bingo card.",
      tags: ["CAR", "SCAR", "NS", "P1", "M0", "T45", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Create cards with: red car, cow, bridge, lorry, etc.", "Mark items when spotted.", "Complete a line to win."],
      variations: ["Themed: farm, city, motorway", "Photo version", "Collaborative family card"]
    },
    {
      id: "CAR_0010",
      title: "Two Truths and a Lie",
      summary: "Guess which statement is false.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Each person says 3 statements about themselves.", "Two are true, one is a lie.", "Others guess which is the lie."],
      variations: ["Themed: holidays, school, dreams", "About famous people", "Historical facts version"]
    },
    {
      id: "CAR_0011",
      title: "Word Association Chain",
      summary: "Say words connected to the previous word.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Start with any word.", "Next person says a related word.", "Continue the chain; hesitation loses."],
      variations: ["Must rhyme", "Same letter start", "Opposite meaning"]
    },
    {
      id: "CAR_0012",
      title: "Celebrity Heads",
      summary: "Guess the person on your 'forehead' with yes/no questions.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Secretly assign each person a famous character.", "Ask yes/no questions to figure out who you are.", "First to guess wins."],
      variations: ["Animals instead of people", "Book characters", "Historical figures"]
    },
    {
      id: "CAR_0013",
      title: "Fortunately/Unfortunately",
      summary: "Alternate story with good then bad turns.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T15", "ELOW", "SIBLINGS"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Start: 'Once there was a...'", "Next person adds 'Fortunately...'", "Then 'Unfortunately...' and continue alternating."],
      variations: ["Set an ending goal", "Silly mode only", "Must include a specific word each turn"]
    },
    {
      id: "CAR_0014",
      title: "Rhyme Time",
      summary: "Take turns finding rhyming words.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Pick a starting word.", "Go around saying rhyming words.", "Last person to find a rhyme wins."],
      variations: ["Must be real words only", "Speed round", "Create sentences with rhymes"]
    },
    {
      id: "CAR_0015",
      title: "Guess the Sound",
      summary: "Make sounds for others to identify.",
      tags: ["CAR", "SCAR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["One person makes a sound (animal, vehicle, appliance).", "Others guess what it is.", "Award points for correct guesses."],
      variations: ["Close eyes for concentration", "Theme: only animal sounds", "Combination sounds"]
    },

    // ============ CALM DOWN / BIG FEELINGS ============
    {
      id: "CALM_0001",
      title: "5-4-3-2-1 Grounding",
      summary: "Simple senses-based calming exercise.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "SQUIET_ONLY", "NS", "P0", "M0", "T5", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Name 5 things you can see.", "4 things you can feel.", "3 things you can hear.", "2 things you can smell.", "1 thing you can taste (or one slow breath)."],
      variations: ["Do it as a whisper game", "Do it with a favourite object in hand"]
    },
    {
      id: "CALM_0002",
      title: "Balloon Breathing (4-2-6)",
      summary: "Breath pattern to reduce overwhelm.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Inhale 4 seconds (fill balloon).", "Hold 2 seconds.", "Exhale 6 seconds (slow release).", "Repeat 5 times."],
      variations: ["Blow up a real balloon after 3 rounds (optional)", "Use bubbles instead (adult supervises)"]
    },
    {
      id: "CALM_0003",
      title: "Parent Script: Big Feelings",
      summary: "Short, repeatable lines for tantrums/anxiety.",
      tags: ["BIG_FEELINGS", "ROUTINES", "NS", "P0", "M0", "T5", "ELOW"],
      age_bands: ["A0_2", "A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "n/a", noise: "n/a" },
      steps: ["Say: 'You're having a big feeling. I'm here. We can be upset and still be safe.'", "Then: 'First we calm our body, then we solve the problem.'", "Offer: 'Hug, space, or help?'"],
      variations: ["For older kids: 'Do you want advice or just listening?'", "For toddlers: fewer words + calm presence"]
    },
    {
      id: "CALM_0004",
      title: "Calm Corner Setup",
      summary: "Create a dedicated space for self-regulation.",
      tags: ["BIG_FEELINGS", "ROUTINES", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose a quiet corner.", "Add cushions, soft toys, sensory items.", "Make a poster of calm-down strategies."],
      variations: ["Include headphones for music", "Add glitter jar", "Feelings chart on wall"]
    },
    {
      id: "CALM_0005",
      title: "Glitter Jar Meditation",
      summary: "Shake jar and watch glitter settle - thoughts settle too.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P1", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Shake the glitter jar vigorously.", "Watch the glitter swirl (like busy thoughts).", "Breathe slowly as glitter settles (thoughts calming)."],
      variations: ["Make your own jar together", "Name the colours as feelings", "Use as timer for calm-down"]
    },
    {
      id: "CALM_0006",
      title: "Body Scan Relaxation",
      summary: "Systematic muscle relaxation from toes to head.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "BEDTIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Lie down comfortably.", "Squeeze and release: toes, legs, tummy, hands, shoulders, face.", "Notice how relaxed each part feels."],
      variations: ["Use visualisation (warm sunshine)", "Do it together", "Robot to jelly transformation"]
    },
    {
      id: "CALM_0007",
      title: "Worry Time Box",
      summary: "Write worries and put them in a box to deal with later.",
      tags: ["BIG_FEELINGS", "ROUTINES", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Write or draw the worry on paper.", "Put it in the worry box.", "Set aside 10 mins later to review and discuss."],
      variations: ["Decorate the box together", "Review at end of week", "Celebrate resolved worries"]
    },
    {
      id: "CALM_0008",
      title: "Butterfly Hug",
      summary: "Self-soothing hug technique for anxiety.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Cross arms over chest, hands on shoulders.", "Tap alternating sides slowly.", "Breathe slowly while tapping."],
      variations: ["Count to 10 while tapping", "Hum softly", "Eyes closed for focus"]
    },
    {
      id: "CALM_0009",
      title: "Feelings Thermometer",
      summary: "Rate feelings on a scale to build emotional vocabulary.",
      tags: ["BIG_FEELINGS", "ROUTINES", "NS", "P1", "M0", "T5", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Draw or print a thermometer 1-10.", "Ask: 'Where are your feelings right now?'", "Discuss what might help move the number."],
      variations: ["Colour-coded zones", "Check in morning and evening", "Family feelings check-in"]
    },
    {
      id: "CALM_0010",
      title: "Angry Drawing",
      summary: "Channel big feelings into scribbling then tearing.",
      tags: ["BIG_FEELINGS", "CRAFT", "NS", "P0", "M0", "T5", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Give paper and crayons.", "Say: 'Scribble how you feel.'", "When done, scrunch or tear the paper and throw away the feeling."],
      variations: ["Stomp on it first", "Make it into a ball and throw", "Draw the opposite feeling after"]
    },
    {
      id: "CALM_0011",
      title: "Safe Place Visualisation",
      summary: "Imagine a calm, safe place in detail.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Close eyes.", "Describe or imagine your safe place (beach, forest, bedroom).", "Notice what you see, hear, smell, feel there."],
      variations: ["Draw it afterwards", "Add a comfort object", "Visit it each night before sleep"]
    },
    {
      id: "CALM_0012",
      title: "Counting Breaths",
      summary: "Simple breath counting to regain focus.",
      tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Breathe in slowly.", "Breathe out and count 'one'.", "Continue to 10, then restart."],
      variations: ["Count backwards from 10", "Use fingers to track", "Buddy breathing together"]
    },

    // ============ SIBLINGS ============
    {
      id: "SIB_0001",
      title: "Sibling Conflict Reset (3 Steps)",
      summary: "Pause, Name, Solve with quick repair script.",
      tags: ["SIBLINGS", "ROUTINES", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Pause: 'Stop. Bodies calm. Voices low.'", "Name: each person says what happened in one sentence.", "Solve: choose one - turn timer, trade/compromise, separate zones for 10 mins."],
      variations: ["Rule: 'two yeses' for shared games", "Peace corner 5 mins then restart"]
    },
    {
      id: "SIB_0002",
      title: "Two-Player Card Game",
      summary: "Simple card games for sibling bonding.",
      tags: ["SIBLINGS", "INDOOR", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Teach a simple game: Snap, Go Fish, or War.", "Play best of 3 rounds.", "Shake hands at the end."],
      variations: ["Create your own rules", "Tournament with points", "Teach each other new games"]
    },
    {
      id: "SIB_0003",
      title: "Joint Art Project",
      summary: "Create one artwork together, taking turns.",
      tags: ["SIBLINGS", "CRAFT", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get one large piece of paper.", "Take turns adding to the picture (30 seconds each).", "Frame or display the collaborative art."],
      variations: ["Theme: underwater, space, city", "Add rules: only blue colours", "Each person adds to other's section"]
    },
    {
      id: "SIB_0004",
      title: "Cooperative Puzzle",
      summary: "Work together on a puzzle with assigned sections.",
      tags: ["SIBLINGS", "INDOOR", "NS", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Each person gets a section to work on.", "Help each other with edge pieces.", "Celebrate when complete."],
      variations: ["Race vs timer together", "Take turns placing pieces", "Photo the progress"]
    },
    {
      id: "SIB_0005",
      title: "Interview Each Other",
      summary: "Take turns asking fun questions and recording answers.",
      tags: ["SIBLINGS", "INDOOR", "NS", "P0", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Prepare 5 fun questions each.", "Take turns being interviewer.", "Record or write the answers."],
      variations: ["Video interview", "Future self interview", "Interview about dreams"]
    },
    {
      id: "SIB_0006",
      title: "Secret Handshake Creation",
      summary: "Invent a unique sibling secret handshake.",
      tags: ["SIBLINGS", "INDOOR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Start with a simple high-five.", "Add unique moves: elbow bump, spin, etc.", "Practice until memorised."],
      variations: ["Add sound effects", "Create different ones for different moods", "Teach to parents"]
    },

    // ============ CHORES ============
    {
      id: "CHORE_0001",
      title: "Chore Sprint (8 minutes)",
      summary: "Time-boxed micro-clean that actually happens.",
      tags: ["CHORES", "ROUTINES", "NS", "P0", "M0", "T10", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Pick ONE micro-task (floor clear, dishes, laundry).", "Set 8-minute timer + music.", "Stop when timer ends; praise completion."],
      variations: ["Two-choice: dishes or laundry", "Beat-the-clock chart (5 checkmarks reward)"]
    },
    {
      id: "CHORE_0002",
      title: "Mission: Floor Clear (20 items)",
      summary: "Gamified tidy: count items put away.",
      tags: ["CHORES", "KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Say: 'Put away 20 items - count out loud.'", "Set a 5-10 min timer.", "Finish line: high-five + choose next mini-activity."],
      variations: ["Colour mission: only red items first", "Speed run: can you do 20 in 3 minutes?"]
    },
    {
      id: "CHORE_0003",
      title: "Laundry Ninja (Match 10 pairs)",
      summary: "Sock matching as a quick win chore.",
      tags: ["CHORES", "INDOOR", "NS", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Dump a small pile of clean socks.", "Challenge: match 10 pairs.", "Bonus: roll pairs into 'sock burritos'."],
      variations: ["Race parent vs kid", "Sort by family member"]
    },
    {
      id: "CHORE_0004",
      title: "Dish Duty DJ",
      summary: "Make dishwashing fun with music and roles.",
      tags: ["CHORES", "INDOOR", "SL", "P0", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Put on favourite playlist.", "Assign roles: washer, dryer, put-awayer.", "Race to finish before 3 songs end."],
      variations: ["Singing allowed", "Dance breaks between dishes", "Points for most creative drying"]
    },
    {
      id: "CHORE_0005",
      title: "Tidy Tornado (Room Blitz)",
      summary: "Everyone tidies one room together in 5 minutes.",
      tags: ["CHORES", "INDOOR", "NS", "P0", "M0", "T5", "EHIGH"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Set 5-minute timer.", "Everyone grabs and puts away items.", "Stop when timer ends - celebrate!"],
      variations: ["Different rooms each day", "Beat yesterday's count", "Before/after photo"]
    },
    {
      id: "CHORE_0006",
      title: "Chore Dice",
      summary: "Roll dice to randomly assign chores.",
      tags: ["CHORES", "ROUTINES", "NS", "P1", "M0", "T15", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Create dice with chores on each face.", "Roll to see your task.", "Complete before next family member rolls."],
      variations: ["Double roll = helper joins", "Snake eyes = skip one", "Create your own dice"]
    },
    {
      id: "CHORE_0007",
      title: "Bed-Making Race",
      summary: "Time yourself making the bed properly.",
      tags: ["CHORES", "MORNING", "NS", "P0", "M0", "T5", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Start timer.", "Make bed: straighten sheets, arrange pillows.", "Record time; try to beat tomorrow."],
      variations: ["Add stuffed toy arrangement", "Hospital corners challenge", "Blindfolded (for fun)"]
    },
    {
      id: "CHORE_0008",
      title: "Toy Rescue Mission",
      summary: "Toys are 'lost' - rescue them to their homes.",
      tags: ["CHORES", "KEEP_BUSY", "NS", "P0", "M0", "T10", "EMED"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Announce: 'Toys are lost! They need rescuing!'", "Find each toy and return to its 'home'.", "Celebrate the rescued toys."],
      variations: ["Give toys voices asking for help", "Use a basket as rescue vehicle", "Thank each toy as you place it"]
    },

    // ============ BUILDING / LEGO / SCIENCE ============
    {
      id: "BUILD_0001",
      title: "Tallest Tower Challenge",
      summary: "Build tallest freestanding tower from cups/books/blocks.",
      tags: ["BUILDING", "INDOOR", "NS", "P0", "M0", "T20", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose materials (cups/books/blocks).", "Set 10-15 min build time.", "Test stability: gentle table tap."],
      variations: ["Only 10 pieces allowed", "Must survive a 'wind test' (gentle fan)"]
    },
    {
      id: "BUILD_0002",
      title: "Bridge Test (Holds a Toy Car)",
      summary: "Engineering mini-challenge with paper/tape.",
      tags: ["BUILDING", "SCIENCE", "INDOOR", "NS", "P1", "M0", "T45", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Create a gap (two books).", "Build a bridge using paper/card + tape.", "Test with toy car; reinforce and retest."],
      variations: ["Limit tape to 30cm", "Add 'load' (coins) for older kids"]
    },
    {
      id: "LEGO_0001",
      title: "LEGO Planet Vehicle",
      summary: "Build a vehicle for a weird planet with constraints.",
      tags: ["LEGO", "BUILDING", "INDOOR", "NS", "P0", "M0", "T45", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose a planet condition (ice, lava, jungle).", "Rule: must carry 3 items.", "Present and explain features."],
      variations: ["Only 2 wheels allowed", "Must include a rescue tool"]
    },
    {
      id: "BUILD_0003",
      title: "Marble Run Design",
      summary: "Create a marble track from cardboard tubes and tape.",
      tags: ["BUILDING", "SCIENCE", "INDOOR", "NS", "P1", "M1", "T45", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Collect cardboard tubes, tape, scissors.", "Design a route from high to low.", "Test with marble; adjust and improve."],
      variations: ["Add jumps and tunnels", "Time the marble", "Multiple track races"]
    },
    {
      id: "BUILD_0004",
      title: "Toothpick Structures",
      summary: "Build with toothpicks and marshmallows or playdough.",
      tags: ["BUILDING", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Use marshmallows or playdough as connectors.", "Build a structure: cube, pyramid, bridge.", "Test how much weight it can hold."],
      variations: ["Tallest tower", "Must have a door", "Specific number of toothpicks"]
    },
    {
      id: "SCIENCE_0001",
      title: "Volcano Eruption",
      summary: "Classic baking soda and vinegar experiment.",
      tags: ["SCIENCE", "INDOOR", "NS", "P1", "M2", "T20", "EHIGH"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "medium" },
      steps: ["Make volcano from playdough or bottle.", "Add baking soda inside.", "Pour vinegar and watch it erupt!"],
      variations: ["Add food colouring", "Measure different amounts", "Multiple volcanoes"]
    },
    {
      id: "SCIENCE_0002",
      title: "Sink or Float",
      summary: "Predict and test which objects float.",
      tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Fill a container with water.", "Gather various objects.", "Predict then test if each sinks or floats."],
      variations: ["Make a boat that floats", "Add cargo to see weight limits", "Salt water comparison"]
    },
    {
      id: "SCIENCE_0003",
      title: "Rainbow Walking Water",
      summary: "Watch coloured water travel between cups.",
      tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T45", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Line up cups with water and food colouring.", "Add paper towel bridges between cups.", "Watch colours travel and mix."],
      variations: ["Predict new colours", "Different paper types", "Time-lapse photos"]
    },
    {
      id: "SCIENCE_0004",
      title: "Magnet Exploration",
      summary: "Discover what magnets attract around the house.",
      tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get a magnet.", "Predict what it will stick to.", "Test around the house and record findings."],
      variations: ["Find the strongest magnet", "Make a list of magnetic vs non-magnetic", "Create a magnet maze"]
    },
    {
      id: "LEGO_0002",
      title: "LEGO Alphabet Challenge",
      summary: "Build letters of the alphabet from LEGO bricks.",
      tags: ["LEGO", "BUILDING", "INDOOR", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Pick a letter.", "Build it using LEGO.", "Line them up to spell names or words."],
      variations: ["Numbers version", "Speed challenge per letter", "Build your name"]
    },
    {
      id: "LEGO_0003",
      title: "LEGO Story Scene",
      summary: "Build a scene from a favourite book or film.",
      tags: ["LEGO", "BUILDING", "INDOOR", "NS", "P0", "M0", "T45", "EMED"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose a scene from a story.", "Build the setting and characters.", "Act out the scene with minifigures."],
      variations: ["Create alternative endings", "Photo the scene", "Stop-motion animation"]
    },

    // ============ CRAFT ============
    {
      id: "CRAFT_0001",
      title: "Collage from Junk Mail",
      summary: "Cut/tear pictures; glue into a themed scene.",
      tags: ["CRAFT", "RAINY_DAY", "INDOOR", "NS", "P1", "M1", "T45", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Pick a theme (underwater, space, animals).", "Cut/tear images; glue onto paper.", "Add labels and a title."],
      variations: ["Make a 'dream holiday' poster", "Add a story paragraph (older kids)"]
    },
    {
      id: "CRAFT_0002",
      title: "Sticker Story Scene",
      summary: "Use 10 stickers to build a story setting.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose 10 stickers.", "Place them to make a scene.", "Tell (or write) a 3-sentence story."],
      variations: ["Comic strip with 4 panels", "Mystery story: include a clue sticker"]
    },
    {
      id: "CRAFT_0003",
      title: "Handprint Art",
      summary: "Turn handprints into animals, trees, or flowers.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T20", "ELOW"],
      age_bands: ["A0_2", "A3_5", "A6_8"],
      constraints: { supervision: "high", noise: "low" },
      steps: ["Apply paint to hand.", "Press onto paper.", "Add details to make an animal/flower."],
      variations: ["Family handprint tree", "Seasonal themes", "Footprints too"]
    },
    {
      id: "CRAFT_0004",
      title: "Paper Plate Masks",
      summary: "Create character masks from paper plates.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Cut eye holes in paper plate.", "Decorate as an animal or character.", "Add elastic to wear."],
      variations: ["Superhero masks", "Animal faces", "Emotions masks"]
    },
    {
      id: "CRAFT_0005",
      title: "Nature Collage",
      summary: "Collect natural items and create art.",
      tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T30", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Collect leaves, twigs, flowers (with permission).", "Arrange on paper or card.", "Glue down or photograph."],
      variations: ["Make a face from nature", "Seasonal changes comparison", "Frame it"]
    },
    {
      id: "CRAFT_0006",
      title: "Origami Basics",
      summary: "Fold paper into simple shapes like boats and planes.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get square paper.", "Follow simple instructions for a boat or fortune teller.", "Display or play with your creation."],
      variations: ["Progress to animals", "Decorate before folding", "Teach a friend"]
    },
    {
      id: "CRAFT_0007",
      title: "Friendship Bracelets",
      summary: "Weave simple bracelets from string or wool.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Cut 3 strands of string.", "Knot at top and plait.", "Tie around wrist."],
      variations: ["Add beads", "Learn more complex patterns", "Make for friends"]
    },
    {
      id: "CRAFT_0008",
      title: "Cardboard Tube Binoculars",
      summary: "Make pretend binoculars for adventure play.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T15", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Tape two toilet roll tubes together.", "Decorate with stickers or paint.", "Add string to wear around neck."],
      variations: ["Bird watching activity", "Safari game", "Spy mission"]
    },
    {
      id: "CRAFT_0009",
      title: "Painted Rocks",
      summary: "Collect smooth stones and paint designs.",
      tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M2", "T30", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Find smooth, flat rocks.", "Clean and dry them.", "Paint with acrylics; seal when dry."],
      variations: ["Kindness rocks with messages", "Pet rocks with faces", "Hide for others to find"]
    },
    {
      id: "CRAFT_0010",
      title: "Sock Puppet",
      summary: "Transform old socks into puppet characters.",
      tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Use an old sock.", "Add button eyes, felt mouth, yarn hair.", "Create a character and name it."],
      variations: ["Put on a puppet show", "Make a whole family", "Add costume changes"]
    },

    // ============ KITCHEN / MEALS ============
    {
      id: "KITCH_0001",
      title: "Rainbow Snack Plate",
      summary: "Make a snack plate with 5 colours.",
      tags: ["MEALS_SIMPLE", "KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Pick 5 colours.", "Find one food per colour (fruit/veg/crackers).", "Arrange on plate; name it like a cafe special."],
      variations: ["Add a score for crunch/sweet/salty", "Teen version: plan a budget snack"]
    },
    {
      id: "KITCH_0002",
      title: "Wrap Assembly Line",
      summary: "Kids build wraps with safe fillings and roles.",
      tags: ["MEALS_SIMPLE", "ROUTINES", "INDOOR", "NS", "P1", "M1", "T45", "EMED", "SIBLINGS"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "high", noise: "low" },
      steps: ["Set fillings in bowls (adult prep).", "Assign roles: washer, arranger, wrapper, taste tester.", "Everyone builds a wrap; tidy together."],
      variations: ["Pizza wraps", "Make a 'menu' and take orders"]
    },
    {
      id: "KITCH_0003",
      title: "Smoothie Creation",
      summary: "Blend a healthy smoothie with chosen ingredients.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "high", noise: "low" },
      steps: ["Choose: 1 fruit, 1 liquid, 1 extra (yogurt, seeds).", "Add to blender (adult operates).", "Taste and name your creation."],
      variations: ["Traffic light smoothie (layers)", "Blind taste test", "Rate each other's creations"]
    },
    {
      id: "KITCH_0004",
      title: "Sandwich Shapes",
      summary: "Use cookie cutters to make fun sandwich shapes.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Make a simple sandwich.", "Press cookie cutter through.", "Eat the edges as 'crusts bonus'."],
      variations: ["Themed shapes for occasions", "Stack mini sandwiches", "Decorate with veg faces"]
    },
    {
      id: "KITCH_0005",
      title: "Fruit Kebabs",
      summary: "Thread fruit onto skewers for a healthy snack.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Cut fruit into chunks (adult helps).", "Thread onto wooden skewers.", "Arrange on plate to share."],
      variations: ["Pattern challenge", "Dipping sauce", "Rainbow order"]
    },
    {
      id: "KITCH_0006",
      title: "Pizza Faces",
      summary: "Decorate mini pizzas with face designs.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T30", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "low" },
      steps: ["Use English muffins or mini pizza bases.", "Spread sauce and cheese.", "Add toppings to make faces; bake."],
      variations: ["Animal faces", "Monster faces", "Self-portraits"]
    },
    {
      id: "KITCH_0007",
      title: "Ants on a Log",
      summary: "Classic celery, peanut butter, and raisins snack.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Wash and cut celery (adult).", "Spread peanut butter or cream cheese.", "Add raisins as 'ants'."],
      variations: ["Different 'logs' (cucumber)", "Other 'bugs' (dried cranberries)", "Make a caterpillar trail"]
    },
    {
      id: "KITCH_0008",
      title: "No-Bake Energy Balls",
      summary: "Mix, roll, and eat healthy snack balls.",
      tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Mix oats, honey, peanut butter, chocolate chips.", "Roll into small balls.", "Chill for 30 mins before eating."],
      variations: ["Add dried fruit", "Roll in coconut", "Different flavour additions"]
    },

    // ============ HOMEWORK ============
    {
      id: "HOMEWORK_0001",
      title: "10/2 Focus Blocks",
      summary: "Work 10 minutes, break 2 minutes; repeat.",
      tags: ["HOMEWORK", "ROUTINES", "INDOOR", "NS", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Set one task only on desk.", "Timer 10 mins work.", "2 mins break (stretch/water).", "Repeat 3-4 cycles."],
      variations: ["First/Then: 'First 10 mins, then 10 mins fun'", "Body-double: parent sits nearby doing their own task"]
    },
    {
      id: "HOMEWORK_0002",
      title: "Homework Station Setup",
      summary: "Create a distraction-free study spot.",
      tags: ["HOMEWORK", "ROUTINES", "NS", "P1", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose a quiet spot.", "Gather all supplies needed.", "Remove distractions (phone, toys)."],
      variations: ["Portable homework box", "Standing desk option", "Different locations for variety"]
    },
    {
      id: "HOMEWORK_0003",
      title: "Reward Chart System",
      summary: "Track homework completion with sticker rewards.",
      tags: ["HOMEWORK", "ROUTINES", "NS", "P1", "M0", "T10", "ELOW"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Create a simple chart.", "Add sticker for each completed session.", "Set milestone rewards (5 stickers = treat)."],
      variations: ["Points system", "Weekly rewards", "Choose your own reward"]
    },
    {
      id: "HOMEWORK_0004",
      title: "Read Aloud Together",
      summary: "Take turns reading paragraphs.",
      tags: ["HOMEWORK", "QUIET_TIME", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose a book at appropriate level.", "Take turns reading a paragraph each.", "Discuss what you read."],
      variations: ["Character voices", "Predict what happens next", "Draw a scene afterwards"]
    },
    {
      id: "HOMEWORK_0005",
      title: "Spelling Word Games",
      summary: "Practice spelling with fun activities.",
      tags: ["HOMEWORK", "INDOOR", "NS", "P0", "M0", "T15", "ELOW"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get this week's spelling list.", "Write in rainbow colours, sand, or shaving foam.", "Test each other at the end."],
      variations: ["Air writing", "Back writing (trace on back)", "Spelling bee style"]
    },
    {
      id: "HOMEWORK_0006",
      title: "Times Table Songs",
      summary: "Learn times tables through catchy songs.",
      tags: ["HOMEWORK", "INDOOR", "SL", "P0", "M0", "T10", "ELOW"],
      age_bands: ["A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Find a times table song online.", "Sing along several times.", "Test without the music."],
      variations: ["Make up your own tune", "Actions with each number", "Speed challenge"]
    },

    // ============ BEDTIME / MORNING ROUTINES ============
    {
      id: "BED_0001",
      title: "30-Min Bedtime Routine Template",
      summary: "Predictable bedtime order to reduce negotiation.",
      tags: ["BEDTIME", "ROUTINES", "INDOOR", "NS", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["5 mins tidy + clothes ready", "5 mins wash/teeth", "10 mins story/reading", "5 mins calm chat (best/worst/funny)", "Lights out + quiet rest"],
      variations: ["Two-book choice", "Audiobook instead of reading (SL)"]
    },
    {
      id: "MORN_0001",
      title: "Morning Launch Pad Checklist",
      summary: "Get out the door with visual list + launch pad.",
      tags: ["MORNING", "ROUTINES", "INDOOR", "NS", "P0", "M0", "T20", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Create a 'launch pad' by the door (bags/shoes).", "Use a simple visual checklist.", "Race the clock, not each other."],
      variations: ["Picture checklist for younger kids", "Points system for teens"]
    },
    {
      id: "BED_0002",
      title: "Gratitude Sharing",
      summary: "Share 3 good things from the day before sleep.",
      tags: ["BEDTIME", "ROUTINES", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Lie in bed together.", "Each person shares 3 good things from the day.", "Say goodnight."],
      variations: ["One good, one challenge, one looking forward to", "Gratitude journal", "Rose, thorn, bud method"]
    },
    {
      id: "BED_0003",
      title: "Bedtime Story Ritual",
      summary: "Cosy reading time before sleep.",
      tags: ["BEDTIME", "ROUTINES", "NS", "P0", "M0", "T15", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose 1-2 books.", "Snuggle up in bed.", "Read with calm, quiet voice."],
      variations: ["Chapter book over several nights", "Child reads to parent", "Make up a story together"]
    },
    {
      id: "MORN_0002",
      title: "Morning Stretch Routine",
      summary: "Gentle stretches to wake up the body.",
      tags: ["MORNING", "ROUTINES", "NS", "P0", "M0", "T5", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Stand and reach up high.", "Touch toes (or try!).", "Twist side to side.", "5 jumping jacks (optional)."],
      variations: ["Animal stretches", "Yoga sun salutation", "Dance to wake up"]
    },
    {
      id: "MORN_0003",
      title: "Outfit Choosing the Night Before",
      summary: "Reduce morning stress by preparing clothes early.",
      tags: ["MORNING", "ROUTINES", "NS", "P0", "M0", "T5", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Check weather forecast.", "Choose complete outfit including socks/shoes.", "Lay out or hang ready."],
      variations: ["Weekly outfit planning", "2-choice system", "Outfit 'stations'"]
    },
    {
      id: "BED_0004",
      title: "Sleepy Time Yoga",
      summary: "Gentle yoga poses to prepare for sleep.",
      tags: ["BEDTIME", "ROUTINES", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Child's pose (resting position).", "Cat-cow stretches.", "Happy baby or starfish.", "Final relaxation lying down."],
      variations: ["Add breathing with each pose", "Guided imagery", "Calm music"]
    },
    {
      id: "BED_0005",
      title: "Wind-Down Timer",
      summary: "Visual timer showing transition to bedtime.",
      tags: ["BEDTIME", "ROUTINES", "NS", "P0", "M0", "T20", "ELOW"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Set a visual timer for 20 mins.", "Announce: 'When the timer ends, we start bedtime.'", "Give 10, 5, and 2 minute warnings."],
      variations: ["Special timer just for this", "Countdown songs", "Gradual light dimming"]
    },

    // ============ OUTDOOR ACTIVITIES ============
    {
      id: "OUTDOOR_0001",
      title: "Nature Bingo",
      summary: "Find items outdoors from a simple bingo card.",
      tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T45", "EMED", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Create a 3x3 bingo card with nature items (leaf, stone, feather).", "Find and tick off items.", "First to complete a line wins."],
      variations: ["Photo bingo (SL)", "Seasonal version (autumn leaves, spring flowers)"]
    },
    {
      id: "OUTDOOR_0002",
      title: "Puddle Jumping Championship",
      summary: "Rainy day outdoor energy burn.",
      tags: ["OUTDOOR", "RAINY_DAY", "NS", "P0", "M0", "T20", "EHIGH", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "high", noise: "high" },
      steps: ["Find safe puddles (no roads!).", "Score: biggest splash, longest jump, silliest landing.", "Dry off and warm up after."],
      variations: ["Boat race with leaves/sticks", "Measure splash distance"]
    },
    {
      id: "OUTDOOR_0003",
      title: "Bug Hunt",
      summary: "Search for minibeasts with magnifying glass.",
      tags: ["OUTDOOR", "SCIENCE", "NS", "P1", "M0", "T30", "ELOW", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Get magnifying glass and container.", "Look under logs, leaves, rocks.", "Observe, don't disturb; release carefully."],
      variations: ["Draw what you find", "Identify species", "Count different types"]
    },
    {
      id: "OUTDOOR_0004",
      title: "Chalk Art Gallery",
      summary: "Create pavement art with chalk.",
      tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get pavement chalk.", "Choose a 'canvas' area.", "Create pictures, games, or messages."],
      variations: ["Hopscotch creation", "Collaborative mural", "Chalk obstacle course"]
    },
    {
      id: "OUTDOOR_0005",
      title: "Cloud Watching",
      summary: "Lie back and find shapes in the clouds.",
      tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T15", "ELOW", "SOUTDOOR", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Lie on blanket looking up.", "Point out cloud shapes.", "Tell stories about what you see."],
      variations: ["Learn cloud types", "Photo the best shapes", "Make up cloud adventures"]
    },
    {
      id: "OUTDOOR_0006",
      title: "Garden Camping",
      summary: "Set up tent in garden for adventure.",
      tags: ["OUTDOOR", "NS", "P1", "M1", "T90", "EMED", "SOUTDOOR"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "high", noise: "medium" },
      steps: ["Set up tent in garden.", "Pack sleeping bags, torches, snacks.", "Tell stories, stargaze, or sleep out."],
      variations: ["Day-time tent play", "Midnight feast", "Star identification"]
    },
    {
      id: "OUTDOOR_0007",
      title: "Leaf Rubbing Collection",
      summary: "Create art from leaf textures.",
      tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M0", "T20", "ELOW", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Collect different leaves.", "Place under paper.", "Rub crayon over to reveal pattern."],
      variations: ["Identify tree types", "Seasonal collection", "Frame the best ones"]
    },
    {
      id: "OUTDOOR_0008",
      title: "Obstacle Garden Course",
      summary: "Set up outdoor challenges in the garden.",
      tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EHIGH", "SOUTDOOR"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "high" },
      steps: ["Set up stations: jump, crawl, balance.", "Time each run.", "Try to beat your record."],
      variations: ["Add water elements in summer", "Themed courses", "Team challenges"]
    },
    {
      id: "OUTDOOR_0009",
      title: "Bird Watching",
      summary: "Spot and identify local birds.",
      tags: ["OUTDOOR", "SCIENCE", "NS", "P1", "M0", "T30", "ELOW", "SOUTDOOR", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get binoculars and bird book.", "Find a quiet spot.", "Watch and identify birds."],
      variations: ["Make a bird feeder first", "Keep a bird diary", "Photo challenge"]
    },
    {
      id: "OUTDOOR_0010",
      title: "Stone Skipping",
      summary: "Learn to skip stones on water.",
      tags: ["OUTDOOR", "NS", "P0", "M0", "T20", "EMED", "SOUTDOOR"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "high", noise: "low" },
      steps: ["Find flat, smooth stones.", "Stand sideways, flick wrist.", "Count the skips; try to improve."],
      variations: ["Competition mode", "Technique teaching", "Different water conditions"]
    },

    // ============ SICK DAY ACTIVITIES ============
    {
      id: "SICK_0001",
      title: "Sick Day Gentle Playlist",
      summary: "Low-energy comfort activities for unwell kids.",
      tags: ["SICK_DAY_LIGHT", "QUIET_TIME", "NS", "P0", "M0", "T90", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Set up a cosy nest (sofa/bed with blankets).", "Rotate: audio story, quiet puzzle, gentle colouring.", "Offer water and light snacks regularly."],
      variations: ["Comfort film with parent", "Simple card games"]
    },
    {
      id: "SICK_0002",
      title: "Audio Story Time",
      summary: "Listen to audiobooks or podcasts while resting.",
      tags: ["SICK_DAY_LIGHT", "QUIET_TIME", "SL", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose an audiobook or kids' podcast.", "Settle comfortably.", "Listen and rest."],
      variations: ["Favourite series", "Educational podcasts", "Story before nap"]
    },
    {
      id: "SICK_0003",
      title: "Colouring and Drawing",
      summary: "Quiet creative time while unwell.",
      tags: ["SICK_DAY_LIGHT", "CRAFT", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Get colouring books or plain paper.", "Provide crayons or pencils.", "Colour or draw quietly."],
      variations: ["Print online colouring pages", "Draw how you feel", "Design a get-well card"]
    },
    {
      id: "SICK_0004",
      title: "Gentle Card Games",
      summary: "Low-energy card games in bed.",
      tags: ["SICK_DAY_LIGHT", "QUIET_TIME", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
      age_bands: ["A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Choose simple games: Snap, Go Fish, Memory.", "Play in bed or on sofa.", "Keep sessions short."],
      variations: ["Solo patience games", "Two-player only", "Very slow pace"]
    },
    {
      id: "SICK_0005",
      title: "Hot Water Bottle Comfort",
      summary: "Warmth and comfort for poorly tummies.",
      tags: ["SICK_DAY_LIGHT", "ROUTINES", "NS", "P0", "M0", "T5", "ELOW"],
      age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Fill hot water bottle (adult only).", "Wrap in soft cover.", "Place on tummy or cuddle."],
      variations: ["Wheat bag alternative", "Special sick-day teddy", "Lavender scent for calm"]
    },

    // ============ PLAYDATE / BIRTHDAY / SLEEPOVER ============
    {
      id: "PLAY_0001",
      title: "Playdate Ice Breaker",
      summary: "Quick game to help kids warm up to each other.",
      tags: ["PLAYDATE", "INDOOR", "NS", "P0", "M0", "T10", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "medium" },
      steps: ["Start with a simple game: catch, drawing together.", "Ask: 'What's your favourite...?'", "Find something in common."],
      variations: ["Two truths and a lie", "Favourite things swap", "Show and tell"]
    },
    {
      id: "PLAY_0002",
      title: "Musical Statues",
      summary: "Classic party game for groups.",
      tags: ["PLAYDATE", "BIRTHDAY", "INDOOR", "SL", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "low", noise: "high" },
      steps: ["Play music; everyone dances.", "Stop music; everyone freezes.", "Anyone who moves is out; last one wins."],
      variations: ["Different dance styles each round", "Freeze in poses", "Team version"]
    },
    {
      id: "PLAY_0003",
      title: "Pass the Parcel",
      summary: "Unwrap layers to music for a prize.",
      tags: ["BIRTHDAY", "INDOOR", "SL", "P1", "M0", "T15", "EMED"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Wrap prize in many layers.", "Sit in circle; pass while music plays.", "When music stops, unwrap one layer."],
      variations: ["Small prize between each layer", "Forfeit cards", "Themed wrapping"]
    },
    {
      id: "SLEEP_0001",
      title: "Sleepover Movie Marathon",
      summary: "Watch films together with snacks.",
      tags: ["SLEEP_OVER", "INDOOR", "SL", "P1", "M0", "T90", "ELOW"],
      age_bands: ["A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Choose 2-3 films by vote.", "Prepare popcorn and drinks.", "Cosy up with blankets and pillows."],
      variations: ["Theme night (Disney, superhero)", "Intermission games", "Reviews after each film"]
    },
    {
      id: "SLEEP_0002",
      title: "Makeover Station",
      summary: "Face masks, nail painting, hair styling fun.",
      tags: ["SLEEP_OVER", "INDOOR", "NS", "P1", "M1", "T45", "ELOW"],
      age_bands: ["A9_12", "A13_16"],
      constraints: { supervision: "medium", noise: "low" },
      steps: ["Set up station with supplies.", "Take turns doing makeovers.", "Photo shoot at the end."],
      variations: ["Crazy hair only", "Face masks and cucumber eyes", "Nail art competition"]
    },
    {
      id: "SLEEP_0003",
      title: "Midnight Feast Planning",
      summary: "Secret snack time during sleepover.",
      tags: ["SLEEP_OVER", "INDOOR", "NS", "P1", "M1", "T20", "ELOW"],
      age_bands: ["A9_12", "A13_16"],
      constraints: { supervision: "low", noise: "low" },
      steps: ["Gather approved snacks earlier.", "Set a 'midnight' time.", "Enjoy whispered snacks together."],
      variations: ["Torch-lit picnic", "Taste test challenge", "Make your own snacks"]
    },
    {
      id: "BDAY_0001",
      title: "Treasure Hunt Party",
      summary: "Birthday party treasure hunt with clues.",
      tags: ["BIRTHDAY", "INDOOR", "OUTDOOR", "NS", "P2", "M0", "T45", "EHIGH"],
      age_bands: ["A3_5", "A6_8", "A9_12"],
      constraints: { supervision: "high", noise: "high" },
      steps: ["Create 6-8 clues around house/garden.", "Teams follow clue trail.", "Final treasure: party bags or cake."],
      variations: ["Themed (pirate, princess)", "Map-based", "Photo clues"]
    },
    {
      id: "BDAY_0002",
      title: "Pin the Tail",
      summary: "Classic blindfolded party game.",
      tags: ["BIRTHDAY", "INDOOR", "NS", "P1", "M0", "T15", "EMED"],
      age_bands: ["A3_5", "A6_8"],
      constraints: { supervision: "medium", noise: "medium" },
      steps: ["Hang picture of animal without tail.", "Blindfold player; spin gently.", "Try to pin tail in correct spot."],
      variations: ["Pin the nose on clown", "Themed versions", "Everyone gets a prize"]
    }
  ]
};

// Helper function to decode tag meanings
export function decodeTag(tag: string): string {
  const tagMap: Record<string, string> = {
    T5: "5 minutes",
    T10: "10 minutes",
    T20: "20 minutes",
    T45: "45 minutes",
    T90: "90 minutes",
    ELOW: "Low energy",
    EMED: "Medium energy",
    EHIGH: "High energy",
    SINDOOR: "Indoor",
    SOUTDOOR: "Outdoor",
    SCAR: "Car/Travel",
    STRAVEL: "Travel",
    SSMALL_SPACE: "Small space",
    SRAINY: "Rainy day",
    SQUIET_ONLY: "Quiet only",
    SNOISE_OK: "Noise okay",
    NS: "No screen",
    SL: "Screen light",
    SY: "Screen yes",
    M0: "No mess",
    M1: "Some mess",
    M2: "Messy",
    P0: "No prep",
    P1: "Minimal prep",
    P2: "More prep",
    A0_2: "Ages 0-2",
    A3_5: "Ages 3-5",
    A6_8: "Ages 6-8",
    A9_12: "Ages 9-12",
    A13_16: "Ages 13-16"
  };
  return tagMap[tag] || tag;
}

// Helper to get age range as human-readable string
export function getAgeRange(ageBands: string[]): string {
  const ages = ageBands.map(band => {
    switch (band) {
      case "A0_2": return "0-2";
      case "A3_5": return "3-5";
      case "A6_8": return "6-8";
      case "A9_12": return "9-12";
      case "A13_16": return "13-16";
      default: return band;
    }
  });
  return `Ages ${ages.join(", ")}`;
}

// Get category from tags
export function getCategoryFromTags(tags: string[]): string {
  const categoryPriority = [
    "CAR", "RAINY_DAY", "OUTDOOR", "BIG_FEELINGS", "CHORES", 
    "HOMEWORK", "BEDTIME", "MORNING", "CRAFT", "SCIENCE",
    "BUILDING", "LEGO", "MEALS_SIMPLE", "SIBLINGS", "SICK_DAY_LIGHT",
    "BIRTHDAY", "SLEEP_OVER", "PLAYDATE",
    "KEEP_BUSY", "INDOOR", "ROUTINES", "QUIET_TIME"
  ];
  
  for (const cat of categoryPriority) {
    if (tags.includes(cat)) {
      return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  return "Activities";
}
