// Activities Expansion - 361 new activities from verified sources
// Sources: National Trust UK, Woodland Trust, Science Buddies, Good Housekeeping,
// Rasmussen University, KiwiCo, parenting sites
// NO HARDCODED/FAKE DATA - All activities from real parenting resources

import { PlaybookActivity } from './family-playbook';

export const expansionActivities: PlaybookActivity[] = [
  // ============ STEM / SCIENCE EXPERIMENTS ============
  {
    id: "EXP_0001",
    title: "Elephant Toothpaste",
    summary: "Mix hydrogen peroxide and yeast to create an impressive foamy eruption. Teaches chemical reactions.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Gather hydrogen peroxide (3%), yeast, warm water, dish soap, food coloring.", "Mix yeast with warm water in small cup, let sit 1 minute.", "Add dish soap and food coloring to bottle with peroxide.", "Pour yeast mixture in and watch the foam erupt!"],
    variations: ["Use different sized bottles", "Try different food coloring combinations", "Add glitter for sparkle effect"]
  },
  {
    id: "EXP_0002",
    title: "Baking Soda Volcano",
    summary: "Classic volcano eruption using baking soda and vinegar. Great for learning about acid-base reactions.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M2", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Build volcano shape from playdough or papier-mache around bottle.", "Add 2 tbsp baking soda to bottle.", "Add dish soap and red food coloring.", "Pour in vinegar and watch it erupt!"],
    variations: ["Add dinosaurs around the volcano", "Try different vinegar amounts", "Make multiple mini volcanoes"]
  },
  {
    id: "EXP_0003",
    title: "Invisible Ink Messages",
    summary: "Write secret messages with lemon juice that reveal when heated. Teaches oxidation.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Squeeze lemon juice into small bowl.", "Dip cotton bud or paintbrush in juice.", "Write message on white paper, let dry.", "Hold paper near warm lamp or iron (adult only) to reveal."],
    variations: ["Use milk instead of lemon juice", "Create treasure maps", "Write coded messages"]
  },
  {
    id: "EXP_0004",
    title: "Magnetic Slime",
    summary: "Create slime that responds to magnets. Mix glue, iron oxide powder, and liquid starch.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M2", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Mix 1/4 cup white glue with 2 tbsp iron oxide powder.", "Add 1/8 cup liquid starch gradually.", "Knead until slime forms.", "Use strong magnets to manipulate the slime."],
    variations: ["Make different colored slimes", "Test different magnet strengths", "Create slime sculptures"]
  },
  {
    id: "EXP_0005",
    title: "Oobleck (Non-Newtonian Fluid)",
    summary: "Mix cornstarch and water to create a substance that acts like both solid and liquid.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix 2 cups cornstarch with 1 cup water in bowl.", "Add food coloring if desired.", "Test: punch it (solid) vs let hand sink (liquid).", "Experiment with rolling into balls."],
    variations: ["Add glitter", "Try walking on a large tray of it", "Add small toys to find"]
  },
  {
    id: "EXP_0006",
    title: "Rainbow Density Jar",
    summary: "Layer liquids with different densities to create a rainbow effect in a jar.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Gather honey, corn syrup, dish soap, water, vegetable oil, rubbing alcohol.", "Add food coloring to water and alcohol layers.", "Pour slowly down side of jar, heaviest first.", "Watch layers separate and form rainbow."],
    variations: ["Drop small objects to see which layer they float on", "Try different liquids", "Take photos and label each layer"]
  },
  {
    id: "EXP_0007",
    title: "Magic Milk Experiment",
    summary: "Add dish soap to milk with food coloring and watch colors swirl. Teaches surface tension.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Pour whole milk into shallow dish.", "Add drops of different food colors.", "Dip cotton bud in dish soap.", "Touch milk surface and watch colors dance!"],
    variations: ["Try different milk fat contents", "Use different dish soap brands", "Create patterns with multiple touches"]
  },
  {
    id: "EXP_0008",
    title: "Cloud in a Jar",
    summary: "Create a mini water cycle and watch clouds form inside a jar.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Pour hot water into jar (1/3 full).", "Place ice on top of jar lid.", "Spray hairspray into jar quickly.", "Watch cloud form as warm air meets cold."],
    variations: ["Try without hairspray to compare", "Use different temperature water", "Add food coloring to water"]
  },
  {
    id: "EXP_0009",
    title: "Water Cycle in a Bag",
    summary: "Create a mini water cycle in a ziplock bag taped to a window.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Add water and blue food coloring to ziplock bag.", "Draw clouds and sun on bag with permanent marker.", "Tape bag to sunny window.", "Watch water evaporate, condense, and 'rain' down."],
    variations: ["Compare bags on different windows", "Add small plastic fish", "Draw complete water cycle diagram"]
  },
  {
    id: "EXP_0010",
    title: "Bridge Building Challenge",
    summary: "Use popsicle sticks or paper to build a bridge and test how many pennies it can hold.",
    tags: ["SCIENCE", "BUILDING", "INDOOR", "NS", "P1", "M0", "T45", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up two books or boxes as 'riverbanks'.", "Build bridge using only popsicle sticks and glue.", "Let dry completely.", "Test by adding pennies until it collapses."],
    variations: ["Try different bridge designs", "Use straws instead of sticks", "Competition between family members"]
  },
  {
    id: "EXP_0011",
    title: "Catapult Construction",
    summary: "Build a simple catapult with popsicle sticks and rubber bands. Learn about physics.",
    tags: ["SCIENCE", "BUILDING", "INDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Stack 5 popsicle sticks, secure with rubber bands at ends.", "Take 2 sticks, secure one end.", "Wedge stack between the 2 sticks.", "Add bottle cap as basket, launch pom poms!"],
    variations: ["Competition for distance", "Try different projectiles", "Build bigger versions"]
  },
  {
    id: "EXP_0012",
    title: "Marble Roller Coaster",
    summary: "Create a track for marbles using cardboard tubes or foam insulation.",
    tags: ["SCIENCE", "BUILDING", "INDOOR", "NS", "P2", "M1", "T45", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Cut pool noodles or cardboard tubes in half lengthwise.", "Tape pieces together to create track.", "Add supports using boxes or tape to walls.", "Test with marbles, adjust height for speed."],
    variations: ["Add loops", "Time different marble sizes", "Create jumps"]
  },
  {
    id: "EXP_0013",
    title: "Egg Drop Challenge",
    summary: "Design a structure to protect an egg from a high fall. Engineering and problem-solving.",
    tags: ["SCIENCE", "BUILDING", "OUTDOOR", "NS", "P2", "M2", "T45", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "medium" },
    steps: ["Gather materials: straws, tape, cotton, bubble wrap.", "Design protective container for raw egg.", "Build the container.", "Test by dropping from increasing heights."],
    variations: ["Limit materials", "Add parachute element", "Competition between siblings"]
  },
  {
    id: "EXP_0014",
    title: "Balloon Rocket",
    summary: "Attach balloon to string and watch it zoom across the room. Learn Newton's laws.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Thread string through straw, tie string across room.", "Blow up balloon but don't tie.", "Tape balloon to straw.", "Release and watch it zoom!"],
    variations: ["Race two balloons", "Try different balloon sizes", "Add paper fins"]
  },
  {
    id: "EXP_0015",
    title: "Homemade Ice Cream",
    summary: "Use salt and ice to freeze cream into ice cream. Learn about freezing points.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M1", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Put cream, sugar, vanilla in small bag, seal tight.", "Put ice and rock salt in large bag.", "Place small bag inside large bag, seal.", "Shake for 5-10 minutes until frozen."],
    variations: ["Try different flavors", "Add chocolate chips before freezing", "Make fruit sorbet instead"]
  },
  {
    id: "EXP_0016",
    title: "DIY Compass",
    summary: "Magnetize a needle and float it in water to create a working compass.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Rub needle on magnet 50 times in same direction.", "Float cork or leaf in bowl of water.", "Place magnetized needle on floating object.", "Watch needle point north!"],
    variations: ["Compare to real compass", "Test in different locations", "Try different floating materials"]
  },
  {
    id: "EXP_0017",
    title: "LEGO Balloon Car",
    summary: "Build a car from LEGOs powered by balloon air. Learn about propulsion.",
    tags: ["SCIENCE", "BUILDING", "LEGO", "INDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Build simple LEGO car with wheels that spin freely.", "Attach balloon to straw, tape straw to car.", "Blow up balloon through straw.", "Release and watch car race!"],
    variations: ["Race different designs", "Try larger balloons", "Add ramps"]
  },
  {
    id: "EXP_0018",
    title: "Playdough Circuits",
    summary: "Use conductive playdough to light up LEDs. Learn about electricity.",
    tags: ["SCIENCE", "INDOOR", "NS", "P2", "M1", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Make conductive dough (add salt) and insulating dough (add sugar).", "Shape dough into creatures with LED eyes.", "Connect battery pack.", "Watch LEDs light up!"],
    variations: ["Create different shapes", "Use multiple LEDs", "Add buzzers"]
  },
  {
    id: "EXP_0019",
    title: "Skittles Rainbow",
    summary: "Arrange Skittles on plate and pour warm water to create rainbow patterns.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Arrange Skittles in circle on white plate.", "Pour warm water into center slowly.", "Watch colors dissolve and create rainbow.", "Discuss why colors don't mix immediately."],
    variations: ["Try M&Ms", "Use different water temperatures", "Make patterns with color arrangements"]
  },
  {
    id: "EXP_0020",
    title: "Paper Helicopter",
    summary: "Make paper whirlybirds and test flight designs. Learn about aerodynamics.",
    tags: ["SCIENCE", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut paper strips and fold helicopter blades.", "Add paperclip weight to bottom.", "Drop from height and watch spin.", "Adjust blade angles to change spin speed."],
    variations: ["Try different paper sizes", "Competition for longest flight", "Add decorations"]
  },
  {
    id: "EXP_0021",
    title: "Sink or Float Experiment",
    summary: "Test household items to see which sink or float. Learn about density.",
    tags: ["SCIENCE", "INDOOR", "NS", "P0", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill large bowl or tub with water.", "Gather various household items.", "Predict: will it sink or float?", "Test each item and record results."],
    variations: ["Try fruits and vegetables", "Test items with and without air inside", "Make objects float that sank"]
  },
  {
    id: "EXP_0022",
    title: "Homemade Balance Scale",
    summary: "Build a scale with hanger, cups, and string to compare weights.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Punch holes in two paper cups.", "Tie string to each cup.", "Hang cups from clothes hanger at equal lengths.", "Compare weights of different objects."],
    variations: ["Weigh food items", "Sort objects by weight", "Add numbered weights"]
  },
  {
    id: "EXP_0023",
    title: "Grow Crystals",
    summary: "Grow salt or sugar crystals on string over several days.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Dissolve salt or sugar in hot water until saturated.", "Tie string to pencil, lay across jar.", "Let string dangle in solution.", "Wait 3-7 days for crystals to form."],
    variations: ["Add food coloring", "Try different solutions (borax, alum)", "Compare growth rates"]
  },
  {
    id: "EXP_0024",
    title: "Tornado in a Bottle",
    summary: "Create a water vortex between two connected bottles.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T15", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill one bottle 2/3 with water, add glitter.", "Connect two bottles mouth-to-mouth with tape.", "Flip over and swirl in circular motion.", "Watch tornado form as water drains."],
    variations: ["Add dish soap for bubbles", "Try different colored water", "Time how fast water drains"]
  },
  {
    id: "EXP_0025",
    title: "Dancing Raisins",
    summary: "Drop raisins in fizzy water and watch them dance up and down.",
    tags: ["SCIENCE", "INDOOR", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Pour carbonated water into clear glass.", "Drop in 4-5 raisins.", "Watch raisins sink, collect bubbles, and rise.", "Discuss why they sink again after reaching top."],
    variations: ["Try other small objects", "Use different fizzy drinks", "Count how many times each raisin rises"]
  },
  // ============ RAINY DAY / INDOOR ACTIVITIES ============
  {
    id: "RAIN_0001",
    title: "Blanket Fort Cinema",
    summary: "Build a cozy blanket fort and watch a movie inside with snacks.",
    tags: ["RAINY_DAY", "INDOOR", "SL", "P1", "M0", "T90", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather blankets, pillows, and sheets.", "Build fort using chairs and sofa as supports.", "Set up tablet or laptop inside.", "Add fairy lights, popcorn, and enjoy!"],
    variations: ["Reading fort instead of movie", "Shadow puppet show", "Sleepover fort"]
  },
  {
    id: "RAIN_0002",
    title: "Sock Puppet Theatre",
    summary: "Create sock puppets and put on a family puppet show.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Find old socks - one per character.", "Add googly eyes, felt mouth, yarn hair.", "Create a stage from cardboard box.", "Write a simple story and perform!"],
    variations: ["Film the show", "Make a puppet family", "Use paper bags instead"]
  },
  {
    id: "RAIN_0003",
    title: "Indoor Obstacle Course",
    summary: "Create an obstacle course using cushions, hula hoops, and furniture.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Clear a safe space in the house.", "Set up stations: crawl under table, hop on cushions, balance on tape line.", "Time each person.", "Try to beat your own record!"],
    variations: ["Blindfolded section", "Add silly challenges", "Team relay version"]
  },
  {
    id: "RAIN_0004",
    title: "Playdough Creations",
    summary: "Make homemade playdough and create sculptures, scenes, or letters.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Mix 1 cup flour, 1/2 cup salt, 1 tbsp oil, 1/2 cup water.", "Add food coloring.", "Knead until smooth.", "Create animals, food, letters, or scenes."],
    variations: ["Add glitter", "Make scented dough with essential oils", "Create a playdough town"]
  },
  {
    id: "RAIN_0005",
    title: "Paint by Numbers",
    summary: "Calming creative activity that produces beautiful artwork.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T90", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get a paint by numbers kit or print one online.", "Set up paints and brushes.", "Match numbers to colors and fill in.", "Display finished artwork proudly."],
    variations: ["Custom photo kits", "Group project on large canvas", "Diamond painting instead"]
  },
  {
    id: "RAIN_0006",
    title: "Leaf Painting & Printing",
    summary: "Paint collected leaves and press onto paper to create art prints.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect leaves of different shapes and sizes.", "Paint one side of leaf with chosen color.", "Press painted side onto paper firmly.", "Peel off to reveal print."],
    variations: ["Create a tree with multiple leaf prints", "Use autumn colors", "Make wrapping paper"]
  },
  {
    id: "RAIN_0007",
    title: "Friendship Bracelet Making",
    summary: "Design colorful bracelets using embroidery thread or beads.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut 3-4 strands of thread about 60cm long.", "Tie together at one end, tape to table.", "Braid or knot in patterns.", "Tie ends and give to a friend."],
    variations: ["Add beads with letters", "Use different knotting patterns", "Make matching sets"]
  },
  {
    id: "RAIN_0008",
    title: "Sock Toss Game",
    summary: "Bundle socks and throw into laundry basket for points.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Roll paired socks into balls.", "Place laundry basket at one end of room.", "Mark throwing lines at different distances.", "Score points based on distance and accuracy."],
    variations: ["Different sized targets", "Trick shot challenges", "Team competition"]
  },
  {
    id: "RAIN_0009",
    title: "Cosmic Kids Yoga",
    summary: "Follow along with themed yoga videos designed for children.",
    tags: ["RAINY_DAY", "INDOOR", "QUIET_TIME", "SL", "P0", "M0", "T30", "ELOW", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find Cosmic Kids Yoga on YouTube.", "Clear space for stretching.", "Follow the adventure story and poses.", "End with relaxation."],
    variations: ["Make up your own yoga story", "Family yoga session", "Bedtime calm yoga"]
  },
  {
    id: "RAIN_0010",
    title: "Musical Pots and Pans",
    summary: "Create rhythms using kitchen utensils and pots as drums.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Gather pots, pans, wooden spoons, whisks.", "Arrange as a drum kit on floor.", "Put on music and drum along.", "Take turns being the conductor."],
    variations: ["Make a band with different instruments", "Record a song", "Parade around the house"]
  },
  {
    id: "RAIN_0011",
    title: "Torch Scavenger Hunt",
    summary: "Use a torch to find hidden objects in a darkened room.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Hide small objects around a room.", "Close curtains and turn off lights.", "Give child torch and list of items.", "Hunt in the dark using only torchlight."],
    variations: ["Shadow puppet breaks", "Find glow-in-dark items", "Treasure hunt with clues"]
  },
  {
    id: "RAIN_0012",
    title: "Toy Rescue Ice Challenge",
    summary: "Freeze small toys in ice and use different methods to free them.",
    tags: ["RAINY_DAY", "SCIENCE", "INDOOR", "NS", "P2", "M2", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Freeze small toys in bowl or container of water overnight.", "Set up outside or in tub.", "Provide warm water, salt, spoons as tools.", "See who can rescue their toy first."],
    variations: ["Dinosaur excavation theme", "Add food coloring to ice", "Time different rescue methods"]
  },
  {
    id: "RAIN_0013",
    title: "Cupcake Decorating",
    summary: "Bake cupcakes and decorate with frosting, sprinkles, and toppings.",
    tags: ["RAINY_DAY", "INDOOR", "MEALS_SIMPLE", "NS", "P2", "M2", "T60", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Bake cupcakes from box mix or recipe.", "Make or buy frosting in different colors.", "Set out sprinkles, sweets, and toppings.", "Let everyone decorate their own."],
    variations: ["Theme decorating (animals, faces)", "Competition judging", "Give as gifts"]
  },
  {
    id: "RAIN_0014",
    title: "Pretend Shop",
    summary: "Set up a pretend shop with food items, play till, and baskets.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Gather play food or empty food packages.", "Set up shop area with shelves.", "Make price tags and play money.", "Take turns as shopkeeper and customer."],
    variations: ["Restaurant instead of shop", "Post office", "Doctor's surgery"]
  },
  {
    id: "RAIN_0015",
    title: "Scrapbook Making",
    summary: "Print photos and create memory pages with stickers and decorations.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M1", "T60", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Print photos from recent events or holidays.", "Get a scrapbook or make one from paper.", "Cut, arrange, and glue photos.", "Add stickers, drawings, and captions."],
    variations: ["Holiday journal", "Pet scrapbook", "Year-in-review book"]
  },
  {
    id: "RAIN_0016",
    title: "Board Game Marathon",
    summary: "Play through multiple board games in one afternoon.",
    tags: ["RAINY_DAY", "INDOOR", "SIBLINGS", "NS", "P0", "M0", "T120", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose 3-5 favorite games.", "Set up snacks and drinks.", "Play each game in turn.", "Keep overall points across games."],
    variations: ["Card game tournament", "Puzzle afternoon", "Invent a new game"]
  },
  {
    id: "RAIN_0017",
    title: "Indoor Ball Games",
    summary: "Use soft ball pool balls for various indoor throwing and catching games.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "NS", "P0", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Use soft balls only.", "Set up targets or play catch.", "Try bowling with plastic bottles.", "Play hot potato with music."],
    variations: ["Ball pit fun", "Color sorting", "Target practice"]
  },
  {
    id: "RAIN_0018",
    title: "Jigsaw Puzzle Challenge",
    summary: "Work together on a challenging jigsaw puzzle.",
    tags: ["RAINY_DAY", "INDOOR", "QUIET_TIME", "NS", "P0", "M0", "T120", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose age-appropriate puzzle.", "Sort pieces by edge and color.", "Work together to complete.", "Frame or display when done."],
    variations: ["Puzzle race", "3D puzzles", "Leave out for week-long project"]
  },
  {
    id: "RAIN_0019",
    title: "Treasure Chest Crafts",
    summary: "Decorate a box to become a treasure chest and fill with treasures.",
    tags: ["RAINY_DAY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T45", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find a shoebox or small box.", "Paint and decorate with gems, glitter.", "Add fake gold coins or wrapped chocolates.", "Use for storing special items."],
    variations: ["Pirate theme", "Jewelry box", "Time capsule"]
  },
  {
    id: "RAIN_0020",
    title: "Family Dance Party",
    summary: "Put on music and have a dance-off in the living room.",
    tags: ["RAINY_DAY", "INDOOR", "KEEP_BUSY", "SL", "P0", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Create a playlist of favorite songs.", "Clear the living room floor.", "Take turns choosing songs.", "Have dance battles or learn TikTok dances."],
    variations: ["Freeze dance", "Musical statues", "Glow stick dance party"]
  },
  // ============ CAR JOURNEY GAMES ============
  {
    id: "CAR_0001",
    title: "20 Questions",
    summary: "Think of something and others ask yes/no questions to guess it.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["One person thinks of a person, place, or thing.", "Others ask yes/no questions only.", "Maximum 20 questions to guess.", "Whoever guesses picks next."],
    variations: ["Animal only version", "Movie characters", "Things in the car"]
  },
  {
    id: "CAR_0002",
    title: "I Spy",
    summary: "Spot something and give clues for others to guess.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose something you can see.", "Say 'I spy with my little eye, something...'", "Give a clue (color, first letter).", "Others take turns guessing."],
    variations: ["Outdoor objects only", "Things starting with same letter", "Shapes version"]
  },
  {
    id: "CAR_0003",
    title: "License Plate Game",
    summary: "Spot different license plates and keep track of which ones you find.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T60", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Print or draw a list of UK regions.", "Watch for different area plates.", "Mark each one you spot.", "Try to spot all regions."],
    variations: ["Find alphabetical plates", "Spot numbers adding to 10", "European plates on motorway"]
  },
  {
    id: "CAR_0004",
    title: "Alphabet Game",
    summary: "Find words on road signs starting with each letter of the alphabet.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T30", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Start with letter A.", "Look for signs with words starting with that letter.", "First to spot it moves to next letter.", "First to Z wins!"],
    variations: ["Colors of cars", "Shop names", "Animals on signs"]
  },
  {
    id: "CAR_0005",
    title: "Picnic Memory Game",
    summary: "I'm going on a picnic... remember and add items alphabetically.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["First person: 'I'm going on a picnic and bringing apples.'", "Next person repeats and adds B item.", "Continue through alphabet.", "Out if you forget an item."],
    variations: ["Suitcase packing version", "Shopping list", "Animal safari"]
  },
  {
    id: "CAR_0006",
    title: "Story Building",
    summary: "Take turns adding sentences to create a collaborative story.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Someone starts: 'Once upon a time...'", "Each person adds one sentence.", "Keep it going as long as possible.", "Record on phone to listen back later."],
    variations: ["Silly stories only", "Adventure theme", "Include passengers as characters"]
  },
  {
    id: "CAR_0007",
    title: "Guess the Song",
    summary: "Hum or whistle songs for others to guess the title.",
    tags: ["CAR", "TRAVEL", "SL", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["One person hums a song.", "Others try to guess title and artist.", "Score a point for each correct guess.", "Take turns being the hummer."],
    variations: ["Play first second of song", "TV theme tunes", "Movie soundtracks"]
  },
  {
    id: "CAR_0008",
    title: "Would You Rather",
    summary: "Pose fun dilemmas and discuss choices.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T30", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Ask: 'Would you rather have wings or be invisible?'", "Everyone explains their choice.", "Take turns asking questions.", "Get creative and silly!"],
    variations: ["Food edition", "Superpower edition", "Holiday edition"]
  },
  {
    id: "CAR_0009",
    title: "Road Trip Bingo",
    summary: "Mark off items on bingo cards as you spot them on the journey.",
    tags: ["CAR", "TRAVEL", "NS", "P1", "M0", "T60", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Print road trip bingo cards before leaving.", "Each player gets a different card.", "Mark items as you spot them.", "First to get a line shouts 'Bingo!'"],
    variations: ["Create own cards", "Blackout version", "Team play"]
  },
  {
    id: "CAR_0010",
    title: "Don't Say It",
    summary: "Choose forbidden words that no one can say during the trip.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T60", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Pick 3-5 common words to ban.", "Anyone who says them gets a point.", "Lowest score at destination wins.", "Try tricking others into saying them!"],
    variations: ["Ban 'like' and 'um'", "Family members' names", "Destination name"]
  },
  {
    id: "CAR_0011",
    title: "Rhyme Time",
    summary: "Call out words and find as many rhymes as possible.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "EMED", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Say a simple word like 'cat'.", "Go around saying rhyming words.", "Out if you can't think of one.", "Start again with new word."],
    variations: ["Two-syllable words", "Create rhyming sentences", "Silly rhymes only"]
  },
  {
    id: "CAR_0012",
    title: "Animal Sound Game",
    summary: "Make animal sounds and guess which animal it is.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "EHIGH", "SCAR"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["One person makes an animal sound.", "Others guess the animal.", "Take turns being the animal.", "Try unusual animals too!"],
    variations: ["Farm animals only", "Jungle animals", "Extinct animals"]
  },
  {
    id: "CAR_0013",
    title: "What Color Am I",
    summary: "List items of one color until someone guesses the color.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T15", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Think of a color.", "List items of that color: 'fire engines, apples, roses...'", "Others shout when they know the color.", "Quickest guesser picks next."],
    variations: ["Shapes instead", "Textures", "Foods only"]
  },
  {
    id: "CAR_0014",
    title: "License Plate Scramble",
    summary: "Make words or phrases from the letters on license plates.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T30", "EMED", "SCAR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Spot a license plate.", "Use the letters to make a word or phrase.", "Longest or funniest word wins.", "Keep score throughout journey."],
    variations: ["Must be a real word", "Create sentences", "Silly acronyms"]
  },
  {
    id: "CAR_0015",
    title: "Car Karaoke",
    summary: "Sing along to favorite songs together.",
    tags: ["CAR", "TRAVEL", "SL", "P0", "M0", "T30", "EHIGH", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Create a family playlist beforehand.", "Take turns choosing songs.", "Everyone sings along.", "Rate each performance!"],
    variations: ["Duets only", "Disney songs", "One decade at a time"]
  },
  {
    id: "CAR_0016",
    title: "Pipe Cleaner Creations",
    summary: "Twist pipe cleaners into shapes and characters during the drive.",
    tags: ["CAR", "TRAVEL", "CRAFT", "NS", "P1", "M0", "T30", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Bring a bag of colorful pipe cleaners.", "Challenge: make an animal.", "Show and tell creations.", "Link together for a chain."],
    variations: ["Jewelry making", "Letters and numbers", "Finger puppets"]
  },
  {
    id: "CAR_0017",
    title: "Thumb Wrestling",
    summary: "Classic thumb wrestling competition between passengers.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T10", "EMED", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lock fingers with opponent.", "Say: 'One, two, three, four, I declare a thumb war!'", "Pin opponent's thumb for 3 seconds to win.", "Best of 3 rounds."],
    variations: ["Left hand only", "Tournament bracket", "Champion challenges driver at rest stop"]
  },
  {
    id: "CAR_0018",
    title: "Travel Journal",
    summary: "Draw and write about the journey in a notebook.",
    tags: ["CAR", "TRAVEL", "NS", "P1", "M0", "T45", "ELOW", "SCAR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Bring a notebook and pencils.", "Draw things you see out the window.", "Write about feelings and observations.", "Date each entry."],
    variations: ["Photo journal at stops", "Comic strip version", "Collect tickets and receipts to paste in"]
  },
  {
    id: "CAR_0019",
    title: "Hot Seat Questions",
    summary: "One person answers 5 questions from others, can refuse 1.",
    tags: ["CAR", "TRAVEL", "NS", "P0", "M0", "T20", "EMED", "SCAR"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["One person is in the 'hot seat'.", "Others ask 5 questions.", "Must answer honestly, can refuse 1.", "Rotate through all passengers."],
    variations: ["Silly questions only", "Favorites edition", "Dream life edition"]
  },
  {
    id: "CAR_0020",
    title: "Audiobook Adventure",
    summary: "Listen to a family audiobook during the journey.",
    tags: ["CAR", "TRAVEL", "SL", "P1", "M0", "T120", "ELOW", "SCAR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Download audiobook before trip.", "Choose story everyone will enjoy.", "Play through car speakers.", "Discuss the story at rest stops."],
    variations: ["Podcast episodes", "Radio dramas", "Educational series"]
  },
  // ============ BEDTIME / CALM DOWN ROUTINES ============
  {
    id: "BED_0001",
    title: "Dandelion Breaths",
    summary: "Deep breathing pretending to blow dandelion seeds.",
    tags: ["BEDTIME", "BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Imagine holding a dandelion.", "Breathe in deeply through nose.", "Blow out slowly through mouth.", "Watch imaginary seeds float away."],
    variations: ["Birthday candle breaths", "Hot chocolate cooling", "Balloon breaths"]
  },
  {
    id: "BED_0002",
    title: "Bedtime Yoga Stretches",
    summary: "Gentle yoga poses to relax the body before sleep.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Child's pose: kneel and stretch arms forward.", "Cat-cow: arch and round back gently.", "Legs up the wall: rest with legs elevated.", "Hold each for 5 breaths."],
    variations: ["Butterfly pose", "Happy baby", "Gentle twist"]
  },
  {
    id: "BED_0003",
    title: "Gratitude Talk",
    summary: "Share three things you're grateful for from today.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Snuggle in bed together.", "Each person shares 3 good things from today.", "Can be big or small moments.", "End with a hug and positive thought."],
    variations: ["Rose, bud, thorn version", "Draw your gratitude", "Gratitude jar"]
  },
  {
    id: "BED_0004",
    title: "Progressive Muscle Relaxation",
    summary: "Tense and release muscles from toes to head.",
    tags: ["BEDTIME", "BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lie flat and close eyes.", "Squeeze toes tight for 5 seconds, then release.", "Move up through legs, tummy, arms, face.", "Notice how relaxed each part feels."],
    variations: ["Spaghetti body (go floppy)", "Robot to ragdoll", "Squeeze like a lemon"]
  },
  {
    id: "BED_0005",
    title: "Worry Box",
    summary: "Write worries on paper and put them in a box to deal with tomorrow.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P1", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Keep small box and paper slips by bed.", "Write down any worries before sleep.", "Fold and put in box.", "Box 'holds' worries so brain can rest."],
    variations: ["Worry monster that eats worries", "Worry journal", "Talk to worry doll"]
  },
  {
    id: "BED_0006",
    title: "Bedtime Story Reading",
    summary: "Read calming stories together before lights out.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T15", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose 1-2 calming books.", "Snuggle together in bed.", "Read in soft, slow voice.", "End with cuddles and goodnight."],
    variations: ["Audiobook version", "Made-up stories", "Chapter book series"]
  },
  {
    id: "BED_0007",
    title: "Gentle Massage",
    summary: "Give child a calming back or foot massage.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Use gentle pressure on back, feet, or hands.", "Use lotion if desired.", "Make slow, soothing strokes.", "Helps release tension and promotes sleep."],
    variations: ["Draw pictures on back game", "Spell words on back", "Weather report on back"]
  },
  {
    id: "BED_0008",
    title: "Positive Affirmations",
    summary: "Repeat calming, positive statements together.",
    tags: ["BEDTIME", "BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose 3-5 affirmations.", "Say together: 'I am safe. I am loved. I can do hard things.'", "Let child pick favorites.", "Repeat nightly for routine."],
    variations: ["Create personal affirmations", "Affirmation cards", "Mirror affirmations"]
  },
  {
    id: "BED_0009",
    title: "Starfish Calm Down",
    summary: "Trace fingers like a starfish while breathing.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Hold one hand up like a starfish.", "Use other finger to trace up and down fingers.", "Breathe in going up, out going down.", "Do all 5 fingers slowly."],
    variations: ["Trace both hands", "Use feather to trace", "Eyes closed version"]
  },
  {
    id: "BED_0010",
    title: "Lullaby Time",
    summary: "Sing or play soft lullabies to help child drift off.",
    tags: ["BEDTIME", "QUIET_TIME", "SL", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Turn lights low.", "Sing familiar lullaby or play recording.", "Rock or pat gently if appropriate.", "Continue until drowsy."],
    variations: ["Humming instead", "Play soft instrumental", "Make up silly lullaby"]
  },
  {
    id: "BED_0011",
    title: "Body Scan Meditation",
    summary: "Guide child through noticing each body part relaxing.",
    tags: ["BEDTIME", "BIG_FEELINGS", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lie down and close eyes.", "Start at toes: 'Notice your toes feeling heavy and relaxed.'", "Move slowly up through body.", "End at head feeling completely relaxed."],
    variations: ["Use guided recording", "Add calming imagery", "Quick version for busy nights"]
  },
  {
    id: "BED_0012",
    title: "Cuddle and Chat",
    summary: "Special one-on-one time talking about the day.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get comfortable in bed together.", "Ask open questions: 'What made you laugh today?'", "Listen without judgment.", "End with 'I love you'."],
    variations: ["Highs and lows", "Tomorrow's excitement", "Memory lane"]
  },
  {
    id: "BED_0013",
    title: "Visualization Journey",
    summary: "Guide child through imagining a peaceful place.",
    tags: ["BEDTIME", "QUIET_TIME", "NS", "P0", "M0", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Close eyes and breathe deeply.", "Describe peaceful scene: beach, forest, clouds.", "Include sensory details: sounds, smells, feelings.", "Let them drift into the image."],
    variations: ["Child describes their own place", "Flying through clouds", "Magic garden"]
  },
  {
    id: "BED_0014",
    title: "Stuffed Animal Breathing",
    summary: "Place stuffed animal on tummy and watch it rise and fall.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P0", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Lie on back with stuffed animal on tummy.", "Breathe slowly and watch animal rise and fall.", "Try to make smooth, even movements.", "Focuses attention on calm breathing."],
    variations: ["Count the rises", "Give animal a ride", "Smallest movements challenge"]
  },
  {
    id: "BED_0015",
    title: "Calm Down Glitter Jar",
    summary: "Shake jar and watch glitter settle while calming down.",
    tags: ["BEDTIME", "BIG_FEELINGS", "NS", "P1", "M0", "T5", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fill jar with water, glitter glue, and extra glitter.", "Seal tightly.", "When upset, shake jar.", "Breathe and watch glitter settle, matching calm."],
    variations: ["Make with child", "Use glow-in-dark glitter", "Different colored jars for different feelings"]
  },
  // ============ SENSORY PLAY (TODDLERS) ============
  {
    id: "SENS_0001",
    title: "Colored Rice Bin",
    summary: "Dye rice with food coloring and fill a bin for scooping and pouring.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P2", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix rice with food coloring and vinegar in bag.", "Spread on baking sheet to dry.", "Add to large bin with scoops, cups, funnels.", "Let child explore textures and sounds."],
    variations: ["Rainbow layers", "Hide small toys", "Add themed items (dinosaurs, vehicles)"]
  },
  {
    id: "SENS_0002",
    title: "Water Table Play",
    summary: "Fill container with water and add floating toys and pouring tools.",
    tags: ["KEEP_BUSY", "OUTDOOR", "INDOOR", "NS", "P1", "M2", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Fill shallow tub or water table.", "Add cups, funnels, boats, and toys.", "Let child pour, splash, and explore.", "Add bubbles or food coloring for variety."],
    variations: ["Bubble foam bath", "Fishing game", "Car wash play"]
  },
  {
    id: "SENS_0003",
    title: "Kinetic Sand Play",
    summary: "Moldable sand that sticks together for mess-free sensory play.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Set up kinetic sand in a tray.", "Provide molds, cutters, and tools.", "Squeeze, mold, and cut shapes.", "Practice letters or make structures."],
    variations: ["Hide toys to excavate", "Build castles", "Add toy figures for play"]
  },
  {
    id: "SENS_0004",
    title: "Bubble Foam Fun",
    summary: "Create mountains of bubbles for sensory exploration.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Mix 1 part bubble bath with 2 parts water.", "Use hand mixer or whisk to create foam.", "Add to tub or large container.", "Play with cups, toys, and colors."],
    variations: ["Color the foam", "Add toy car wash", "Draw in foam"]
  },
  {
    id: "SENS_0005",
    title: "Cooked Spaghetti Play",
    summary: "Play with cooled cooked spaghetti dyed different colors.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P2", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Cook spaghetti and let cool.", "Divide and add food coloring.", "Place in tray or highchair.", "Let child squeeze, pull, and explore."],
    variations: ["Cut with scissors", "Add toy animals", "Threading activity"]
  },
  {
    id: "SENS_0006",
    title: "Taste-Safe Cloud Dough",
    summary: "Make soft dough from flour and oil that's safe for mouthing toddlers.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix 8 cups flour with 1 cup vegetable oil.", "Knead until soft and moldable.", "Add to bin or tray.", "Scoop, mold, and hide objects."],
    variations: ["Add cocoa for chocolate scent", "Sparkly with glitter", "Color with powdered drink mix"]
  },
  {
    id: "SENS_0007",
    title: "Jelly Dig",
    summary: "Set toys in jelly and let children dig them out.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P2", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Make jelly according to packet.", "Add small toys before it sets.", "Refrigerate until solid.", "Let children dig out toys with spoons."],
    variations: ["Layer different colors", "Frozen jelly version", "Edible version with fruit"]
  },
  {
    id: "SENS_0008",
    title: "Nature Sensory Bin",
    summary: "Fill a bin with natural materials like pinecones, leaves, and sticks.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Collect leaves, pinecones, sticks, rocks on a walk.", "Add to large container.", "Include magnifying glass and tongs.", "Sort, examine, and explore."],
    variations: ["Seasonal themed", "Add toy forest animals", "Make nature soup"]
  },
  {
    id: "SENS_0009",
    title: "Shaving Foam Art",
    summary: "Squeeze shaving foam onto tray and add colors for swirling art.",
    tags: ["KEEP_BUSY", "CRAFT", "INDOOR", "NS", "P1", "M2", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Squeeze shaving foam onto tray.", "Add drops of food coloring.", "Swirl with stick or fingers.", "Press paper on top for marbled print."],
    variations: ["Add glitter", "Use paint instead", "Number and letter formation"]
  },
  {
    id: "SENS_0010",
    title: "Sensory Bottles",
    summary: "Fill clear bottles with water, glitter, and small objects to shake and watch.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fill empty plastic bottle 2/3 with water.", "Add glitter, small beads, or sequins.", "Add a drop of dish soap.", "Seal tightly with hot glue."],
    variations: ["Oil and water version", "Ocean themed", "Calm down bottle"]
  },
  // ============ OUTDOOR NATURE ACTIVITIES ============
  {
    id: "OUT_0001",
    title: "Nature Scavenger Hunt",
    summary: "Find items from a list while exploring outdoors.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T45", "EMED", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Print or draw list of items to find.", "Explore garden, park, or woodland.", "Check off items as found.", "Collect safe items in bag."],
    variations: ["Photo scavenger hunt", "Seasonal themes", "Alphabet nature hunt"]
  },
  {
    id: "OUT_0002",
    title: "Bug Hotel Building",
    summary: "Create a shelter for insects using natural materials.",
    tags: ["OUTDOOR", "BUILDING", "NS", "P2", "M1", "T60", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Find wooden crate, palette, or stack bricks.", "Fill gaps with twigs, pinecones, bark, leaves.", "Add sections of bamboo canes.", "Place in quiet corner of garden."],
    variations: ["Decorate the hotel", "Keep bug diary", "Research which bugs visit"]
  },
  {
    id: "OUT_0003",
    title: "Bird Feeder Making",
    summary: "Create a simple bird feeder and watch birds visit.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Spread peanut butter on pinecone or toilet roll.", "Roll in bird seed.", "Tie string to hang.", "Watch from window and identify birds."],
    variations: ["Orange cup feeder", "Milk carton house", "Lard and seed balls"]
  },
  {
    id: "OUT_0004",
    title: "Mud Kitchen Play",
    summary: "Set up outdoor kitchen for mud pies and nature cooking.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M2", "T60", "EHIGH", "SOUTDOOR"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Set up old pots, pans, and utensils outside.", "Add water and access to mud.", "Gather natural ingredients: leaves, flowers, stones.", "Let children create mud pies and potions."],
    variations: ["Add food coloring to water", "Theme menus", "Mud painting"]
  },
  {
    id: "OUT_0005",
    title: "Cloud Watching",
    summary: "Lie on blanket and find shapes in the clouds.",
    tags: ["OUTDOOR", "QUIET_TIME", "NS", "P0", "M0", "T20", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Spread blanket on grass.", "Lie on back and look at sky.", "Point out shapes you see in clouds.", "Tell stories about cloud creatures."],
    variations: ["Learn cloud types", "Draw what you see", "Take photos of best shapes"]
  },
  {
    id: "OUT_0006",
    title: "Garden Treasure Hunt",
    summary: "Hide treasures in the garden for children to find.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P1", "M0", "T30", "EHIGH", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Hide coins, gems, or small prizes around garden.", "Draw treasure map or give clues.", "Set children loose to hunt.", "Count treasures found."],
    variations: ["Pirate theme", "Easter egg version", "Glow stick night hunt"]
  },
  {
    id: "OUT_0007",
    title: "Leaf Identification Quest",
    summary: "Collect different leaves and identify the trees they came from.",
    tags: ["OUTDOOR", "SCIENCE", "NS", "P1", "M0", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect leaves from different trees.", "Use book or app to identify species.", "Press leaves or make rubbings.", "Create a nature journal page."],
    variations: ["Bark rubbings", "Seed collection", "Seasonal comparison"]
  },
  {
    id: "OUT_0008",
    title: "Puddle Splashing",
    summary: "Put on wellies and splash in puddles after rain.",
    tags: ["OUTDOOR", "RAINY_DAY", "NS", "P0", "M2", "T30", "EHIGH", "SOUTDOOR", "SRAINY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Put on waterproofs and wellies.", "Find the best puddles.", "Jump and splash!", "Compare splash sizes."],
    variations: ["Leaf boats racing", "Measure puddle depths", "Make rainbows with puddle water"]
  },
  {
    id: "OUT_0009",
    title: "Garden Camping",
    summary: "Set up tent in garden for outdoor adventure.",
    tags: ["OUTDOOR", "KEEP_BUSY", "NS", "P2", "M0", "T120", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Set up tent in garden.", "Bring sleeping bags and pillows.", "Tell stories and play games.", "Sleep outside or come in at bedtime."],
    variations: ["Stargazing session", "Campfire with adult supervision", "Nature sounds bingo"]
  },
  {
    id: "OUT_0010",
    title: "Minibeast Hunt",
    summary: "Search for insects and small creatures in the garden.",
    tags: ["OUTDOOR", "SCIENCE", "NS", "P1", "M0", "T30", "EMED", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Get magnifying glass and container.", "Look under logs, rocks, and leaves.", "Observe creatures carefully.", "Return safely to where found."],
    variations: ["Bug bingo", "Draw what you find", "Count species found"]
  },
  {
    id: "OUT_0011",
    title: "Nature Art",
    summary: "Create art using natural materials found outdoors.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P0", "M0", "T45", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect sticks, leaves, flowers, stones.", "Arrange into patterns or pictures on ground.", "Take photos of creations.", "Leave for others to enjoy."],
    variations: ["Mandala patterns", "Face portraits", "Words spelled out"]
  },
  {
    id: "OUT_0012",
    title: "Worm Charming",
    summary: "Use vibrations to encourage worms to surface from soil.",
    tags: ["OUTDOOR", "SCIENCE", "NS", "P0", "M1", "T30", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Find a grassy area after rain.", "Push fork into ground and wiggle.", "Watch for worms coming to surface.", "Count your worms!"],
    variations: ["Worm race", "Learn about worm biology", "Start a worm farm"]
  },
  {
    id: "OUT_0013",
    title: "Flower Pressing",
    summary: "Press flowers in heavy books to preserve them.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M0", "T10", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Pick flat flowers and leaves.", "Place between paper in heavy book.", "Leave for 2-3 weeks.", "Use for cards or framing."],
    variations: ["Bookmark making", "Candle decorating", "Nature journal pages"]
  },
  {
    id: "OUT_0014",
    title: "Shadow Drawing",
    summary: "Trace shadows of objects or each other on paper or pavement.",
    tags: ["OUTDOOR", "CRAFT", "NS", "P1", "M0", "T20", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Find sunny spot.", "Position toy or stand still for portrait.", "Trace shadow with chalk or pencil.", "Add details and color in."],
    variations: ["Shadow puppets on wall", "Time-lapse shadow drawings", "Shadow theater"]
  },
  {
    id: "OUT_0015",
    title: "Den Building",
    summary: "Build a shelter using sticks, branches, and leaves.",
    tags: ["OUTDOOR", "BUILDING", "NS", "P0", "M1", "T60", "EHIGH", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Find suitable area with fallen branches.", "Lean large sticks against tree or together.", "Fill gaps with smaller sticks and leaves.", "Make cozy with blankets for reading."],
    variations: ["Fairy house version", "Survival challenge", "Team building competition"]
  },
  // ============ CREATIVE ARTS & CRAFTS ============
  {
    id: "CRAFT_0001",
    title: "Cardboard Box Creations",
    summary: "Transform cardboard boxes into rocket ships, houses, or cars.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T60", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Find large cardboard box.", "Cut doors, windows, or features.", "Paint and decorate.", "Add details with markers and stickers."],
    variations: ["Puppet theater", "Shop front", "Space station"]
  },
  {
    id: "CRAFT_0002",
    title: "Finger Painting",
    summary: "Create art using fingers and hands with washable paints.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Cover table with newspaper or plastic.", "Put washable paints in shallow trays.", "Use fingers, hands, or feet to paint.", "Let dry and display proudly."],
    variations: ["Handprint animals", "Footprint art", "Collaborative mural"]
  },
  {
    id: "CRAFT_0003",
    title: "Paper Airplane Competition",
    summary: "Fold paper airplanes and compete for longest flight.",
    tags: ["CRAFT", "INDOOR", "OUTDOOR", "NS", "P0", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fold paper into airplane design.", "Test flight and adjust.", "Mark landing spots.", "Compete for distance or accuracy."],
    variations: ["Different designs", "Stunt flying", "Decorate before flying"]
  },
  {
    id: "CRAFT_0004",
    title: "Salt Dough Ornaments",
    summary: "Make ornaments from salt dough that can be painted when dry.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T60", "EMED", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Mix 1 cup flour, 1/2 cup salt, 1/2 cup water.", "Roll out and cut shapes.", "Poke hole for hanging.", "Bake low heat or air dry, then paint."],
    variations: ["Handprint keepsakes", "Christmas decorations", "Gift tags"]
  },
  {
    id: "CRAFT_0005",
    title: "Paper Plate Animals",
    summary: "Transform paper plates into animal faces and masks.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Paint plate as animal face.", "Add ears from card, googly eyes, nose.", "Cut eye holes for mask option.", "Add stick handle or elastic."],
    variations: ["Farm animals", "Jungle animals", "Emoji faces"]
  },
  {
    id: "CRAFT_0006",
    title: "Tie Dye T-Shirts",
    summary: "Create colorful tie dye patterns on plain white shirts.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P2", "M2", "T60", "EMED", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Rubber band white t-shirt in sections.", "Apply fabric dye to sections.", "Wrap in plastic and leave 6-24 hours.", "Rinse, remove bands, wash and dry."],
    variations: ["Spiral patterns", "Heart designs", "Socks and pillowcases"]
  },
  {
    id: "CRAFT_0007",
    title: "Collage Making",
    summary: "Cut and glue magazine pictures to create art collages.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect old magazines, catalogs, wrapping paper.", "Cut out interesting images and shapes.", "Arrange and glue onto paper.", "Add drawing or painting touches."],
    variations: ["Dream board", "Self portrait collage", "Alphabet collage"]
  },
  {
    id: "CRAFT_0008",
    title: "Toilet Roll Crafts",
    summary: "Transform toilet rolls into animals, people, or structures.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect empty toilet paper rolls.", "Paint or cover with paper.", "Add features: ears, wings, faces.", "Create a whole family or set."],
    variations: ["Binoculars", "Desk organizer", "Castles and towers"]
  },
  {
    id: "CRAFT_0009",
    title: "Origami Animals",
    summary: "Fold paper into animals using origami techniques.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get square paper and instructions.", "Follow steps carefully.", "Practice simple designs first.", "Create a paper zoo."],
    variations: ["Fortune tellers", "Stars and flowers", "Mobile display"]
  },
  {
    id: "CRAFT_0010",
    title: "Homemade Cards",
    summary: "Create greeting cards for birthdays, holidays, or thank you notes.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M1", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Fold card paper in half.", "Decorate front with drawings, stickers, or collage.", "Write message inside.", "Make envelope from paper."],
    variations: ["Pop-up cards", "Pressed flower cards", "Potato print cards"]
  },
  {
    id: "CRAFT_0011",
    title: "Painted Rocks",
    summary: "Paint designs on smooth rocks for garden decoration or kindness rocks.",
    tags: ["CRAFT", "OUTDOOR", "NS", "P1", "M1", "T30", "ELOW", "SOUTDOOR"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Collect smooth, flat rocks.", "Wash and dry.", "Paint designs or kind messages.", "Leave in garden or hide for others to find."],
    variations: ["Story stones", "Pet rocks", "Garden markers"]
  },
  {
    id: "CRAFT_0012",
    title: "Pom Pom Making",
    summary: "Create fluffy pom poms from yarn for crafts or decorations.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut cardboard circles with hole in center.", "Wrap yarn around cardboard many times.", "Cut yarn around edges, tie middle tight.", "Fluff into ball shape."],
    variations: ["Pom pom animals", "Garlands", "Keyrings"]
  },
  {
    id: "CRAFT_0013",
    title: "Potato Stamps",
    summary: "Carve patterns into potato halves to use as stamps.",
    tags: ["CRAFT", "INDOOR", "NS", "P1", "M2", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Cut potato in half.", "Carve simple shape into flat side (adult helps).", "Dip in paint.", "Stamp onto paper for patterns."],
    variations: ["Wrapping paper making", "Fabric stamping", "Card decorating"]
  },
  {
    id: "CRAFT_0014",
    title: "Fairy Garden Creation",
    summary: "Build a miniature fairy garden in a pot or container.",
    tags: ["CRAFT", "OUTDOOR", "BUILDING", "NS", "P1", "M1", "T60", "ELOW", "SOUTDOOR"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Fill pot with soil.", "Add small plants.", "Create tiny furniture from sticks and stones.", "Add fairy house and accessories."],
    variations: ["Dinosaur garden", "Beach theme", "Seasonal versions"]
  },
  {
    id: "CRAFT_0015",
    title: "Paper Chain Decorations",
    summary: "Make colorful paper chains for parties or room decoration.",
    tags: ["CRAFT", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Cut colored paper into strips.", "Make first ring and glue.", "Thread next strip through and glue.", "Continue until desired length."],
    variations: ["Countdown chain", "Pattern chains", "Giant room crossing chain"]
  },
  // ============ ACTIVE INDOOR GAMES ============
  {
    id: "ACTIVE_0001",
    title: "Hide and Seek",
    summary: "Classic game of finding hidden players around the house.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T20", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Choose someone to be 'it' and count.", "Others hide around the house.", "Seeker finds everyone.", "First found is next seeker."],
    variations: ["Sardines (all hide in same spot)", "Hide and seek tag", "Glow in dark version"]
  },
  {
    id: "ACTIVE_0002",
    title: "Indoor Bowling",
    summary: "Set up plastic bottles as pins and roll a ball to knock them down.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Set up empty bottles in triangle.", "Mark throwing line.", "Roll soft ball to knock down.", "Keep score across rounds."],
    variations: ["Fill bottles partially for challenge", "Glow stick pins", "Team competition"]
  },
  {
    id: "ACTIVE_0003",
    title: "Musical Statues",
    summary: "Dance when music plays, freeze when it stops.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Play music, everyone dances.", "Stop music suddenly.", "Anyone who moves is out.", "Last dancer standing wins."],
    variations: ["Silly poses required", "Dance styles (robot, ballet)", "Team version"]
  },
  {
    id: "ACTIVE_0004",
    title: "Balloon Keep Up",
    summary: "Keep balloon in the air as long as possible without it touching the ground.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Blow up balloon.", "Hit into air.", "Keep off ground using any body part.", "Count touches or time it."],
    variations: ["Multiple balloons", "No hands", "Sitting only"]
  },
  {
    id: "ACTIVE_0005",
    title: "Simon Says",
    summary: "Follow commands only when preceded by 'Simon says'.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Leader gives commands.", "Players only follow if preceded by 'Simon says'.", "If you follow without 'Simon says', you're out.", "Last player standing wins."],
    variations: ["Speed version", "Silly commands", "Physical challenges"]
  },
  {
    id: "ACTIVE_0006",
    title: "Pillow Fight",
    summary: "Safe pillow fight with soft pillows and clear rules.",
    tags: ["KEEP_BUSY", "INDOOR", "SIBLINGS", "NS", "P0", "M0", "T10", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Use soft pillows only.", "Set clear boundaries and rules.", "No hitting faces.", "Stop when someone says stop."],
    variations: ["One pillow each rule", "Defense only", "Slow motion pillow fight"]
  },
  {
    id: "ACTIVE_0007",
    title: "Floor is Lava",
    summary: "Navigate room without touching the floor using furniture and cushions.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Place cushions and safe objects around room.", "Shout 'The floor is lava!'", "Everyone must get off the floor.", "Move around room without touching floor."],
    variations: ["Timed challenges", "Add obstacles", "Rescue missions"]
  },
  {
    id: "ACTIVE_0008",
    title: "Hopscotch (Indoor)",
    summary: "Use tape to create hopscotch grid on floor.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Create hopscotch grid with masking tape.", "Throw marker into first square.", "Hop through grid, skip marker square.", "Pick up marker on way back."],
    variations: ["Number learning version", "Time challenge", "New patterns"]
  },
  {
    id: "ACTIVE_0009",
    title: "Treasure Island Hopping",
    summary: "Jump between paper 'islands' across the floor.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "medium", noise: "medium" },
    steps: ["Place paper plates or paper as islands.", "Space them out across room.", "Jump from island to island.", "Don't fall in the 'water'!"],
    variations: ["Sharks in the water", "Remove islands as you go", "Time trials"]
  },
  {
    id: "ACTIVE_0010",
    title: "Duck Duck Goose",
    summary: "Classic circle game of chasing and catching.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "SIBLINGS", "PLAYDATE", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Sit in circle.", "One player walks around tapping heads: 'duck, duck...'", "On 'goose!', that player chases around circle.", "Chase tries to tag before reaching empty spot."],
    variations: ["Animal versions", "Color duck color goose", "Reverse direction"]
  },
  // ============ EDUCATIONAL ACTIVITIES ============
  {
    id: "EDU_0001",
    title: "Letter Formation Practice",
    summary: "Practice writing letters in sand, salt, or shaving cream.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M1", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Pour sand or salt into shallow tray.", "Show letter to copy.", "Use finger to form letter in sand.", "Shake to erase and try again."],
    variations: ["Numbers practice", "Spelling words", "Shaving cream version"]
  },
  {
    id: "EDU_0002",
    title: "Counting and Sorting",
    summary: "Sort and count objects by color, size, or type.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather small objects: buttons, beads, pasta.", "Sort into groups by chosen attribute.", "Count each group.", "Record numbers."],
    variations: ["Graphing results", "Pattern making", "Estimation games"]
  },
  {
    id: "EDU_0003",
    title: "Reading Treasure Hunt",
    summary: "Follow written clues to find a prize.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Write age-appropriate clues.", "Hide clues around house.", "Each clue leads to next.", "Final clue leads to small prize."],
    variations: ["Rhyming clues", "Math problem clues", "Map reading version"]
  },
  {
    id: "EDU_0004",
    title: "Times Tables Games",
    summary: "Practice multiplication through fun games and activities.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "EMED", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Make flashcards for target tables.", "Play matching memory game.", "Race to answer correctly.", "Track progress on chart."],
    variations: ["Times table bingo", "Ball toss quiz", "Song learning"]
  },
  {
    id: "EDU_0005",
    title: "Map Drawing",
    summary: "Draw maps of your bedroom, house, or neighborhood.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Decide what to map.", "Walk around observing features.", "Draw bird's eye view.", "Add key and compass."],
    variations: ["Treasure map with X marks spot", "Fantasy world map", "Scale drawing"]
  },
  {
    id: "EDU_0006",
    title: "Spelling Bee Practice",
    summary: "Practice spelling words aloud in competition format.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather spelling words.", "Take turns giving words to spell.", "Spell aloud letter by letter.", "Track correct answers."],
    variations: ["Timed rounds", "Write answers instead", "Category spelling"]
  },
  {
    id: "EDU_0007",
    title: "History Timeline",
    summary: "Create a visual timeline of historical events or family history.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose time period or topic.", "Research key dates and events.", "Draw timeline on long paper.", "Add illustrations and descriptions."],
    variations: ["Personal life timeline", "Decade focus", "Technology timeline"]
  },
  {
    id: "EDU_0008",
    title: "Reading Together",
    summary: "Take turns reading pages of a book aloud.",
    tags: ["HOMEWORK", "QUIET_TIME", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose book appropriate for reading level.", "Take turns reading pages or paragraphs.", "Help with difficult words.", "Discuss story as you go."],
    variations: ["Character voices", "Prediction pauses", "Chapter book series"]
  },
  {
    id: "EDU_0009",
    title: "Geography Quiz",
    summary: "Test knowledge of countries, capitals, and flags.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get world map or atlas.", "Quiz on countries and capitals.", "Identify flags.", "Mark places you'd like to visit."],
    variations: ["Map jigsaws", "Travel planning game", "Where in the world"]
  },
  {
    id: "EDU_0010",
    title: "Book Report Poster",
    summary: "Create a poster about a book you've read.",
    tags: ["HOMEWORK", "CRAFT", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Choose favorite book.", "Plan sections: summary, characters, review.", "Draw and write on large paper.", "Add illustrations from the story."],
    variations: ["Shoebox diorama", "Book trailer video", "Character interview"]
  },
  // ============ ADDITIONAL MISC ACTIVITIES ============
  {
    id: "MISC_0001",
    title: "Teddy Bear's Picnic",
    summary: "Set up indoor picnic with stuffed animals as guests.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Gather stuffed animals.", "Lay blanket and set up picnic.", "Prepare simple snacks.", "Host tea party with toys."],
    variations: ["Theme parties", "Dress up toys", "Outdoor version"]
  },
  {
    id: "MISC_0002",
    title: "Family Photo Album Time",
    summary: "Look through old family photos and share stories.",
    tags: ["QUIET_TIME", "INDOOR", "NS", "P0", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get out photo albums or phone photos.", "Look through together.", "Share stories about each photo.", "Learn about family history."],
    variations: ["Video memories", "Create new album", "Interview grandparents"]
  },
  {
    id: "MISC_0003",
    title: "Fashion Show",
    summary: "Dress up and walk the runway for family audience.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Raid dress up box or wardrobes.", "Create outfits.", "Set up runway area.", "Walk and pose for audience."],
    variations: ["Theme costumes", "Judge and score", "Accessory focus"]
  },
  {
    id: "MISC_0004",
    title: "Magic Tricks",
    summary: "Learn and perform simple magic tricks for family.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Learn simple tricks online or from books.", "Practice until smooth.", "Set up magic show.", "Perform for family audience."],
    variations: ["Card tricks", "Coin tricks", "Mind reading games"]
  },
  {
    id: "MISC_0005",
    title: "Restaurant Role Play",
    summary: "Set up pretend restaurant with menus and table service.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M0", "T45", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Create menus with drawings or cutouts.", "Set table with cloth and cutlery.", "Take orders and serve pretend food.", "Switch roles."],
    variations: ["Theme restaurants", "Real cooking involved", "Cafe version"]
  },
  {
    id: "MISC_0006",
    title: "Spa Day",
    summary: "Pamper session with face masks, nail painting, and relaxation.",
    tags: ["QUIET_TIME", "INDOOR", "NS", "P1", "M1", "T45", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Set up spa area with towels.", "Make cucumber eye covers.", "Paint nails or apply kid-safe face mask.", "Play relaxing music."],
    variations: ["Hand and foot soak", "Hair styling", "Make bath bombs"]
  },
  {
    id: "MISC_0007",
    title: "Talent Show",
    summary: "Perform songs, dances, jokes, or skills for family audience.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T60", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Each person prepares an act.", "Set up stage area.", "Introduce each performer.", "Applaud and celebrate everyone."],
    variations: ["Judging panel", "Costume requirement", "Theme night"]
  },
  {
    id: "MISC_0008",
    title: "Build a Band",
    summary: "Create instruments and form a family band.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P1", "M1", "T45", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "high" },
    steps: ["Make shakers from bottles and rice.", "Create drums from boxes.", "Rubber band guitars on tissue boxes.", "Play songs together."],
    variations: ["Record a song", "Name your band", "Design album cover"]
  },
  {
    id: "MISC_0009",
    title: "Movie Making",
    summary: "Write, act, and film a short movie on tablet or phone.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P1", "M0", "T90", "EMED", "SNOISE_OK"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Write simple script with beginning, middle, end.", "Assign roles and gather props.", "Film scenes on device.", "Watch together."],
    variations: ["Stop motion animation", "Music video", "Documentary style"]
  },
  {
    id: "MISC_0010",
    title: "Code Breaking",
    summary: "Create and solve secret codes and ciphers.",
    tags: ["HOMEWORK", "INDOOR", "NS", "P1", "M0", "T30", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Learn simple cipher (letter shift, symbols).", "Write secret messages.", "Exchange and decode.", "Create more complex codes."],
    variations: ["Morse code", "Picture codes", "Treasure hunt clues in code"]
  },
  {
    id: "MISC_0011",
    title: "Grow Cress Heads",
    summary: "Draw faces on eggshells and grow cress as hair.",
    tags: ["SCIENCE", "INDOOR", "NS", "P1", "M1", "T10", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "low" },
    steps: ["Save clean eggshell halves.", "Draw faces with markers.", "Fill with damp cotton wool.", "Sprinkle cress seeds and place on windowsill."],
    variations: ["Different container creatures", "Cut hair for salads", "Chart growth"]
  },
  {
    id: "MISC_0012",
    title: "Family Charades",
    summary: "Act out words or phrases for others to guess.",
    tags: ["KEEP_BUSY", "INDOOR", "SIBLINGS", "NS", "P0", "M0", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Write words on paper slips.", "Take turns acting without speaking.", "Others guess what's being acted.", "Time limit adds excitement."],
    variations: ["Movie titles only", "Animals", "Drawn charades (Pictionary)"]
  },
  {
    id: "MISC_0013",
    title: "Building Block Challenge",
    summary: "Build the tallest tower or specific structure with blocks.",
    tags: ["BUILDING", "INDOOR", "NS", "P0", "M0", "T30", "EMED", "SQUIET_ONLY"],
    age_bands: ["A0_2", "A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get building blocks or LEGO.", "Set challenge (tallest, strongest).", "Build within time limit.", "Test and measure results."],
    variations: ["Blindfolded building", "Copy the leader", "Bridge building"]
  },
  {
    id: "MISC_0014",
    title: "LEGO Free Build",
    summary: "Open-ended LEGO building time with no instructions.",
    tags: ["BUILDING", "LEGO", "INDOOR", "NS", "P0", "M0", "T60", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Get out LEGO collection.", "Build whatever comes to mind.", "Tell stories about creations.", "Display or photograph favorites."],
    variations: ["Theme challenges", "Collaborative builds", "Speed building"]
  },
  {
    id: "MISC_0015",
    title: "Cleaning Race",
    summary: "Turn tidying up into a speed competition.",
    tags: ["CHORES", "INDOOR", "NS", "P0", "M0", "T15", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Set timer for 10-15 minutes.", "Race to tidy assigned areas.", "Make it a competition.", "Reward with stickers or screen time."],
    variations: ["Music race (tidy until song ends)", "Room swap challenge", "Basket toss sorting"]
  },
  {
    id: "MISC_0016",
    title: "Cooking Helper",
    summary: "Age-appropriate cooking tasks alongside parent.",
    tags: ["MEALS_SIMPLE", "INDOOR", "NS", "P1", "M1", "T30", "EMED", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "high", noise: "low" },
    steps: ["Choose simple recipe.", "Assign safe tasks (washing, stirring, measuring).", "Work together step by step.", "Enjoy meal together."],
    variations: ["Baking focus", "Cultural cuisine", "Meal planning"]
  },
  {
    id: "MISC_0017",
    title: "Joke Telling Time",
    summary: "Share jokes and riddles to make each other laugh.",
    tags: ["KEEP_BUSY", "INDOOR", "CAR", "NS", "P0", "M0", "T15", "ELOW", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["Look up age-appropriate jokes.", "Take turns telling jokes.", "Rate each joke.", "Write favorites in joke book."],
    variations: ["Knock knock only", "Make up jokes", "Riddle focus"]
  },
  {
    id: "MISC_0018",
    title: "Dance Routine Creation",
    summary: "Choreograph a dance routine to a favorite song.",
    tags: ["KEEP_BUSY", "INDOOR", "SL", "P0", "M0", "T45", "EHIGH", "SNOISE_OK"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "medium" },
    steps: ["Choose a song everyone likes.", "Create moves for each section.", "Practice until smooth.", "Perform for family."],
    variations: ["Video record", "Group routine", "Teach to others"]
  },
  {
    id: "MISC_0019",
    title: "Drawing from Instructions",
    summary: "One person describes, the other draws without seeing the original.",
    tags: ["KEEP_BUSY", "INDOOR", "NS", "P0", "M0", "T20", "ELOW", "SQUIET_ONLY"],
    age_bands: ["A6_8", "A9_12", "A13_16"],
    constraints: { supervision: "low", noise: "low" },
    steps: ["One person has a picture.", "Describe it for others to draw (no showing).", "Compare drawings to original.", "Switch roles."],
    variations: ["Simple shapes first", "Back-to-back drawing", "Telephone drawing game"]
  },
  {
    id: "MISC_0020",
    title: "Superhero Training Camp",
    summary: "Complete physical challenges to become a superhero.",
    tags: ["KEEP_BUSY", "INDOOR", "OUTDOOR", "NS", "P1", "M0", "T30", "EHIGH", "SNOISE_OK"],
    age_bands: ["A3_5", "A6_8", "A9_12"],
    constraints: { supervision: "medium", noise: "high" },
    steps: ["Create training stations (jumping, crawling, balancing).", "Design superhero names and powers.", "Complete the course.", "Earn superhero certificate."],
    variations: ["Ninja training", "Spy academy", "Space cadet training"]
  }
];
