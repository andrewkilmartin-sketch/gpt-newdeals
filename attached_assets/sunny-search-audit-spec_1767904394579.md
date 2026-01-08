# SUNNY SEARCH QUALITY AUDIT - Full Specification

## What We're Testing

Not just "did it return products" but "did it return the RIGHT products"

## The Test Flow

For EACH query:

```
1. USER QUERY: "lego star wars under £30"
   │
   ├─► 2. DATABASE CHECK: Do matching products exist?
   │      SQL: SELECT * FROM products WHERE name ILIKE '%lego%' AND name ILIKE '%star wars%' AND price < 30
   │      Result: Found 47 products ✓
   │
   ├─► 3. SEARCH API CHECK: What does Sunny return?
   │      GET /shopping/awin-link?query=lego+star+wars+under+£30
   │      Result: Returned 9 products
   │
   └─► 4. RELEVANCE CHECK: Are the returned products actually relevant?
          For each returned product:
          - Does it contain "lego"? ✓/✗
          - Does it contain "star wars"? ✓/✗
          - Is price under £30? ✓/✗
          
          Relevance Score: 7/9 relevant (78%)
```

## Output Required

```json
{
  "query": "lego star wars under £30",
  "database_check": {
    "exists": true,
    "count": 47,
    "sample_products": [
      {"name": "LEGO Star Wars X-Wing", "price": 24.99, "brand": "LEGO"},
      {"name": "LEGO Star Wars Mandalorian", "price": 19.99, "brand": "LEGO"}
    ]
  },
  "search_result": {
    "count": 9,
    "time_ms": 3200,
    "products": [
      {"name": "LEGO Star Wars X-Wing", "price": 24.99, "relevant": true},
      {"name": "LEGO City Fire Truck", "price": 22.99, "relevant": false, "reason": "Not Star Wars"},
      {"name": "Star Wars T-Shirt", "price": 12.99, "relevant": false, "reason": "Not LEGO"}
    ]
  },
  "analysis": {
    "status": "PARTIAL",
    "relevance_score": 0.78,
    "issues": ["Returned non-Star Wars LEGO", "Returned non-LEGO Star Wars items"],
    "suggestion": "Search should require BOTH keywords, not OR"
  }
}
```

## The 500 Test Queries

### Category 1: Brand + Product + Size (100 queries)
```
nike air force 1 white size 10
adidas trainers size 5 kids
clarks school shoes size 13
converse high tops kids size 11
vans old skool black size 6
crocs kids pink size 12
dr martens boots kids size 2
new balance kids trainers size 1
puma trainers boys size 4
reebok classics kids size 3
nike dunk low white size 8
adidas gazelle pink size 5
clarks first shoes size 4
skechers light up shoes size 10
geox school shoes size 12
start rite shoes size 11
lelli kelly shoes size 28 eu
kickers school shoes size 2
timberland boots kids size 13
ugg boots kids size 1
nike tech fleece kids 10-12 years
adidas tracksuit boys age 8
puma joggers girls age 6
north face jacket kids medium
columbia waterproof jacket age 10
joules wellies size 11
hunter wellies kids size 9
crocs lined kids size 8
birkenstock kids size 32
havaianas kids size 29
```

### Category 2: Character + Product (100 queries)
```
paw patrol tower playset
peppa pig backpack nursery
bluey toys plush heeler family
hey duggee squirrels toys
cocomelon jj doll
baby shark toys musical
frozen elsa costume age 5
spiderman toys action figure
batman toys batmobile
pokemon plush pikachu large
minecraft duvet cover single
fortnite toys figures
roblox toys figures
mario toys nintendo
sonic toys sega
harry potter lego hogwarts
disney princess dolls
marvel avengers toys
dc comics toys
thomas tank engine train set
paddington bear teddy
peter rabbit toys
gruffalo toys
hungry caterpillar toys
elmer elephant toys
spot the dog toys
maisy mouse toys
postman pat toys
fireman sam toys
bob builder toys
pj masks toys
ben holly toys
teletubbies toys
in the night garden toys
numberblocks toys
octonauts toys
blippi toys
gabby dollhouse toys
encanto toys mirabel
moana toys disney
```

