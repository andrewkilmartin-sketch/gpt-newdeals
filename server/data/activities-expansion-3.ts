// Final batch of activities to reach 500 total
// Sources: National Trust, Woodland Trust, parenting sites, educational resources

import { PlaybookActivity } from './family-playbook';

export const expansionActivities3: PlaybookActivity[] = [
  // SCIENCE & DISCOVERY
  {
    id: "EXP_0036",
    title: "Fizzing Colors",
    summary: "Combine baking soda and vinegar with food colors for fizzy art.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M2", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Spread baking soda in tray.", "Mix vinegar with food colors.", "Use droppers to add colored vinegar.", "Watch the fizzy color explosions."],
    variations: ["Use spray bottles", "Add glitter", "Make patterns"]
  },
  {
    id: "EXP_0037",
    title: "Apple Oxidation Test",
    summary: "Test which liquids prevent apple slices from browning.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Slice apple into equal pieces.", "Place each in different liquid: water, lemon juice, vinegar, salt water.", "Observe over 30 minutes.", "Record which prevents browning."],
    variations: ["Try other fruits", "Graph results", "Research why"]
  },
  {
    id: "EXP_0038",
    title: "Penny Cleaning Experiment",
    summary: "Find which household liquid cleans pennies best.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather tarnished pennies.", "Place each in different liquids: vinegar, ketchup, lemon juice.", "Wait 5 minutes.", "Compare which is shiniest."],
    variations: ["Time intervals", "Different coins", "Before and after photos"]
  },
  {
    id: "EXP_0039",
    title: "Seed Germination Race",
    summary: "Plant seeds in different conditions and see which grows fastest.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Plant same seeds in several pots.", "Place in different conditions: light/dark, warm/cold.", "Water the same amount.", "Measure and record growth daily."],
    variations: ["Different seed types", "Grow chart", "Photo journal"]
  },
  {
    id: "EXP_0040",
    title: "Oil and Water Fireworks",
    summary: "Create firework effects with oil, water, and food coloring.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fill jar 3/4 with warm water.", "Mix oil with drops of food coloring in separate cup.", "Pour oil mixture into water.", "Watch color 'fireworks' as they sink."],
    variations: ["Different colors", "Slow motion video", "Explain density"]
  },
  // MORE RAINY DAY
  {
    id: "RAIN_0031",
    title: "Balloon Tennis",
    summary: "Hit balloons back and forth with paper plate paddles.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Tape popsicle sticks to paper plates for paddles.", "Blow up balloon.", "Hit back and forth.", "Don't let it touch the ground!"],
    variations: ["Use fly swatters", "Multiple balloons", "Scoring system"]
  },
  {
    id: "RAIN_0032",
    title: "Magazine Fashion Design",
    summary: "Create fashion designs using magazine cutouts.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut clothing pieces from magazines.", "Draw figure or use template.", "Create outfits by arranging pieces.", "Glue down final designs."],
    variations: ["Themed collections", "Runway show", "Design competition"]
  },
  {
    id: "RAIN_0033",
    title: "Tissue Paper Stained Glass",
    summary: "Create colorful window decorations with tissue paper.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut out frame from black card.", "Cut tissue paper into small pieces.", "Glue onto contact paper or wax paper.", "Display in window for light effect."],
    variations: ["Butterfly shapes", "Rainbow design", "Holiday themes"]
  },
  {
    id: "RAIN_0034",
    title: "Cotton Ball Clouds Art",
    summary: "Create fluffy cloud pictures with cotton balls.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Paint or color blue sky on paper.", "Stretch and shape cotton balls.", "Glue on as fluffy clouds.", "Add sun, birds, or rainbow."],
    variations: ["Weather scenes", "Sheep pictures", "Dream clouds with writing"]
  },
  {
    id: "RAIN_0035",
    title: "Paper Cup Telephones",
    summary: "Make working telephones from cups and string.",
    tags: ["RAINY_DAY", "SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Poke hole in bottom of two cups.", "Thread string through and knot inside.", "Pull string tight between two people.", "Speak into one cup, listen with other."],
    variations: ["Decorate cups", "Test different string lengths", "Three-way call"]
  },
  {
    id: "RAIN_0036",
    title: "Noodle Towers",
    summary: "Build the tallest tower using dried spaghetti and marshmallows.",
    tags: ["RAINY_DAY", "BUILDING", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get dried spaghetti and mini marshmallows.", "Build structure using marshmallows as joints.", "Try different designs.", "Measure height and test stability."],
    variations: ["Bridges", "Shapes challenge", "Team competition"]
  },
  {
    id: "RAIN_0037",
    title: "Mirror Drawing",
    summary: "Draw while looking only at the mirror reflection.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T15", "EMED", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up mirror in front of paper.", "Cover hand with book so you can't see it.", "Draw simple shapes looking only at mirror.", "See how tricky it is!"],
    variations: ["Trace shapes", "Write name", "Draw pictures"]
  },
  {
    id: "RAIN_0038",
    title: "Blind Drawing Challenge",
    summary: "Draw without looking at the paper.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get paper and pencil.", "Close eyes or look away.", "Draw a given subject.", "Compare results and laugh!"],
    variations: ["Draw each other", "Guess the drawing", "Time limit"]
  },
  {
    id: "RAIN_0039",
    title: "Fingerprint Art",
    summary: "Use fingerprints as base for drawings.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Press finger on ink pad.", "Print fingerprints on paper.", "Add legs, faces, details with pen.", "Turn into animals, people, or creatures."],
    variations: ["Fingerprint tree", "Family prints", "Thumbprint cards"]
  },
  {
    id: "RAIN_0040",
    title: "Coding Basics with Blocks",
    summary: "Learn coding concepts through physical block patterns.",
    tags: ["RAINY_DAY", "HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up grid on floor or table.", "Write 'commands' on cards: forward, left, right.", "Place toy at start, target at end.", "Give commands to reach target."],
    variations: ["Add obstacles", "Longer paths", "Coding apps"]
  },
  // MORE CAR
  {
    id: "CAR_0031",
    title: "Thumb Wrestling Tournament",
    summary: "Tournament of thumb wrestling matches during drive.",
    tags: ["CAR", "TRAVEL", "SIBLINGS", "NS", "P0", "M0", "T15", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Create tournament bracket.", "Pair up for matches.", "Winners advance.", "Crown ultimate champion."],
    variations: ["Left hand final", "Best of 3", "Adding forfeits"]
  },
  {
    id: "CAR_0032",
    title: "Counting Cows",
    summary: "Count farm animals spotted from the car window.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T60", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Each side of car gets a score.", "Count cows, sheep, or horses.", "Lose all points if you pass a cemetery.", "Highest count wins."],
    variations: ["Specific animals", "Double points for rare ones", "Running tally"]
  },
  {
    id: "CAR_0033",
    title: "Backseat Bingo",
    summary: "Spot items from bingo cards during the journey.",
    tags: ["CAR", "TRAVEL", "NS", "P1", "M0", "T60", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Print bingo cards before trip.", "Each player marks items spotted.", "First to complete row wins.", "Blackout for bonus."],
    variations: ["Themed cards", "Highway vs city", "Make own cards"]
  },
  {
    id: "CAR_0034",
    title: "Name That Place",
    summary: "Describe landmarks for others to guess the location.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Think of a famous place.", "Give clues about its features.", "Others guess the location.", "Correct guesser goes next."],
    variations: ["Only UK places", "Countries only", "Cities only"]
  },
  {
    id: "CAR_0035",
    title: "First Letter Game",
    summary: "Answer questions using words starting with your first initial.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "EMED", "SCAR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Use the first letter of your name.", "Answer questions only using words starting with that letter.", "Questions: Name, job, city, food you're bringing to a party.", "Get creative with answers!"],
    variations: ["Pick any letter", "All answers must connect", "Speed round"]
  },
  // MORE BEDTIME
  {
    id: "BED_0026",
    title: "5 Senses Countdown",
    summary: "Ground yourself by naming things you sense.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Name 5 things you can see.", "4 things you can touch.", "3 things you can hear.", "2 you can smell, 1 you can taste."],
    variations: ["Just 3 of each", "Focus on calming things", "Silent version"]
  },
  {
    id: "BED_0027",
    title: "Goodnight Moon Game",
    summary: "Say goodnight to everything in the room.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Look around the room.", "Say goodnight to each item you see.", "Goodnight lamp, goodnight toys, goodnight window.", "End with goodnight to child."],
    variations: ["Wave to each item", "Blow kisses", "Whisper version"]
  },
  {
    id: "BED_0028",
    title: "Cloud Body Relaxation",
    summary: "Imagine body parts becoming light as clouds.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lie flat and close eyes.", "Imagine feet becoming fluffy clouds.", "Move up body, each part becoming lighter.", "Float on your cloud to dreamland."],
    variations: ["Sinking into sand", "Melting like ice cream", "Becoming water"]
  },
  {
    id: "BED_0029",
    title: "Magic Feather Breathing",
    summary: "Pretend to blow a feather gently with slow breaths.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Imagine holding a magic feather.", "Breathe in slowly.", "Breathe out gently to keep feather floating.", "Slow, steady breaths."],
    variations: ["Use real feather", "Blow dandelion seeds", "Bubble blowing motion"]
  },
  {
    id: "BED_0030",
    title: "Sleep Story Creation",
    summary: "Make up a calming bedtime story together.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Start: 'Once upon a time in a cozy forest...'", "Take turns adding calm, sleepy sentences.", "Include snuggling, sleeping animals.", "End with everyone falling asleep."],
    variations: ["Same story each night", "Child is the hero", "Beach or cloud setting"]
  },
  // MORE SENSORY
  {
    id: "SENS_0021",
    title: "Gloop Play",
    summary: "Mix cornflour and water with conditioner for stretchy gloop.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix cornflour with hair conditioner.", "Add until stretchy consistency.", "Add food coloring if desired.", "Stretch, pull, and mold."],
    variations: ["Scented conditioner", "Add glitter", "Two colors to mix"]
  },
  {
    id: "SENS_0022",
    title: "Sound Shakers",
    summary: "Fill containers with different items and guess the sounds.",
    tags: ["KEEP_BUSY", "SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Fill opaque containers with: rice, beans, coins, bells.", "Seal containers.", "Shake and guess what's inside.", "Match pairs by sound."],
    variations: ["Memory matching", "Loud to soft order", "Make music"]
  },
  {
    id: "SENS_0023",
    title: "Painting with Unusual Tools",
    summary: "Paint using unconventional tools like forks, sponges, or vegetables.",
    tags: ["KEEP_BUSY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Gather unusual items: forks, sponges, corks, vegetables.", "Dip in paint.", "Print or drag across paper.", "Compare the patterns each makes."],
    variations: ["Car tire prints", "Feet painting", "Nature items"]
  },
  {
    id: "SENS_0024",
    title: "Scented Playdough",
    summary: "Make playdough with added scents for sensory play.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Make regular playdough recipe.", "Add scent: vanilla, lemon, lavender.", "Knead until mixed.", "Explore different scents."],
    variations: ["Match scent to color", "Guess the scent", "Calming lavender"]
  },
  {
    id: "SENS_0025",
    title: "Fabric Texture Sort",
    summary: "Sort fabric samples by texture: soft, rough, smooth.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect fabric scraps of different textures.", "Feel each one.", "Sort into categories.", "Describe the differences."],
    variations: ["Eyes closed matching", "Vocabulary building", "Create texture book"]
  },
  // MORE OUTDOOR
  {
    id: "OUT_0026",
    title: "Nature Photography",
    summary: "Take photos of interesting things in nature.",
    tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Give child camera or phone.", "Walk and photograph interesting finds.", "Look for patterns, colors, textures.", "Create photo gallery at home."],
    variations: ["Theme: only green things", "Macro photography", "Photo competition"]
  },
  {
    id: "OUT_0027",
    title: "Pooh Sticks",
    summary: "Classic bridge game of racing sticks downstream.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T20", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Find bridge over stream.", "Each person finds a distinctive stick.", "Drop sticks on upstream side at same time.", "Run to other side to see whose emerges first."],
    variations: ["Leaf boats", "Mark sticks with colors", "Tournament rounds"]
  },
  {
    id: "OUT_0028",
    title: "Nighttime Torch Walk",
    summary: "Explore the garden or woods with torches after dark.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T30", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Wait until dark.", "Get torches and wrap up warm.", "Explore familiar area at night.", "Listen for nocturnal sounds."],
    variations: ["Spot nocturnal creatures", "Star gazing stop", "Night photography"]
  },
  {
    id: "OUT_0029",
    title: "Natural Paintbrush Making",
    summary: "Make paintbrushes from natural materials found outside.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Find sticks for handles.", "Collect: leaves, grass, pine needles, feathers.", "Tie natural materials to sticks.", "Test each brush with paint."],
    variations: ["Mud painting", "Water painting on concrete", "Compare brush effects"]
  },
  {
    id: "OUT_0030",
    title: "Outdoor Scent Hunt",
    summary: "Find and identify different scents in nature.",
    tags: ["OUTDOOR", "SCIENCE", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Walk slowly through nature area.", "Smell different plants, soil, flowers.", "Describe the scents.", "Rate favorites."],
    variations: ["Blindfolded guessing", "Collect samples", "Make scent jars"]
  },
  // MORE CRAFTS
  {
    id: "CRAFT_0026",
    title: "Straw Weaving",
    summary: "Weave yarn through drinking straws to make bracelets.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Thread yarn through 3-5 straws.", "Tie together at one end.", "Weave additional yarn across straws.", "Push down as you go."],
    variations: ["Pattern designs", "Different yarn colors", "Make belt"]
  },
  {
    id: "CRAFT_0027",
    title: "Paper Marbling",
    summary: "Create marble patterns using shaving cream and paint.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Spread shaving cream in tray.", "Drip paint colors on top.", "Swirl with stick.", "Press paper on top and scrape clean."],
    variations: ["Make book covers", "Wrapping paper", "Frame the art"]
  },
  {
    id: "CRAFT_0028",
    title: "Tin Can Wind Chimes",
    summary: "Create musical wind chimes from decorated tin cans.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P2", "M1", "T45", "EMED", "SOUTDOOR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Clean tin cans thoroughly.", "Punch hole in bottom.", "Decorate outside with paint.", "Thread string through and hang from stick."],
    variations: ["Add beads", "Different sized cans", "Painted designs"]
  },
  {
    id: "CRAFT_0029",
    title: "Melted Crayon Art",
    summary: "Melt crayons to create colorful drip art.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Glue crayons to top of canvas.", "Lean canvas at angle.", "Use hair dryer to melt crayons.", "Watch colors drip down."],
    variations: ["Rainbow order", "Shape arrangements", "Umbrella silhouette"]
  },
  {
    id: "CRAFT_0030",
    title: "Worry Dolls",
    summary: "Create tiny dolls to tell worries to at bedtime.",
    tags: ["CRAFT", "BIG_FEELINGS", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Wrap pipe cleaners for body.", "Add thread or yarn for clothes.", "Draw tiny face with marker.", "Keep under pillow for worries."],
    variations: ["Family of dolls", "Small box home", "Give as gift"]
  },
  // MORE ACTIVE
  {
    id: "ACTIVE_0021",
    title: "Penguin Waddle Race",
    summary: "Race while holding a balloon between your knees.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Place balloon between knees.", "Race to finish line.", "If balloon drops, start over.", "Fastest penguin wins!"],
    variations: ["Team relay", "Obstacle course", "Egg and spoon alternative"]
  },
  {
    id: "ACTIVE_0022",
    title: "Newspaper Ball Fight",
    summary: "Throw crumpled newspaper balls at each other.",
    tags: ["KEEP_BUSY", "INDOOR", "SIBLINGS", "NS", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Crumple newspaper into balls.", "Divide into teams.", "Set up barrier between teams.", "Throw balls - most on opponent's side wins."],
    variations: ["Capture the flag", "Time limit rounds", "Cleanup race after"]
  },
  {
    id: "ACTIVE_0023",
    title: "Sleeping Lions",
    summary: "Stay perfectly still while someone tries to make you move.",
    tags: ["KEEP_BUSY", "INDOOR", "PLAYDATE", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["All lions lie down and stay still.", "Hunter tries to make them move or laugh.", "No touching allowed.", "Last still lion wins."],
    variations: ["Zoo theme with different animals", "Timed rounds", "Musical version"]
  },
  {
    id: "ACTIVE_0024",
    title: "Freeze Tag",
    summary: "When tagged, freeze until another player unfreezes you.",
    tags: ["KEEP_BUSY", "OUTDOOR", "INDOOR", "PLAYDATE", "NS", "P0", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Choose who is 'it'.", "When tagged, freeze in place.", "Other players can unfreeze you.", "Game ends when all are frozen."],
    variations: ["Tunnel tag", "Shadow freeze", "Time limit rounds"]
  },
  {
    id: "ACTIVE_0025",
    title: "Cup Stacking Speed",
    summary: "Stack and unstack cups as fast as possible.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get 10-12 plastic cups.", "Stack into pyramid.", "Unstack back into single pile.", "Time each attempt."],
    variations: ["Different patterns", "One hand only", "Head to head race"]
  },
  // MORE EDUCATIONAL
  {
    id: "EDU_0021",
    title: "Sight Word Hopscotch",
    summary: "Practice sight words while hopping on a grid.",
    tags: ["HOMEWORK", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write sight words in hopscotch grid.", "Hop on grid.", "Read each word you land on.", "Make it back to start."],
    variations: ["Math facts", "Spelling words", "Two players race"]
  },
  {
    id: "EDU_0022",
    title: "Fact Family Houses",
    summary: "Draw houses showing related math facts.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw house shape.", "Put three related numbers in roof.", "Write all related facts in house.", "2+3=5, 3+2=5, 5-2=3, 5-3=2."],
    variations: ["Multiplication families", "Bigger numbers", "Decorate houses"]
  },
  {
    id: "EDU_0023",
    title: "History Mystery Bag",
    summary: "Guess historical periods from items in a bag.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather items related to historical period.", "Put in bag.", "Others feel and guess the era.", "Research the period together."],
    variations: ["Create own mystery bags", "Geographic mysteries", "Literature themes"]
  },
  {
    id: "EDU_0024",
    title: "DIY Fraction Pizzas",
    summary: "Learn fractions by making paper pizzas.",
    tags: ["HOMEWORK", "CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut circles from paper.", "Divide into equal slices.", "Label fractions: 1/2, 1/4, 1/8.", "Add pizza toppings."],
    variations: ["Real pizza making", "Fraction addition", "Compare sizes"]
  },
  {
    id: "EDU_0025",
    title: "Create a Newspaper",
    summary: "Write and illustrate a family newspaper.",
    tags: ["HOMEWORK", "CRAFT", "INDOOR", "NS", "P1", "M0", "T60", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Plan sections: news, weather, sports, comics.", "Write articles about family events.", "Add illustrations.", "Photocopy for relatives."],
    variations: ["Monthly edition", "School themed", "Video news report"]
  },
  // MORE MISC
  {
    id: "MISC_0036",
    title: "Kindness Bingo",
    summary: "Complete acts of kindness to fill bingo card.",
    tags: ["KEEP_BUSY", "OUTDOOR", "INDOOR", "NS", "P1", "M0", "T120", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Create bingo card with kind acts.", "Examples: help neighbor, write letter, share toy.", "Mark off as completed.", "Aim for blackout."],
    variations: ["Family kindness week", "Secret kindness", "Kindness jar"]
  },
  {
    id: "MISC_0037",
    title: "Lemonade Stand Planning",
    summary: "Plan and run a lemonade stand.",
    tags: ["KEEP_BUSY", "OUTDOOR", "NS", "P2", "M1", "T120", "EHIGH", "SOUTDOOR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Plan recipes and pricing.", "Make signs and set up table.", "Prepare lemonade.", "Sell to neighbors and friends."],
    variations: ["Bake sale", "Charity fundraiser", "Hot chocolate in winter"]
  },
  {
    id: "MISC_0038",
    title: "Vision Board Creation",
    summary: "Create a board of goals and dreams.",
    tags: ["CRAFT", "QUIET_TIME", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather magazines and images.", "Cut out inspiring pictures and words.", "Arrange on poster board.", "Display in bedroom."],
    variations: ["Digital version", "Goal-specific boards", "Quarterly update"]
  },
  {
    id: "MISC_0039",
    title: "Nature Sound Recording",
    summary: "Record nature sounds to play later.",
    tags: ["OUTDOOR", "SCIENCE", "QUIET_TIME", "SL", "P0", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Go to quiet outdoor location.", "Use phone to record sounds.", "Capture birds, wind, water.", "Play back to relax."],
    variations: ["Sound library", "Add to videos", "Guess the sound game"]
  },
  {
    id: "MISC_0040",
    title: "Toy Hospital",
    summary: "Fix and clean broken toys together.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Gather toys needing repair.", "Clean dirty toys.", "Glue broken parts.", "Sew torn stuffed animals."],
    variations: ["Doll spa day", "Car mechanic shop", "Donate fixed toys"]
  },
  {
    id: "MISC_0041",
    title: "Obstacle Course Timer",
    summary: "Complete obstacle course while being timed.",
    tags: ["KEEP_BUSY", "OUTDOOR", "INDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Design course with varied challenges.", "Practice run through.", "Time each attempt.", "Beat personal best."],
    variations: ["Weekly challenges", "Team relay", "Add new obstacles"]
  },
  {
    id: "MISC_0042",
    title: "Paper Fortune Teller",
    summary: "Fold and play with paper fortune teller.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fold paper into fortune teller shape.", "Write colors on outside.", "Write numbers inside.", "Write fortunes underneath."],
    variations: ["Homework helper fortunes", "Chore picker", "Positive messages"]
  },
  {
    id: "MISC_0043",
    title: "Secret Agent Mission",
    summary: "Complete secret missions around the house.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Create mission cards with tasks.", "Tasks: decode message, find hidden object, avoid detection.", "Complete missions.", "Earn spy badges."],
    variations: ["Walkie talkie use", "Night missions", "Clue solving"]
  },
  {
    id: "MISC_0044",
    title: "Compliment Chain",
    summary: "Pass compliments around the family circle.",
    tags: ["QUIET_TIME", "BIG_FEELINGS", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Sit in circle.", "Give genuine compliment to person on left.", "Continue around circle.", "Receive compliments gracefully."],
    variations: ["Written compliments", "Compliment jar", "Specific compliment types"]
  },
  {
    id: "MISC_0045",
    title: "Indoor Camping Night",
    summary: "Full camping experience inside the house.",
    tags: ["SLEEP_OVER", "INDOOR", "NS", "P2", "M0", "T180", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up tent in living room.", "Make campfire snacks.", "Tell stories by flashlight.", "Sleep in sleeping bags."],
    variations: ["Backyard alternative", "Movie night combo", "Star projector ceiling"]
  },
  {
    id: "MISC_0046",
    title: "Bucket Drumming",
    summary: "Learn rhythms on upturned buckets.",
    tags: ["KEEP_BUSY", "OUTDOOR", "SL", "P1", "M0", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Get plastic buckets of different sizes.", "Turn upside down.", "Use sticks or hands as drumsticks.", "Learn rhythms and play together."],
    variations: ["Add kitchen items", "Performance show", "Follow a beat"]
  },
  {
    id: "MISC_0047",
    title: "Balance Beam Walking",
    summary: "Practice balance on low beam or tape line.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up low balance beam or tape line.", "Walk across without falling off.", "Try backwards and sideways.", "Add challenges: carry book, eyes closed."],
    variations: ["Time trials", "Obstacle additions", "Gymnastic routine"]
  },
  {
    id: "MISC_0048",
    title: "Backward Day",
    summary: "Do everything backwards for a silly day.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T120", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Wear clothes backwards.", "Eat dessert before dinner.", "Say goodbye when arriving.", "Walk backwards where safe."],
    variations: ["Inside out day", "Opposite day", "Silly voice day"]
  },
  {
    id: "MISC_0049",
    title: "Secret Handshake Creation",
    summary: "Create a special handshake with a friend or family member.",
    tags: ["KEEP_BUSY", "INDOOR", "SIBLINGS", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Work together to create moves.", "Include: claps, fist bumps, snaps, waves.", "Practice until perfect.", "Use as your special greeting."],
    variations: ["Add sound effects", "Teach to others", "Create multiple versions"]
  },
  {
    id: "MISC_0050",
    title: "Puppet Show Performance",
    summary: "Put on a puppet show for family audience.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P1", "M0", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Create or gather puppets.", "Write simple script or improvise.", "Set up stage behind sofa or blanket.", "Perform for family audience."],
    variations: ["Fairy tales", "Original stories", "Problem solving themes"]
  },
  {
    id: "MISC_0051",
    title: "Toy Photography",
    summary: "Set up scenes with toys and photograph them.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose toys and create scene.", "Set up interesting backgrounds.", "Use good lighting.", "Take photos from different angles."],
    variations: ["Action figures adventures", "LEGO scenes", "Stop motion video"]
  },
  {
    id: "MISC_0052",
    title: "Marble Run Building",
    summary: "Build marble runs from cardboard tubes and tape.",
    tags: ["BUILDING", "INDOOR", "NS", "P1", "M0", "T45", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect cardboard tubes and boxes.", "Cut and tape to create track.", "Attach to wall or furniture.", "Test with marbles."],
    variations: ["Add jumps", "Split paths", "Time the runs"]
  },
  {
    id: "MISC_0053",
    title: "Pet Rock Garden",
    summary: "Create a miniature garden for decorated pet rocks.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Paint rocks as creatures or characters.", "Fill shallow container with soil.", "Add small plants or moss.", "Arrange pet rocks in garden."],
    variations: ["Fairy rock village", "Dinosaur habitat", "Seasonal themes"]
  },
  {
    id: "MISC_0054",
    title: "Worry Journal Writing",
    summary: "Write down worries to process and release them.",
    tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Keep dedicated worry journal.", "Write worries when they arise.", "Reflect on patterns.", "Note worries that resolved themselves."],
    variations: ["Problem-solving pages", "Gratitude alongside worries", "Tear out and throw away"]
  },
  {
    id: "MISC_0055",
    title: "Friendship Coupons",
    summary: "Make coupons to give friends for kind acts.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut paper into coupon shapes.", "Write kind offers: hug, play game, share snack.", "Decorate borders.", "Give to friends or family."],
    variations: ["Birthday gift", "Mother's Day coupons", "Random kindness"]
  },
  {
    id: "MISC_0056",
    title: "Mini Golf Course",
    summary: "Create a mini golf course using household items.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up obstacles using books, boxes, cups.", "Create holes using cups on their sides.", "Use sticks as clubs, soft balls.", "Score each hole."],
    variations: ["Themed holes", "Glow in dark version", "Moving obstacles"]
  },
  {
    id: "MISC_0057",
    title: "Body Part Game",
    summary: "Touch body parts as quickly as named.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Call out body parts quickly.", "Everyone touches that part.", "Speed up gradually.", "Add silly parts: elbow on knee, etc."],
    variations: ["Simon Says version", "Musical version", "Two parts at once"]
  },
  {
    id: "MISC_0058",
    title: "Hot Chocolate Making",
    summary: "Make special hot chocolate together.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Heat milk gently.", "Add chocolate powder or melted chocolate.", "Top with whipped cream and marshmallows.", "Enjoy together."],
    variations: ["Candy cane stirrer", "Cinnamon sprinkle", "DIY toppings bar"]
  },
  {
    id: "MISC_0059",
    title: "Memory Lane Walk",
    summary: "Walk familiar route and share memories at each spot.",
    tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Walk around neighborhood or park.", "Stop at meaningful spots.", "Share memories of events there.", "Take photos to remember."],
    variations: ["School route", "First home visit", "Holiday spots"]
  },
  {
    id: "MISC_0060",
    title: "Positive Post-Its",
    summary: "Write encouraging notes on post-its to hide around house.",
    tags: ["BIG_FEELINGS", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write positive messages on sticky notes.", "Hide around house for family to find.", "In lunchboxes, on mirrors, inside books.", "Brighten someone's day."],
    variations: ["Lunch box notes", "Car surprises", "Gratitude messages"]
  }
];
