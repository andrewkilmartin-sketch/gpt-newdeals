// Additional activities to reach 500 total
// Sources: National Trust, Woodland Trust, parenting sites, educational resources

import { PlaybookActivity } from './family-playbook';

export const expansionActivities2: PlaybookActivity[] = [
  // ============ MORE STEM / SCIENCE ============
  {
    id: "EXP_0026",
    title: "Static Electricity Butterfly",
    summary: "Use a balloon to create static and make tissue paper butterflies fly.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut butterfly shapes from tissue paper.", "Blow up balloon and rub on hair.", "Hold balloon near butterflies.", "Watch them jump up to stick!"],
    variations: ["Salt and pepper separation", "Bend water stream", "Floating confetti"]
  },
  {
    id: "EXP_0027",
    title: "Bouncing Egg Experiment",
    summary: "Dissolve eggshell in vinegar to create a bouncy naked egg.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Place raw egg in cup of vinegar.", "Leave for 24-48 hours.", "Gently rinse off shell residue.", "Carefully bounce on surface."],
    variations: ["Shrink in corn syrup", "Expand in water", "Glow with tonic water"]
  },
  {
    id: "EXP_0028",
    title: "Walking Water Rainbow",
    summary: "Watch colored water travel between glasses using paper towels.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Line up 7 glasses in a row.", "Fill alternating glasses with colored water.", "Connect all glasses with paper towel strips.", "Watch water walk and mix colors."],
    variations: ["Try different paper types", "Measure water levels", "Create new color combinations"]
  },
  {
    id: "EXP_0029",
    title: "Pepper and Soap Experiment",
    summary: "Make pepper scatter using dish soap on water surface.",
    tags: ["SCIENCE", "INDOOR", "NS", "P0", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fill shallow dish with water.", "Sprinkle pepper on surface.", "Dip finger in dish soap.", "Touch center and watch pepper flee!"],
    variations: ["Explain surface tension", "Try different spices", "Race with two dishes"]
  },
  {
    id: "EXP_0030",
    title: "Lemon Battery",
    summary: "Power a small LED using lemons as a battery source.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M1", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Insert copper coin and zinc nail into lemon.", "Connect lemons in series with wires.", "Attach small LED to end wires.", "Watch LED light up!"],
    variations: ["Try potatoes", "Power a clock", "Measure voltage"]
  },
  {
    id: "EXP_0031",
    title: "Rubber Egg Bounce",
    summary: "Make an egg shell rubbery by soaking in vinegar.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Place hard-boiled egg in vinegar.", "Leave for 2-3 days.", "Remove and dry gently.", "Test how high it bounces."],
    variations: ["Compare raw vs boiled", "Different vinegar types", "Time how long to dissolve"]
  },
  {
    id: "EXP_0032",
    title: "Gummy Bear Osmosis",
    summary: "Watch gummy bears grow or shrink in different liquids.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Measure gummy bears.", "Place in cups of water, salt water, vinegar.", "Leave overnight.", "Measure again and compare."],
    variations: ["Graph the results", "Try sugar water", "Predict before testing"]
  },
  {
    id: "EXP_0033",
    title: "Solar Oven Cooking",
    summary: "Build a solar oven from a pizza box and cook s'mores.",
    tags: ["SCIENCE", "OUTDOOR", "NS", "P2", "M1", "T60", "EMED", "SOUTDOOR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Cut flap in pizza box lid.", "Line inside with aluminum foil.", "Cover opening with plastic wrap.", "Place s'mores inside on sunny day."],
    variations: ["Melt chocolate", "Warm pizza", "Compare with and without foil"]
  },
  {
    id: "EXP_0034",
    title: "Dinosaur Dig",
    summary: "Excavate toy dinosaurs from homemade fossils.",
    tags: ["SCIENCE", "OUTDOOR", "INDOOR", "NS", "P2", "M2", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix sand, flour, and water into dough.", "Bury small dinosaur toys.", "Let dry overnight.", "Use brushes and tools to excavate."],
    variations: ["Seashell fossils", "Gem mining", "Bones for assembly"]
  },
  {
    id: "EXP_0035",
    title: "Underwater Volcano",
    summary: "Create colorful underwater eruptions in a jar.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T15", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill large jar with cold water.", "Fill small jar with hot water and red food coloring.", "Carefully lower small jar into big jar.", "Watch hot water rise like lava."],
    variations: ["Try different temperatures", "Use oil instead", "Layer colors"]
  },
  // ============ MORE RAINY DAY ============
  {
    id: "RAIN_0021",
    title: "Lava Lamp Making",
    summary: "Create a homemade lava lamp using oil, water, and fizzing tablets.",
    tags: ["RAINY_DAY", "SCIENCE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill bottle 3/4 with vegetable oil.", "Add water and food coloring.", "Drop in Alka-Seltzer tablet.", "Watch colored blobs rise and fall."],
    variations: ["Use glitter", "Try different colors", "Use flashlight underneath"]
  },
  {
    id: "RAIN_0022",
    title: "Paper Bag Puppets",
    summary: "Create puppet characters from paper bags.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw face on bottom of paper bag.", "Add hair, ears, or other features.", "Insert hand to operate mouth.", "Put on a puppet show."],
    variations: ["Animal puppets", "Family members", "Story characters"]
  },
  {
    id: "RAIN_0023",
    title: "Indoor Camping",
    summary: "Set up a tent or fort indoors for adventure.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P2", "M0", "T120", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up small tent or build blanket fort.", "Bring sleeping bags and pillows.", "Use flashlights for atmosphere.", "Tell stories and play games."],
    variations: ["Shadow puppets", "Stargazing with glow stars", "Campfire songs"]
  },
  {
    id: "RAIN_0024",
    title: "Memory Card Game",
    summary: "Make homemade matching cards and test memory.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut card into matching pairs of squares.", "Draw identical pictures on pairs.", "Shuffle and lay face down.", "Take turns flipping two to find matches."],
    variations: ["Word matching", "Math fact pairs", "Photo memory game"]
  },
  {
    id: "RAIN_0025",
    title: "Marble Painting",
    summary: "Roll marbles through paint on paper to create art.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Place paper in box or tray.", "Add drops of paint.", "Add marbles and tilt tray.", "Roll marbles to spread paint patterns."],
    variations: ["Use different ball sizes", "Layer colors", "Make wrapping paper"]
  },
  {
    id: "RAIN_0026",
    title: "Shadow Tracing",
    summary: "Use a lamp to cast shadows of toys to trace.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up lamp near wall.", "Place toy between lamp and paper on wall.", "Trace the shadow outline.", "Color in the traced shapes."],
    variations: ["Profile portraits", "Action figures poses", "Shadow monster gallery"]
  },
  {
    id: "RAIN_0027",
    title: "Calm Down Corner Setup",
    summary: "Create a cozy space for self-regulation.",
    tags: ["RAINY_DAY", "BIG_FEELINGS", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose a quiet corner.", "Add cushions, blankets, soft toys.", "Include calming tools: stress ball, glitter jar.", "Practice using it when calm."],
    variations: ["Tent version", "Reading nook", "Sensory corner"]
  },
  {
    id: "RAIN_0028",
    title: "Guess the Object",
    summary: "Feel objects in a bag without looking and guess what they are.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Put various objects in a pillowcase.", "Reach in without looking.", "Feel and describe the object.", "Guess what it is."],
    variations: ["Themed collections", "Time challenges", "Describe for others to guess"]
  },
  {
    id: "RAIN_0029",
    title: "Indoor Treasure Map",
    summary: "Draw a map of your house with treasure marked.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw bird's eye view of house.", "Mark rooms with symbols.", "Hide treasure and mark with X.", "Give map to others to find it."],
    variations: ["Pirate theme", "Multiple treasures", "Coded clues"]
  },
  {
    id: "RAIN_0030",
    title: "Magazine Collage Art",
    summary: "Cut pictures from magazines to create themed collages.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather old magazines.", "Choose a theme: food, animals, colors.", "Cut out relevant pictures.", "Arrange and glue on paper."],
    variations: ["Vision boards", "Letter collages", "Abstract art"]
  },
  // ============ MORE CAR GAMES ============
  {
    id: "CAR_0021",
    title: "Fortunately Unfortunately",
    summary: "Tell a story alternating between good and bad events.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["First person starts story with 'Fortunately...'", "Next person continues with 'Unfortunately...'", "Keep alternating good and bad.", "See where the story goes!"],
    variations: ["Use 'But then...'", "Add characters", "Theme it"]
  },
  {
    id: "CAR_0022",
    title: "Categories Game",
    summary: "Name items in a category before time runs out.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose a category: fruits, animals, countries.", "Go around naming items.", "Can't repeat or hesitate.", "Last person standing picks next category."],
    variations: ["Alphabetical order", "Start with same letter", "Obscure categories"]
  },
  {
    id: "CAR_0023",
    title: "Two Truths One Lie",
    summary: "Guess which statement about someone is false.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["One person shares 3 statements about themselves.", "Two are true, one is a lie.", "Others guess which is false.", "Reveal the answer."],
    variations: ["About celebrities", "Historical facts", "Future predictions"]
  },
  {
    id: "CAR_0024",
    title: "Story Cubes",
    summary: "Roll dice with pictures and tell a story using all images.",
    tags: ["CAR", "TRAVEL", "NS", "P1", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Roll story dice or use picture cards.", "Tell a story using all pictures.", "Pass to next person to continue.", "See how creative it gets!"],
    variations: ["One minute stories", "Genre specific", "Add sound effects"]
  },
  {
    id: "CAR_0025",
    title: "Spelling Challenges",
    summary: "Take turns spelling words aloud in the car.",
    tags: ["CAR", "TRAVEL", "HOMEWORK", "NS", "P0", "M0", "T15", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Give a word to spell.", "Spell it letter by letter.", "Correct spelling gets a point.", "Take turns giving words."],
    variations: ["Theme words", "Sight words for younger", "Backwards spelling"]
  },
  {
    id: "CAR_0026",
    title: "Word Association",
    summary: "Say the first word that comes to mind from the previous word.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T10", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["First person says a word.", "Next person says first word that comes to mind.", "Continue around.", "See where the chain leads."],
    variations: ["Only nouns", "Rhyming words", "Opposite words"]
  },
  {
    id: "CAR_0027",
    title: "Name That Tune",
    summary: "Hum a song and others guess the title.",
    tags: ["CAR", "TRAVEL", "SL", "P0", "M0", "T15", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Hum a familiar tune.", "Others try to guess the song.", "First to guess correctly wins.", "Winner hums next."],
    variations: ["Play first 3 notes", "Movie themes only", "Decades edition"]
  },
  {
    id: "CAR_0028",
    title: "Car Color Count",
    summary: "Count cars of a specific color during the journey.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T30", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Each person picks a car color.", "Count cars of that color.", "Check counts at destination.", "Most cars wins."],
    variations: ["Specific car types", "Add up numbers on plates", "Find patterns"]
  },
  {
    id: "CAR_0029",
    title: "Sticker Activity Book",
    summary: "Complete sticker scenes and activities during the drive.",
    tags: ["CAR", "TRAVEL", "NS", "P1", "M0", "T30", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Bring sticker activity book.", "Complete pages during drive.", "Show completed pages.", "Save some for return journey."],
    variations: ["Reusable sticker books", "Create own sticker stories", "Sticker swap"]
  },
  {
    id: "CAR_0030",
    title: "Road Sign Alphabet",
    summary: "Find letters of the alphabet on road signs in order.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T30", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Start looking for A on signs.", "Call out when found and move to B.", "Work through alphabet.", "First to Z wins."],
    variations: ["Numbers 1-10", "Specific words", "Colors in rainbow order"]
  },
  // ============ MORE BEDTIME ============
  {
    id: "BED_0016",
    title: "Sleep Stories Audio",
    summary: "Listen to calming sleep stories on a device.",
    tags: ["BEDTIME", "QUIET_TIME", "SL", "P0", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find sleep story app or recording.", "Get comfortable in bed.", "Play story at low volume.", "Drift off to sleep."],
    variations: ["Nature sounds", "Meditation for kids", "Soft music"]
  },
  {
    id: "BED_0017",
    title: "ABC Relaxation",
    summary: "Name something calming for each letter of alphabet.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Start with A: 'A is for animals sleeping.'", "Continue through alphabet.", "Think of peaceful images.", "Drift off before Z if sleepy."],
    variations: ["Grateful for...", "Places I love...", "Things that make me happy..."]
  },
  {
    id: "BED_0018",
    title: "Tomorrow's Adventure",
    summary: "Talk about one thing to look forward to tomorrow.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Snuggle together in bed.", "Ask: 'What are you excited about tomorrow?'", "Discuss briefly.", "End with positive thought."],
    variations: ["Week ahead", "Goals for tomorrow", "Dream adventures"]
  },
  {
    id: "BED_0019",
    title: "Counting Sheep Visualization",
    summary: "Imagine and count fluffy sheep jumping over a fence.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Close eyes and relax.", "Picture a grassy field with fence.", "See fluffy sheep jumping over.", "Count each one slowly."],
    variations: ["Bunnies hopping", "Fish swimming", "Clouds floating"]
  },
  {
    id: "BED_0020",
    title: "Finger Relaxation",
    summary: "Touch each fingertip with thumb while breathing.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Touch thumb to pointer, breathe in.", "Touch thumb to middle, breathe out.", "Continue through fingers.", "Repeat on other hand."],
    variations: ["Name something good for each finger", "Count breaths", "Say kind words per finger"]
  },
  {
    id: "BED_0021",
    title: "Dream Journal",
    summary: "Write or draw dreams each morning, review at bedtime.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Keep journal by bed.", "Draw or write dreams in morning.", "Look back at bedtime.", "Imagine nice dreams to have."],
    variations: ["Dream goals", "Lucid dream practice", "Dream dictionary"]
  },
  {
    id: "BED_0022",
    title: "Face Yoga for Sleep",
    summary: "Gentle face exercises to release tension before sleep.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Scrunch face tight, then release.", "Raise eyebrows high, then relax.", "Puff out cheeks, then release.", "Finish with gentle face massage."],
    variations: ["Lion face stretch", "Yawn practice", "Eye circles"]
  },
  {
    id: "BED_0023",
    title: "Mindful Coloring",
    summary: "Calm coloring activity before lights out.",
    tags: ["BEDTIME", "CRAFT", "QUIET_TIME", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose calming coloring page.", "Use soft colored pencils.", "Color slowly and mindfully.", "Stop when feeling sleepy."],
    variations: ["Mandala coloring", "Nature scenes", "Zentangle patterns"]
  },
  {
    id: "BED_0024",
    title: "Lavender Hand Massage",
    summary: "Massage hands with calming lotion before bed.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P1", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Apply small amount of lotion.", "Gently massage each finger.", "Rub palms and backs of hands.", "Breathe in calming scent."],
    variations: ["Foot massage", "Apply to temples", "Make own lotion"]
  },
  {
    id: "BED_0025",
    title: "Rain Sounds Sleep",
    summary: "Fall asleep to nature rain sounds.",
    tags: ["BEDTIME", "QUIET_TIME", "SL", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find rain sounds app or video.", "Set sleep timer.", "Play at low volume.", "Close eyes and imagine rain."],
    variations: ["Ocean waves", "Forest sounds", "Thunderstorm (if not scary)"]
  },
  // ============ MORE SENSORY ============
  {
    id: "SENS_0011",
    title: "Frozen Toys Rescue",
    summary: "Free toys frozen in ice blocks using warm water and tools.",
    tags: ["KEEP_BUSY", "SCIENCE", "INDOOR", "NS", "P2", "M2", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "high", noise: "medium" },
    steps: ["Freeze small toys in container of water overnight.", "Provide warm water, salt, and plastic tools.", "Let child work to free toys.", "Discuss how ice melts."],
    variations: ["Dinosaur excavation", "Princess rescue", "Ocean creatures"]
  },
  {
    id: "SENS_0012",
    title: "Moon Sand Play",
    summary: "Make moldable moon sand from flour and baby oil.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix 8 cups flour with 1 cup baby oil.", "Knead until moldable.", "Add to tray with molds and scoops.", "Pack, mold, and shape."],
    variations: ["Add essential oils for scent", "Color with chalk powder", "Beach themed"]
  },
  {
    id: "SENS_0013",
    title: "Edible Finger Paint",
    summary: "Make taste-safe paint for babies and toddlers.",
    tags: ["KEEP_BUSY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Mix yogurt with food coloring.", "Or use baby food purees.", "Let child paint on highchair tray.", "Allow exploration and tasting."],
    variations: ["Use pudding", "Mashed fruit colors", "Whipped cream"]
  },
  {
    id: "SENS_0014",
    title: "Ribbon Wands Dancing",
    summary: "Dance with homemade ribbon wands to music.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P1", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Tie ribbons or streamers to stick or ring.", "Put on music.", "Wave and swirl ribbons to music.", "Try different movements."],
    variations: ["Ribbon rings", "Scarf dancing", "Follow the leader"]
  },
  {
    id: "SENS_0015",
    title: "Texture Board Exploration",
    summary: "Touch and feel different textures on a homemade board.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Glue different textures to cardboard.", "Include: fabric, sandpaper, foil, bubble wrap.", "Let child explore by touching.", "Talk about how each feels."],
    variations: ["Texture book", "Matching game", "Describe without looking"]
  },
  {
    id: "SENS_0016",
    title: "Cotton Ball Transfer",
    summary: "Move cotton balls between containers using tongs.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Put cotton balls in one bowl.", "Provide tongs or tweezers.", "Transfer to another bowl.", "Practice pincer grip."],
    variations: ["Pom poms", "Use chopsticks", "Color sort"]
  },
  {
    id: "SENS_0017",
    title: "Rainbow Spaghetti",
    summary: "Play with colored cooked spaghetti.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P2", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Cook spaghetti and cool.", "Divide and add different food colors.", "Add a drop of oil to prevent sticking.", "Let child squish and play."],
    variations: ["Cut with scissors", "Hide objects to find", "Make nests"]
  },
  {
    id: "SENS_0018",
    title: "Pouring Station",
    summary: "Practice pouring between different containers.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up tray with pitcher and cups.", "Fill with water, rice, or sand.", "Let child practice pouring.", "Catch spills in tray."],
    variations: ["Measuring cups", "Funnels", "Different sized containers"]
  },
  {
    id: "SENS_0019",
    title: "Bubble Wrap Jump",
    summary: "Stomp and pop bubble wrap for sensory fun.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Lay bubble wrap on floor.", "Secure corners with tape.", "Jump and stomp to pop bubbles.", "Enjoy the sounds!"],
    variations: ["Dance party on wrap", "Pop with fingers", "Find all the unpopped ones"]
  },
  {
    id: "SENS_0020",
    title: "Magnet Play",
    summary: "Explore magnetism with magnet toys and metal objects.",
    tags: ["KEEP_BUSY", "SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Gather magnets and various objects.", "Predict which will stick.", "Test each object.", "Sort into magnetic and non-magnetic."],
    variations: ["Fishing game", "Magnet car track", "Fridge magnet art"]
  },
  // ============ MORE OUTDOOR ============
  {
    id: "OUT_0016",
    title: "Rock Painting",
    summary: "Collect and paint rocks for garden decoration.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M1", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect smooth rocks.", "Wash and dry.", "Paint designs or messages.", "Place in garden or hide for others."],
    variations: ["Kindness rocks", "Ladybird rocks", "Pet rocks"]
  },
  {
    id: "OUT_0017",
    title: "Seed Planting",
    summary: "Plant seeds and watch them grow.",
    tags: ["OUTDOOR", "SCIENCE", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill pots with compost.", "Plant seeds at correct depth.", "Water gently.", "Place in sunny spot and watch daily."],
    variations: ["Sunflowers", "Beans in jars", "Herb garden"]
  },
  {
    id: "OUT_0018",
    title: "Outdoor Painting",
    summary: "Set up easel outside and paint nature scenes.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M2", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up painting supplies outside.", "Choose a view or still life.", "Paint what you see.", "Let dry in sunshine."],
    variations: ["Water painting on concrete", "Splatter painting", "Nature stamps"]
  },
  {
    id: "OUT_0019",
    title: "Sprinkler Fun",
    summary: "Run through garden sprinkler on hot days.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P0", "M2", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Set up garden sprinkler.", "Put on swimwear.", "Run through the water.", "Combine with water balloons."],
    variations: ["DIY sprinkler from bottle", "Slip and slide", "Water balloon toss"]
  },
  {
    id: "OUT_0020",
    title: "Stargazing",
    summary: "Look at stars and learn constellations.",
    tags: ["OUTDOOR", "SCIENCE", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Wait for clear, dark night.", "Lay on blanket looking up.", "Find familiar constellations.", "Use app to identify stars."],
    variations: ["Meteor shower watching", "Moon phases", "Spot satellites"]
  },
  {
    id: "OUT_0021",
    title: "Kite Flying",
    summary: "Fly a kite on a windy day.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T45", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Choose open area with wind.", "Assemble kite properly.", "Run into wind to launch.", "Control with string."],
    variations: ["Make your own kite", "Kite fighting", "Stunt kites"]
  },
  {
    id: "OUT_0022",
    title: "Outdoor Yoga",
    summary: "Practice yoga poses in the garden or park.",
    tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lay mat on grass.", "Follow yoga video or sequence.", "Focus on breathing and nature.", "End with relaxation."],
    variations: ["Animal yoga poses", "Partner yoga", "Walking meditation"]
  },
  {
    id: "OUT_0023",
    title: "Pavement Chalk Art",
    summary: "Draw large pictures on pavement with chalk.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P0", "M1", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get bucket of thick pavement chalk.", "Draw large pictures or games.", "Create hopscotch or roads.", "Washes away with rain."],
    variations: ["Chalk maze", "Lie down for body trace", "Street art gallery"]
  },
  {
    id: "OUT_0024",
    title: "Bike Obstacle Course",
    summary: "Set up cones and challenges for bike riding.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Set up cones or markers.", "Create weaving paths.", "Add stopping points.", "Time each attempt."],
    variations: ["Scooter version", "Add ramps", "Team relay"]
  },
  {
    id: "OUT_0025",
    title: "Frisbee Golf",
    summary: "Throw frisbee at targets around the garden.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up targets around garden.", "Throw frisbee towards each in order.", "Count throws to hit each target.", "Lowest score wins."],
    variations: ["Different sized targets", "Team play", "Add obstacles"]
  },
  // ============ MORE CRAFTS ============
  {
    id: "CRAFT_0016",
    title: "Sock Animals",
    summary: "Stuff and decorate old socks into cuddly animals.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill old sock with stuffing or rice.", "Tie off sections for head and body.", "Add button eyes and felt features.", "Create ears, tails, or wings."],
    variations: ["Sock caterpillar", "Sock bunny", "Sock snowman"]
  },
  {
    id: "CRAFT_0017",
    title: "Paper Plate Masks",
    summary: "Transform paper plates into costume masks.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut eye holes in paper plate.", "Paint and decorate face.", "Add ears, nose, whiskers from card.", "Attach stick or elastic."],
    variations: ["Animal masks", "Superhero masks", "Monster masks"]
  },
  {
    id: "CRAFT_0018",
    title: "Rainbow Scrape Painting",
    summary: "Scrape paint across paper for colorful effects.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Put blobs of different colored paint on paper.", "Use cardboard piece as scraper.", "Drag across paint in one motion.", "Create rainbow effect."],
    variations: ["Use comb for stripes", "Layer scrapes", "Different tools"]
  },
  {
    id: "CRAFT_0019",
    title: "Nature Crowns",
    summary: "Make crowns from cardboard and decorate with natural materials.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut crown shape from cardboard.", "Collect leaves, flowers, feathers outside.", "Glue natural materials to crown.", "Wear your nature crown!"],
    variations: ["Leaf headdress", "Flower garland", "Autumn crown"]
  },
  {
    id: "CRAFT_0020",
    title: "Button Art",
    summary: "Glue buttons in patterns to create colorful art.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw simple outline on card.", "Sort buttons by color.", "Glue buttons filling the design.", "Frame when complete."],
    variations: ["Button tree", "Button heart", "Initial letters"]
  },
  {
    id: "CRAFT_0021",
    title: "Paper Weaving",
    summary: "Weave paper strips to create patterns.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut slits in one paper, leaving border.", "Cut strips from another color.", "Weave strips over and under slits.", "Glue ends to secure."],
    variations: ["Checkerboard pattern", "Rainbow colors", "Make placemat"]
  },
  {
    id: "CRAFT_0022",
    title: "Pasta Jewelry",
    summary: "Thread pasta shapes onto string for necklaces.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Color dried tube pasta with markers.", "Cut string to necklace length.", "Thread pasta onto string.", "Tie ends together."],
    variations: ["Paint pasta first", "Add beads", "Create patterns"]
  },
  {
    id: "CRAFT_0023",
    title: "Bubble Printing",
    summary: "Blow colored bubbles onto paper to create prints.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M2", "T20", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix dish soap, water, and paint.", "Blow bubbles with straw (blow out only!).", "Let bubbles pop on paper.", "Layer different colors."],
    variations: ["Use for cards", "Multiple colors at once", "Giant bubbles"]
  },
  {
    id: "CRAFT_0024",
    title: "Cardboard Tube Animals",
    summary: "Create animals from toilet paper tubes.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Paint tube in animal color.", "Add googly eyes.", "Cut ears, wings, or legs from card.", "Create a whole zoo!"],
    variations: ["Butterfly", "Owl", "Elephant"]
  },
  {
    id: "CRAFT_0025",
    title: "Wax Resist Art",
    summary: "Draw with white crayon then paint over to reveal design.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw with white crayon on white paper.", "Paint over with watercolors.", "Watch drawing appear!", "Try on colored paper too."],
    variations: ["Secret messages", "Snowflake pictures", "Ghost art"]
  },
  // ============ MORE ACTIVE ============
  {
    id: "ACTIVE_0011",
    title: "Limbo Dance",
    summary: "Bend backwards under a lowering bar.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Hold broomstick or rope at chest height.", "Dance under without touching.", "Lower after each round.", "Who can go lowest?"],
    variations: ["Caribbean music", "Forward limbo", "Team limbo"]
  },
  {
    id: "ACTIVE_0012",
    title: "Tape Line Games",
    summary: "Use tape on floor for balance and movement games.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make lines, shapes, or paths with tape.", "Walk, hop, or crawl along lines.", "Jump over or balance on.", "Remove easily when done."],
    variations: ["Road for toy cars", "Hopscotch", "Long jump marker"]
  },
  {
    id: "ACTIVE_0013",
    title: "Indoor Skating",
    summary: "Skate across floor in socks or on paper plates.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Put on fuzzy socks or stand on paper plates.", "Slide across smooth floor.", "Practice skating moves.", "Hold onto something for balance."],
    variations: ["Figure skating routine", "Paper plate ski slalom", "Sock races"]
  },
  {
    id: "ACTIVE_0014",
    title: "Feather Blow Race",
    summary: "Blow feathers across the floor to a finish line.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get lightweight feathers.", "Mark start and finish lines.", "Get on floor and blow feather.", "First to finish wins!"],
    variations: ["Use straws", "Pompom race", "Relay version"]
  },
  {
    id: "ACTIVE_0015",
    title: "Bean Bag Toss",
    summary: "Throw bean bags at targets for points.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make targets from boxes with holes.", "Assign point values to each hole.", "Take turns throwing bean bags.", "Add up scores."],
    variations: ["Tic tac toe version", "Buckets at distances", "Themed targets"]
  },
  {
    id: "ACTIVE_0016",
    title: "Crab Walk Race",
    summary: "Race across the room walking like crabs.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Start on bottom, hands and feet on floor.", "Lift body like a table.", "Race crab-walking to finish.", "Keep bottom off the ground!"],
    variations: ["Balance ball on tummy", "Obstacle course", "Relay race"]
  },
  {
    id: "ACTIVE_0017",
    title: "Yoga Animal Poses",
    summary: "Practice yoga poses named after animals.",
    tags: ["KEEP_BUSY", "QUIET_TIME", "INDOOR", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Learn poses: cat, cow, cobra, dog, butterfly.", "Hold each for 5 breaths.", "Make animal sounds if fun.", "Create an animal yoga story."],
    variations: ["Jungle yoga", "Ocean yoga", "Make up new poses"]
  },
  {
    id: "ACTIVE_0018",
    title: "Musical Bumps",
    summary: "When music stops, sit down fast - last one sitting is out.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Play music while everyone dances.", "Stop music randomly.", "Everyone sits down quickly.", "Last to sit is out."],
    variations: ["Lie down version", "Freeze in pose", "Musical islands"]
  },
  {
    id: "ACTIVE_0019",
    title: "Target Ball Throw",
    summary: "Throw soft balls at stacked targets.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Stack plastic cups or boxes.", "Mark throwing line.", "Throw soft balls to knock down.", "Rebuild and repeat."],
    variations: ["Point system", "Different ball types", "Timed rounds"]
  },
  {
    id: "ACTIVE_0020",
    title: "Wheelbarrow Races",
    summary: "Partner holds legs while you walk on hands.",
    tags: ["KEEP_BUSY", "OUTDOOR", "SIBLINGS", "NS", "P0", "M0", "T15", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["One person walks on hands.", "Partner holds their ankles.", "Race to finish line.", "Swap positions and race back."],
    variations: ["Obstacle course", "Three-legged race after", "Team relay"]
  },
  // ============ MORE EDUCATIONAL ============
  {
    id: "EDU_0011",
    title: "Coin Sorting and Counting",
    summary: "Sort coins by value and practice counting money.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather mixed coins.", "Sort by value.", "Count each pile.", "Add up total."],
    variations: ["Shop role play", "Make change", "Saving jars"]
  },
  {
    id: "EDU_0012",
    title: "Weather Journal",
    summary: "Record daily weather observations.",
    tags: ["HOMEWORK", "SCIENCE", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Check weather each day.", "Record temperature, conditions, clouds.", "Draw weather symbols.", "Compare over weeks."],
    variations: ["Measure rainfall", "Wind direction", "Predict tomorrow"]
  },
  {
    id: "EDU_0013",
    title: "Flash Card Review",
    summary: "Quick fire review of facts using flashcards.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make or buy flashcards for topic.", "Quiz each other on content.", "Put correct answers aside.", "Review missed ones again."],
    variations: ["Beat the clock", "Game show style", "Group competition"]
  },
  {
    id: "EDU_0014",
    title: "Measurement Hunt",
    summary: "Find and measure objects around the house.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get ruler or tape measure.", "Find objects to measure.", "Record length, width, height.", "Compare and order by size."],
    variations: ["Estimate first", "Metric and imperial", "Find exact matches"]
  },
  {
    id: "EDU_0015",
    title: "Story Writing",
    summary: "Write original short stories.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose a story starter or topic.", "Plan beginning, middle, end.", "Write the story.", "Read aloud to family."],
    variations: ["Illustrated story", "Collaborative story", "Comic strip format"]
  },
  {
    id: "EDU_0016",
    title: "Planet Research",
    summary: "Learn about planets in our solar system.",
    tags: ["HOMEWORK", "SCIENCE", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose a planet to research.", "Find facts: size, distance, moons.", "Create poster or presentation.", "Share with family."],
    variations: ["Model solar system", "Planet comparison chart", "Space quiz"]
  },
  {
    id: "EDU_0017",
    title: "Nature Documentary Watching",
    summary: "Watch educational nature programs together.",
    tags: ["QUIET_TIME", "SCIENCE", "SL", "P0", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose age-appropriate documentary.", "Watch together.", "Pause to discuss interesting facts.", "Research more about favorite animal."],
    variations: ["Ocean life", "Jungle animals", "Dinosaurs"]
  },
  {
    id: "EDU_0018",
    title: "DIY Quiz Show",
    summary: "Create and host a quiz show at home.",
    tags: ["HOMEWORK", "INDOOR", "SIBLINGS", "NS", "P1", "M0", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Write questions on various topics.", "Set up podium and buzzer.", "Host quiz with family as contestants.", "Award prizes."],
    variations: ["Subject-specific", "Teams", "Physical challenges too"]
  },
  {
    id: "EDU_0019",
    title: "Clock Reading Practice",
    summary: "Learn to read analog clocks.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Use real clock or make paper one.", "Practice reading hour.", "Add minute reading.", "Set times for child to read."],
    variations: ["Daily time challenges", "Elapsed time problems", "24-hour clock"]
  },
  {
    id: "EDU_0020",
    title: "Vocabulary Building",
    summary: "Learn new words and use them in sentences.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose 5 new words.", "Look up meanings.", "Write each in a sentence.", "Use throughout the day."],
    variations: ["Word of the day", "Synonym matching", "Crossword puzzles"]
  },
  // ============ REMAINING MISC ============
  {
    id: "MISC_0021",
    title: "Gratitude Cards",
    summary: "Make thank you cards to send to people.",
    tags: ["CRAFT", "QUIET_TIME", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Think of someone to thank.", "Fold card and decorate front.", "Write heartfelt message inside.", "Post or deliver."],
    variations: ["Homemade envelopes", "Photo cards", "Pop-up cards"]
  },
  {
    id: "MISC_0022",
    title: "Family Game Tournament",
    summary: "Multi-game tournament with brackets.",
    tags: ["SIBLINGS", "INDOOR", "NS", "P1", "M0", "T120", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Create tournament bracket.", "Play variety of games.", "Track scores.", "Crown overall champion."],
    variations: ["Video game tournament", "Sports tournament", "Card games"]
  },
  {
    id: "MISC_0023",
    title: "Room Rearranging",
    summary: "Redesign your bedroom layout.",
    tags: ["CHORES", "INDOOR", "NS", "P0", "M0", "T60", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Plan new room layout on paper.", "Clear surfaces and floor.", "Move furniture safely.", "Organize and decorate."],
    variations: ["Just desk area", "Closet organization", "Gallery wall"]
  },
  {
    id: "MISC_0024",
    title: "Recipe Book Making",
    summary: "Create a cookbook of family favorites.",
    tags: ["MEALS_SIMPLE", "CRAFT", "NS", "P1", "M1", "T60", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect favorite family recipes.", "Write out each recipe neatly.", "Add illustrations.", "Bind together as book."],
    variations: ["Photo cookbook", "Interview grandparents for recipes", "Try each recipe"]
  },
  {
    id: "MISC_0025",
    title: "Time Capsule Creation",
    summary: "Fill a container with memories to open later.",
    tags: ["CRAFT", "QUIET_TIME", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find container that seals well.", "Collect meaningful items and photos.", "Write letter to future self.", "Seal and note open date."],
    variations: ["School year capsule", "Family capsule", "Yearly tradition"]
  },
  {
    id: "MISC_0026",
    title: "Charity Toy Sort",
    summary: "Sort toys to donate to charity.",
    tags: ["CHORES", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Go through toys together.", "Sort into keep, donate, bin.", "Clean donated items.", "Take to charity shop."],
    variations: ["Books and clothes too", "Sell for charity", "Swap with friends"]
  },
  {
    id: "MISC_0027",
    title: "Mindful Listening Walk",
    summary: "Walk slowly and notice all the sounds.",
    tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T20", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Walk slowly and quietly.", "Stop and listen carefully.", "Count different sounds you hear.", "Discuss what each sound was."],
    variations: ["Smell walk", "Touch walk", "Color spotting walk"]
  },
  {
    id: "MISC_0028",
    title: "Card House Building",
    summary: "Build structures from playing cards.",
    tags: ["BUILDING", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get deck of cards.", "Lean two cards together as base.", "Build layer by layer.", "See how high you can go."],
    variations: ["Largest house", "Different card games", "Use multiple decks"]
  },
  {
    id: "MISC_0029",
    title: "Penny Flicking Game",
    summary: "Flick coins at targets on a table.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up goal or target at table end.", "Flick coin with finger.", "Try to score goals.", "Keep tally."],
    variations: ["Table football rules", "Multiple coins", "Obstacle course"]
  },
  {
    id: "MISC_0030",
    title: "Mindful Breathing with Hoberman Sphere",
    summary: "Breathe along with expanding and contracting sphere.",
    tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P1", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get Hoberman sphere (expandable ball).", "Breathe in as sphere expands.", "Breathe out as it contracts.", "Match breath to movement."],
    variations: ["Hands opening and closing", "Imagine balloon", "Stuffed animal on belly"]
  },
  {
    id: "MISC_0031",
    title: "Feelings Check-In Cards",
    summary: "Use picture cards to identify and discuss feelings.",
    tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Spread out feelings cards.", "Choose card that matches how you feel.", "Explain why you chose it.", "Discuss and validate feelings."],
    variations: ["Draw your own", "Rate intensity 1-10", "Morning and evening check-in"]
  },
  {
    id: "MISC_0032",
    title: "Silly Photo Booth",
    summary: "Take funny photos with props and costumes.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Gather props: hats, glasses, signs.", "Set up photo area with good lighting.", "Take silly photos on phone.", "Print favorites for memory."],
    variations: ["Green screen backgrounds", "Theme costumes", "Boomerang videos"]
  },
  {
    id: "MISC_0033",
    title: "Garden Bird Watching",
    summary: "Spot and identify birds visiting the garden.",
    tags: ["OUTDOOR", "SCIENCE", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get bird identification chart.", "Sit quietly near bird feeder or bush.", "Watch for different species.", "Record what you spot."],
    variations: ["Photography", "Sound identification", "Seasonal comparison"]
  },
  {
    id: "MISC_0034",
    title: "Family Interview",
    summary: "Interview family members about their life.",
    tags: ["QUIET_TIME", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write interview questions.", "Record answers on paper or device.", "Ask about childhood, memories, advice.", "Create family history record."],
    variations: ["Video interview", "Just grandparents", "Specific topic focus"]
  },
  {
    id: "MISC_0035",
    title: "Positive Affirmation Mirror",
    summary: "Write encouraging messages on bathroom mirror.",
    tags: ["BIG_FEELINGS", "MORNING", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get dry erase markers.", "Write positive messages on mirror.", "Read each morning.", "Change weekly."],
    variations: ["Sticky notes instead", "Goals mirror", "Gratitude list"]
  }
];