### Category 3: Age + Interest + Budget (100 queries)
```
something for 3 year old who loves dinosaurs under £15
birthday present for 7 year old girl who likes unicorns
gift for 5 year old boy obsessed with cars under £20
present for 8 year old who loves science under £30
toys for 2 year old who likes animals under £10
gift for 10 year old boy into football under £25
present for 6 year old girl who loves crafts under £15
toys for 4 year old who likes building under £20
gift for 9 year old who loves reading under £15
present for toddler who loves music under £10
birthday gift for 11 year old gamer under £40
present for 12 year old who likes art under £25
toys for 1 year old learning to walk under £20
gift for teenager who likes music under £30
present for baby who likes sensory play under £15
toys for twins turning 4 under £30 total
gift for nephew age 7 not sure what he likes under £20
present for niece age 5 into princesses under £25
birthday present for grandchild age 3 under £15
christmas gift for 8 year old under £20
stocking fillers for 6 year old under £5
party bag fillers under £3 each
easter gift for toddler under £10
first birthday present under £30
christening gift under £25
```

### Category 4: Product Type + Specific Features (100 queries)
```
wooden train set compatible with brio
lego set under £30 for 6 year old
board game for family youngest is 5
puzzle 100 pieces age 6
bike with stabilisers 14 inch
scooter 3 wheel for 3 year old
trampoline 8ft with enclosure
swing set wooden double
climbing frame for small garden
paddling pool with slide
weighted blanket for anxious child
sensory toys for autistic child
fidget toys for adhd
noise cancelling headphones kids
tablet for kids with parental controls
camera for kids waterproof
walkie talkies long range kids
drone for beginners kids
telescope for kids 8 year old
microscope for kids real
science kit volcano eruption
chemistry set safe for kids
coding toy for 7 year old
robot toy programmable
remote control car off road
train set electric with sounds
dolls house wooden furniture
play kitchen with sounds
workbench toy with tools
cash register toy with scanner
```

### Category 5: Clothing + Age + Gender + Specifics (100 queries)
```
warm winter coat age 5-6 boy navy
waterproof jacket age 4 girl pink
school uniform polo shirts age 7 pack
pe kit shorts and tshirt age 8 boy
swimming costume age 6 girl unicorn
swim shorts age 5 boy dinosaur
pyjamas age 4 girl frozen
dressing gown age 7 boy minecraft
onesie age 9 girl fluffy
school shoes size 13 wide fit
trainers size 11 velcro kids
wellies size 10 kids lined
sandals size 9 closed toe kids
slippers size 8 kids dinosaur
party dress age 6 girl sparkly
suit age 7 boy wedding
bridesmaid dress age 8 pink
christmas jumper age 5 light up
halloween costume age 4 dinosaur
world book day costume age 6
sports kit age 10 football
dance leotard age 7 pink
school cardigan age 9 grey
winter hat and gloves set age 5
sun hat uv protection age 3
```

## Relevance Scoring Rules

For each returned product, check:

1. **Brand Match** (if query has brand)
   - Query: "nike trainers" → Product must contain "nike"
   
2. **Character Match** (if query has character)
   - Query: "paw patrol toys" → Product must contain "paw patrol"
   
3. **Product Type Match**
   - Query: "trainers" → Product must be footwear, not t-shirt
   
4. **Age Appropriateness** (if query has age)
   - Query: "toys for 3 year old" → Product should be age-appropriate
   
5. **Price Match** (if query has budget)
   - Query: "under £20" → Product price must be < £20
   
6. **Size Match** (if query has size)
   - Query: "size 10" → Product should mention size 10 or be filterable

## Scoring

```
PASS (✓): 80%+ of returned products are relevant
PARTIAL (⚠): 50-79% of returned products are relevant  
FAIL (✗): <50% relevant OR 0 results when products exist in DB
```

## Implementation for Replit

### Endpoint 1: Database Check
```
GET /api/audit/db-check?keywords=lego,star wars&max_price=30
```
Returns: Count and sample of matching products in database

### Endpoint 2: Search Quality Test
```
POST /api/audit/run
Body: { "queries": [...], "check_relevance": true }
```
Returns: Full audit results with relevance scoring

### Endpoint 3: Audit Dashboard
```
GET /audit-dashboard.html
```
Visual dashboard showing:
- Pass/Fail/Partial rates
- Worst performing queries
- Common issues
- Suggested fixes

## Output Files

1. **audit-results-[timestamp].json** - Full detailed results
2. **audit-summary-[timestamp].csv** - Quick overview for spreadsheet
3. **learning-data-[timestamp].json** - Failed queries for training

## What This Teaches Sunny

From the failures, we extract:
- Synonyms needed (e.g., "trainers" = "sneakers" = "shoes")
- Brand variations (e.g., "dr martens" = "dr. martens" = "doc martens")
- Character name variations (e.g., "paw patrol" = "PAW Patrol")
- Price filter patterns (e.g., "under £20" = "< 20" = "max 20")
- Size parsing (e.g., "size 10" = "UK 10" = "EU 28")

This becomes the training data for the learning loop.
