// Final 63 activities to reach 500 total
// Sources: National Trust, parenting sites, educational resources

import { PlaybookActivity } from './family-playbook';

export const expansionActivities4: PlaybookActivity[] = [
  {
    id: "FIN_0001",
    title: "Paper Airplane Darts",
    summary: "Throw paper airplanes at a target for points.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fold paper airplanes.", "Draw target on paper.", "Throw from marked distance.", "Score points for accuracy."],
    variations: ["Moving target", "Different plane designs", "Team competition"]
  },
  {
    id: "FIN_0002",
    title: "Cookie Decorating",
    summary: "Decorate plain biscuits with icing and sprinkles.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Get plain round biscuits.", "Make icing from icing sugar and water.", "Spread on biscuits.", "Add sprinkles and sweets."],
    variations: ["Face biscuits", "Holiday themes", "Competition judging"]
  },
  {
    id: "FIN_0003",
    title: "Shadow Tag",
    summary: "Tag by stepping on shadows instead of touching.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T20", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Play on sunny day.", "It must step on someone's shadow.", "Tagged person becomes it.", "Use outdoor space with varied shadows."],
    variations: ["Freeze shadow", "Shadow only safe zones", "Team version"]
  },
  {
    id: "FIN_0004",
    title: "Cornflake Cakes",
    summary: "Make no-bake chocolate cornflake cakes.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Melt chocolate with butter.", "Stir in cornflakes.", "Spoon into cupcake cases.", "Refrigerate until set."],
    variations: ["Add marshmallows", "Rice crispies version", "Nest shapes for Easter"]
  },
  {
    id: "FIN_0005",
    title: "Wishing Tree",
    summary: "Write wishes on paper and tie to indoor branch.",
    tags: ["CRAFT", "BIG_FEELINGS", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find branch and put in vase.", "Write wishes on paper strips.", "Tie to branches.", "Revisit to check on wishes."],
    variations: ["Gratitude tree", "Goal tree", "Family wishes"]
  },
  {
    id: "FIN_0006",
    title: "Leaf Rubbing Art",
    summary: "Create art by rubbing crayons over leaves under paper.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect leaves with strong veins.", "Place under paper.", "Rub crayon over paper.", "Watch leaf pattern appear."],
    variations: ["Rainbow rubbings", "Leaf identification", "Frame the art"]
  },
  {
    id: "FIN_0007",
    title: "Balloon Pop Countdown",
    summary: "Pop balloons to reveal activity surprises.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Write activities on paper strips.", "Put in balloons before inflating.", "Pop balloons to reveal each activity.", "Do the activity!"],
    variations: ["Countdown calendar", "Prize reveal", "Chore balloons"]
  },
  {
    id: "FIN_0008",
    title: "Emotion Charades",
    summary: "Act out emotions for others to guess.",
    tags: ["BIG_FEELINGS", "INDOOR", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write emotions on cards.", "Take turns acting without words.", "Others guess the emotion.", "Discuss when you feel that way."],
    variations: ["Scenarios causing emotions", "Body language focus", "Team guessing"]
  },
  {
    id: "FIN_0009",
    title: "String Painting",
    summary: "Drag paint-covered string across paper for abstract art.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Dip string in paint.", "Lay on paper and fold paper over.", "Pull string while pressing down.", "Open to reveal pattern."],
    variations: ["Multiple colors", "Card making", "Yarn instead of string"]
  },
  {
    id: "FIN_0010",
    title: "Traffic Light Snacks",
    summary: "Make healthy snacks in red, yellow, green colors.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Choose red food: tomatoes, strawberries.", "Choose yellow: cheese, banana.", "Choose green: cucumber, grapes.", "Arrange on plate like traffic light."],
    variations: ["Rainbow snacks", "Face snacks", "Caterpillar line"]
  },
  {
    id: "FIN_0011",
    title: "Magazine Word Poem",
    summary: "Cut words from magazines to create poems.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut interesting words from magazines.", "Arrange into poem or message.", "Glue on paper.", "Add illustrations."],
    variations: ["Blackout poetry", "Found word stories", "Secret messages"]
  },
  {
    id: "FIN_0012",
    title: "Outdoor Art Gallery",
    summary: "Display artwork outdoors for family viewing.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect artworks to display.", "Hang on fence or prop on easels.", "Make name cards for each piece.", "Guide family on gallery walk."],
    variations: ["Theme exhibition", "Price tags for pretend sale", "Artist talks"]
  },
  {
    id: "FIN_0013",
    title: "Torch Shadow Puppets",
    summary: "Make shadow puppets on wall using torch light.",
    tags: ["RAINY_DAY", "INDOOR", "NS", "P0", "M0", "T20", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Darken room.", "Shine torch at blank wall.", "Use hands to make animal shapes.", "Tell stories with shadows."],
    variations: ["Cut-out puppets on sticks", "Shadow play scripts", "Animal safari"]
  },
  {
    id: "FIN_0014",
    title: "DIY Bookmark Making",
    summary: "Create personalized bookmarks from card and decorations.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut card into bookmark shapes.", "Decorate with drawings, stickers, or collage.", "Add ribbon or tassel.", "Laminate for durability."],
    variations: ["Corner bookmarks", "Photo bookmarks", "Gift sets"]
  },
  {
    id: "FIN_0015",
    title: "Mindful Coloring Pages",
    summary: "Color intricate patterns for calm focus.",
    tags: ["QUIET_TIME", "INDOOR", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Print or buy mandala coloring pages.", "Choose colored pencils.", "Color slowly and mindfully.", "Display or gift when done."],
    variations: ["Play calming music", "Gel pens", "Group coloring session"]
  },
  {
    id: "FIN_0016",
    title: "Water Balloon Piñata",
    summary: "Hang water balloons and hit to burst.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M2", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Fill balloons with water.", "Hang from tree branch or line.", "Take turns hitting with stick.", "Get splashed when they pop!"],
    variations: ["Blindfolded", "Team competition", "Multiple balloons"]
  },
  {
    id: "FIN_0017",
    title: "Spelling Word Art",
    summary: "Turn spelling words into creative art.",
    tags: ["HOMEWORK", "CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write spelling words in bubble letters.", "Turn letters into pictures matching word meaning.", "Color creatively.", "Study art to remember spellings."],
    variations: ["Graffiti style", "Hidden word pictures", "Word collages"]
  },
  {
    id: "FIN_0018",
    title: "Egg Carton Creations",
    summary: "Transform egg cartons into art and crafts.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut egg carton cups.", "Paint and decorate.", "Transform into flowers, animals, or creatures.", "Display or use as decorations."],
    variations: ["Caterpillar", "Flower bouquet", "Treasure holders"]
  },
  {
    id: "FIN_0019",
    title: "Human Knot Untangling",
    summary: "Untangle from a circle holding hands.",
    tags: ["KEEP_BUSY", "INDOOR", "PLAYDATE", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Stand in circle.", "Reach across and hold different hands.", "Without letting go, untangle back to circle.", "Step over, under, and around each other."],
    variations: ["Time challenge", "Larger groups", "Silent version"]
  },
  {
    id: "FIN_0020",
    title: "Pipe Cleaner Figures",
    summary: "Twist pipe cleaners into people and animals.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get assorted pipe cleaners.", "Twist into body shapes.", "Add arms, legs, features.", "Create a whole family or zoo."],
    variations: ["Ring making", "Hair accessories", "Christmas decorations"]
  },
  {
    id: "FIN_0021",
    title: "Story Stones Making",
    summary: "Paint images on stones for storytelling prompts.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect smooth stones.", "Paint simple images: sun, tree, house, character.", "Let dry.", "Draw stones to inspire stories."],
    variations: ["Emotion stones", "Math fact stones", "Matching game stones"]
  },
  {
    id: "FIN_0022",
    title: "Ice Cream Sundae Bar",
    summary: "Set up sundae station with various toppings.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set out ice cream.", "Arrange toppings: sauce, sprinkles, fruit, sweets.", "Each person creates their sundae.", "Enjoy together!"],
    variations: ["Banana split", "Healthy frozen yogurt", "Milkshakes"]
  },
  {
    id: "FIN_0023",
    title: "Spoon Race",
    summary: "Race while balancing object on spoon.",
    tags: ["KEEP_BUSY", "OUTDOOR", "PLAYDATE", "NS", "P1", "M0", "T15", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Balance egg or ball on spoon.", "Race to finish line.", "If it falls, return to start.", "First across wins!"],
    variations: ["Relay version", "Obstacle course", "Mouth holding spoon"]
  },
  {
    id: "FIN_0024",
    title: "Playdough Alphabet",
    summary: "Form letters from playdough for learning.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Roll playdough into snakes.", "Form into letter shapes.", "Practice letter names and sounds.", "Spell simple words."],
    variations: ["Numbers", "Sight words", "Name practice"]
  },
  {
    id: "FIN_0025",
    title: "Nature Crown Making",
    summary: "Create a crown decorated with natural finds.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut card into crown shape.", "Collect leaves, flowers, feathers.", "Glue natural items to crown.", "Wear your nature crown!"],
    variations: ["Autumn leaves", "Spring flowers", "Forest fairy crown"]
  },
  {
    id: "FIN_0026",
    title: "Sponge Water Fight",
    summary: "Throw wet sponges at each other on hot days.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M2", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Get several sponges.", "Fill bucket with water.", "Soak sponges and throw!", "Run and dodge."],
    variations: ["Team capture flag", "Sponge tag", "Target throwing"]
  },
  {
    id: "FIN_0027",
    title: "Newspaper Fashion",
    summary: "Create fashion outfits from newspaper.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Gather old newspapers.", "Design and create outfit.", "Use tape to construct.", "Model on the runway!"],
    variations: ["Theme costumes", "Competition judging", "Magazine additions"]
  },
  {
    id: "FIN_0028",
    title: "Shape Hunt",
    summary: "Find and photograph shapes around the house.",
    tags: ["HOMEWORK", "INDOOR", "OUTDOOR", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get list of shapes to find.", "Walk around looking for each shape.", "Take photo or draw it.", "Make a shape book."],
    variations: ["Color hunt", "Letter hunt", "Number hunt"]
  },
  {
    id: "FIN_0029",
    title: "Freeze Dance Party",
    summary: "Dance until music stops, then freeze in position.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Play upbeat music.", "Dance around the room.", "When music stops, freeze!", "Anyone who moves is out."],
    variations: ["Silly poses required", "Themed dancing", "Partner freeze"]
  },
  {
    id: "FIN_0030",
    title: "Rainy Day Bird Watch",
    summary: "Watch birds from window during rain.",
    tags: ["RAINY_DAY", "QUIET_TIME", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up bird feeder visible from window.", "Get bird identification book or app.", "Watch quietly and identify visitors.", "Keep a log of species seen."],
    variations: ["Draw birds seen", "Count visitors", "Research favorite species"]
  },
  {
    id: "FIN_0031",
    title: "Cotton Ball Hockey",
    summary: "Blow cotton balls across table as puck.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Use cotton ball as puck.", "Mark goals on each end of table.", "Blow cotton ball with straws.", "Score goals!"],
    variations: ["Use pompoms", "Team play", "Obstacle course"]
  },
  {
    id: "FIN_0032",
    title: "Mood Music Listening",
    summary: "Listen to different music and discuss the moods created.",
    tags: ["QUIET_TIME", "BIG_FEELINGS", "SL", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Play different music styles.", "Discuss how each makes you feel.", "Happy, sad, excited, calm.", "Draw pictures to match music."],
    variations: ["Movement to music", "Create playlist for moods", "Classical appreciation"]
  },
  {
    id: "FIN_0033",
    title: "Tin Can Stilts",
    summary: "Walk on tin can stilts with string handles.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P2", "M0", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "medium" },
    steps: ["Get two large tin cans.", "Punch holes and thread rope through.", "Stand on cans, hold ropes.", "Walk lifting alternating feet."],
    variations: ["Decorate cans", "Race", "Obstacle course"]
  },
  {
    id: "FIN_0034",
    title: "Memory Box Creation",
    summary: "Decorate a box to store special memories.",
    tags: ["CRAFT", "QUIET_TIME", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find or make a sturdy box.", "Decorate outside with paint, stickers, photos.", "Collect meaningful small items to put inside.", "Add to it over time."],
    variations: ["Holiday memory box", "School year box", "Friendship keepsake"]
  },
  {
    id: "FIN_0035",
    title: "ABC Yoga",
    summary: "Do yoga poses for each letter of alphabet.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["A is for airplane pose, B is for butterfly...", "Work through alphabet.", "Hold each pose for 5 breaths.", "Make up poses for tricky letters."],
    variations: ["Animal yoga ABC", "Partner poses", "Create pose cards"]
  },
  {
    id: "FIN_0036",
    title: "What's Missing Game",
    summary: "Remember items then guess which was removed.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Place 10 items on tray.", "Look for 30 seconds.", "Cover eyes while one is removed.", "Guess which is missing."],
    variations: ["More items for challenge", "Remove multiple", "Rearrange instead"]
  },
  {
    id: "FIN_0037",
    title: "Cardboard Box Robot",
    summary: "Build a wearable robot costume from boxes.",
    tags: ["CRAFT", "INDOOR", "NS", "P2", "M2", "T60", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Get large box for body, small for head.", "Cut arm and head holes.", "Paint silver or decorate.", "Add buttons, dials, lights."],
    variations: ["Tin foil covering", "LED light additions", "Sound effects"]
  },
  {
    id: "FIN_0038",
    title: "Blindfold Taste Test",
    summary: "Guess foods while blindfolded.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Prepare variety of foods.", "Blindfold taster.", "Give small bites to try.", "Guess each food."],
    variations: ["Same food different brands", "Texture focus", "Smell test"]
  },
  {
    id: "FIN_0039",
    title: "Outdoor Obstacle Course",
    summary: "Set up and complete garden obstacle course.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T45", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Set up stations: jump over, crawl under, balance on.", "Practice the course.", "Time each attempt.", "Beat your best time."],
    variations: ["Weekly new course", "Team relay", "Ninja warrior style"]
  },
  {
    id: "FIN_0040",
    title: "Glitter Jar Making",
    summary: "Create calming glitter jars for mindfulness.",
    tags: ["CRAFT", "BIG_FEELINGS", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill jar 3/4 with water.", "Add glitter glue and extra glitter.", "Add drop of food coloring.", "Seal tightly and shake to calm."],
    variations: ["Glow in dark glitter", "Galaxy themed", "Multiple for different moods"]
  },
  {
    id: "FIN_0041",
    title: "Peg People Painting",
    summary: "Paint wooden clothes pegs as character figures.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get wooden clothes pegs.", "Paint faces and clothes.", "Add yarn for hair.", "Create a whole family or cast."],
    variations: ["Historical figures", "Story characters", "Nativity set"]
  },
  {
    id: "FIN_0042",
    title: "Bubble Art",
    summary: "Create art by blowing colored bubbles onto paper.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M2", "T20", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix bubble solution with food coloring or paint.", "Blow bubbles onto paper.", "Let them pop and leave patterns.", "Layer different colors."],
    variations: ["Giant bubbles", "Catching bubbles on paper", "Frame the art"]
  },
  {
    id: "FIN_0043",
    title: "Indoor Garden Planting",
    summary: "Grow plants indoors in pots on windowsill.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Get small pots and compost.", "Plant herb seeds or small plants.", "Place on sunny windowsill.", "Water and watch grow."],
    variations: ["Herb garden", "Succulents", "Avocado from pit"]
  },
  {
    id: "FIN_0044",
    title: "Sock Skating",
    summary: "Slide across smooth floors in socks.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Put on fuzzy socks.", "Find smooth hard floor.", "Run and slide!", "Try spins and tricks."],
    variations: ["Skating routine", "Longest slide contest", "Partner skating"]
  },
  {
    id: "FIN_0045",
    title: "Family Portrait Drawing",
    summary: "Draw portraits of family members.",
    tags: ["CRAFT", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Sit family member in front of you.", "Draw their portrait.", "Add details like clothes and accessories.", "Display or gift the portrait."],
    variations: ["Pet portraits", "Self-portrait", "Silly exaggerated portraits"]
  },
  {
    id: "FIN_0046",
    title: "Homemade Pizza",
    summary: "Make pizza from scratch with chosen toppings.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P2", "M1", "T60", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Make or buy pizza dough.", "Roll out and add sauce.", "Add cheese and toppings of choice.", "Bake until golden."],
    variations: ["Mini pizzas", "Dessert pizza", "Pizza faces"]
  },
  {
    id: "FIN_0047",
    title: "Card Tower Building",
    summary: "Build structures using playing cards.",
    tags: ["BUILDING", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get deck of cards.", "Lean two cards together.", "Build up layer by layer.", "See how tall you can go."],
    variations: ["Time challenge", "Multiple decks", "Bridge designs"]
  },
  {
    id: "FIN_0048",
    title: "LEGO Challenge Cards",
    summary: "Draw challenge cards and build that LEGO creation.",
    tags: ["BUILDING", "LEGO", "INDOOR", "NS", "P1", "M0", "T45", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make challenge cards with build ideas.", "Draw a card.", "Build that creation in 10 minutes.", "Share and vote for favorite."],
    variations: ["Theme rounds", "Mystery brick box", "Team builds"]
  },
  {
    id: "FIN_0049",
    title: "Nature Bracelet",
    summary: "Wrap tape around wrist sticky side out, stick on nature finds.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M0", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Wrap wide tape loosely around wrist, sticky side out.", "Walk and find small nature items.", "Press leaves, petals, seeds onto tape.", "Remove to keep or wear as bracelet."],
    variations: ["Nature headband", "Texture bracelet", "Color hunt bracelet"]
  },
  {
    id: "FIN_0050",
    title: "Feelings Faces Drawing",
    summary: "Draw faces showing different emotions.",
    tags: ["BIG_FEELINGS", "CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Draw circle for face.", "Add features showing emotion: happy, sad, angry, scared.", "Discuss when you feel each way.", "Create feelings chart."],
    variations: ["Paper plate faces", "Emotion wheel", "Mirror face copying"]
  },
  {
    id: "FIN_0051",
    title: "Cloud Dough Play",
    summary: "Mix flour and oil for moldable sensory dough.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix 8 cups flour with 1 cup baby oil.", "Knead until silky.", "Mold, cut shapes, build.", "Crumbles but molds when squeezed."],
    variations: ["Add scent", "Color with chalk", "Hide treasures inside"]
  },
  {
    id: "FIN_0052",
    title: "Paper Snowflakes",
    summary: "Fold and cut paper to make snowflake patterns.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fold paper into triangles.", "Cut shapes into folded edges.", "Unfold carefully.", "Display in window."],
    variations: ["Glitter edges", "Coffee filter snowflakes", "Snowflake garland"]
  },
  {
    id: "FIN_0053",
    title: "DIY Binoculars",
    summary: "Make binoculars from toilet rolls for nature watching.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Tape two toilet rolls together.", "Punch holes and add string strap.", "Decorate with paint or stickers.", "Go on nature spotting expedition."],
    variations: ["Camouflage style", "Add colored cellophane", "Bird watching trip"]
  },
  {
    id: "FIN_0054",
    title: "Sensory Walk",
    summary: "Walk barefoot on different textures.",
    tags: ["KEEP_BUSY", "OUTDOOR", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up trays with: sand, rice, grass, water, pebbles.", "Walk barefoot across each.", "Describe how each feels.", "Which is favorite?"],
    variations: ["Blindfolded guessing", "Outdoor natural surfaces", "Temperature variations"]
  },
  {
    id: "FIN_0055",
    title: "Count and Sort Snacks",
    summary: "Practice math while sorting snack items.",
    tags: ["HOMEWORK", "MEALS_SIMPLE", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get small snacks: grapes, crackers, raisins.", "Sort by type.", "Count each group.", "Compare which has more/less."],
    variations: ["Addition practice", "Equal sharing", "Graphing results"]
  },
  {
    id: "FIN_0056",
    title: "Paper Chain Countdown",
    summary: "Remove a chain link daily counting down to event.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make paper chain with one link per day.", "Write activity on each link.", "Remove one each day.", "Do the activity written on it."],
    variations: ["Holiday countdown", "Birthday countdown", "Summer holiday countdown"]
  },
  {
    id: "FIN_0057",
    title: "Fruit Kebabs",
    summary: "Thread fruit pieces onto skewers for healthy snack.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Cut various fruits into chunks.", "Thread onto wooden skewers.", "Create colorful patterns.", "Serve with yogurt dip."],
    variations: ["Rainbow order", "Frozen for summer", "Chocolate drizzle"]
  },
  {
    id: "FIN_0058",
    title: "Animal Yoga Story",
    summary: "Follow a story doing yoga poses for each animal.",
    tags: ["KEEP_BUSY", "QUIET_TIME", "INDOOR", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Tell a story featuring animals.", "When animal appears, do its yoga pose.", "Hold pose for 5 breaths.", "Continue story."],
    variations: ["Jungle adventure", "Ocean story", "Farm animals"]
  },
  {
    id: "FIN_0059",
    title: "Thankful Jar",
    summary: "Write thankful notes and collect in jar to read later.",
    tags: ["BIG_FEELINGS", "QUIET_TIME", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Decorate a jar.", "Write thankful notes on paper strips.", "Add to jar daily or weekly.", "Read together on special occasions."],
    variations: ["Gratitude tree version", "Monthly readings", "Family dinner tradition"]
  },
  {
    id: "FIN_0060",
    title: "Treasure Box Decorating",
    summary: "Decorate a box to hold special treasures.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get sturdy box with lid.", "Paint and decorate outside.", "Line inside with fabric or paper.", "Store special items."],
    variations: ["Jewelry box", "Secret box", "Memory keeper"]
  },
  {
    id: "FIN_0061",
    title: "Mirror Emotion Game",
    summary: "Mirror each other's facial expressions.",
    tags: ["BIG_FEELINGS", "KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T10", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Face a partner.", "One makes expression, other mirrors it.", "Try to stay serious.", "Switch who leads."],
    variations: ["Add body movements", "Emotion guessing", "Speed mirroring"]
  },
  {
    id: "FIN_0062",
    title: "Story Starter Cards",
    summary: "Draw cards with story prompts to inspire writing.",
    tags: ["HOMEWORK", "CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make cards with characters, settings, problems.", "Draw one from each pile.", "Write story using all three elements.", "Share your story."],
    variations: ["Comic strip version", "Oral storytelling", "Group story building"]
  },
  {
    id: "FIN_0063",
    title: "Paper Fan Making",
    summary: "Fold paper into decorative fans.",
    tags: ["CRAFT", "INDOOR", "NS", "P0", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Decorate paper before folding.", "Fold accordion style.", "Pinch and tape one end.", "Spread open as fan."],
    variations: ["Painted designs", "Tissue paper fans", "Giant fans"]
  }
];
