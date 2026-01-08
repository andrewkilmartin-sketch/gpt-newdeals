export interface CinemaMovie {
  id: string;
  title: string;
  synopsis: string;
  poster: string | null;
  backdrop: string | null;
  releaseDate: string;
  rating: number;
  bbfcRating: string;
  genres: string[];
  runtime: number;
  cast: string[];
  director: string;
  tagline: string | null;
  status: "now_playing" | "upcoming";
  trailerUrl: string | null;
}

export const UK_CINEMA_MOVIES: CinemaMovie[] = [
  {
    id: "cinema-avatar-fire-ash",
    title: "Avatar: Fire and Ash",
    synopsis: "James Cameron returns to Pandora for the third instalment of the epic Avatar saga. Jake Sully and Neytiri must protect their family and their world as new threats emerge from both human colonizers and the discovery of the Ash People, a volcanic Na'vi clan with mysterious powers.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-19",
    rating: 0,
    bbfcRating: "12A",
    genres: ["Sci-Fi", "Adventure", "Action", "Fantasy"],
    runtime: 180,
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver", "Stephen Lang", "Kate Winslet"],
    director: "James Cameron",
    tagline: "Return to Pandora",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-housemaid",
    title: "The Housemaid",
    synopsis: "A young woman takes a job as a housemaid for a wealthy couple, only to discover dark secrets lurking within the walls of their stunning estate. As she becomes entangled in their twisted world, she must fight to survive their dangerous games. Based on the bestselling novel.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 0,
    bbfcRating: "15",
    genres: ["Thriller", "Drama", "Mystery"],
    runtime: 115,
    cast: ["Sydney Sweeney", "Amanda Seyfried", "Brandon Sklenar"],
    director: "Paul Feig",
    tagline: "Every house has its secrets",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-marty-supreme",
    title: "Marty Supreme",
    synopsis: "A drama chronicling the rise and fall of a legendary ping-pong champion in 1950s New York. Timothee Chalamet delivers a powerful performance as the eccentric sportsman whose obsessive pursuit of perfection leads him down a path of self-destruction.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 0,
    bbfcRating: "15",
    genres: ["Drama", "Biography", "Sport"],
    runtime: 128,
    cast: ["Timothee Chalamet", "Gwyneth Paltrow", "Penn Badgley", "Abel Tesfaye"],
    director: "Josh Safdie",
    tagline: "Champion. Legend. Obsession.",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-spongebob-squarepants",
    title: "The SpongeBob Movie: Search for SquarePants",
    synopsis: "When SpongeBob's beloved pet snail Gary goes missing, SpongeBob and Patrick embark on an epic adventure beyond Bikini Bottom to find him. Along the way, they encounter new friends, dangerous foes, and discover the true meaning of friendship.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 0,
    bbfcRating: "U",
    genres: ["Animation", "Adventure", "Comedy", "Family"],
    runtime: 95,
    cast: ["Tom Kenny", "Bill Fagerbakke", "Clancy Brown", "Rodger Bumpass"],
    director: "Derek Drymon",
    tagline: "The search is on",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-anaconda",
    title: "Anaconda",
    synopsis: "A group of old friends reunite for a nostalgic trip to the Amazon, seeking to reconnect with their youth. But their adventure takes a terrifying turn when they encounter a legendary giant snake with an insatiable appetite. A comedic reimagining of the 1997 cult classic.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-25",
    rating: 0,
    bbfcRating: "15",
    genres: ["Action", "Adventure", "Comedy", "Horror"],
    runtime: 110,
    cast: ["Jack Black", "Paul Rudd", "Steve Zahn"],
    director: "Tom Gormican",
    tagline: "Old friends. New bite.",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-fnaf2",
    title: "Five Nights at Freddy's 2",
    synopsis: "The terrifying animatronics return in this sequel to the hit horror film. When a new night guard takes a job at Freddy Fazbear's Mega Pizzaplex, she uncovers the horrifying truth behind the franchise's dark past. The nightmares are just beginning.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-05",
    rating: 0,
    bbfcRating: "15",
    genres: ["Horror", "Mystery", "Thriller"],
    runtime: 105,
    cast: ["Josh Hutcherson", "Elizabeth Lail", "Matthew Lillard"],
    director: "Emma Tammi",
    tagline: "The nightmare continues",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-hamnet",
    title: "Hamnet",
    synopsis: "Set in 1580s Stratford-upon-Avon, this deeply moving drama follows Agnes Hathaway as she navigates marriage to William Shakespeare and the devastating loss of their young son Hamnet. A meditation on grief, love, and how tragedy transforms into art. Based on Maggie O'Farrell's award-winning novel.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-12",
    rating: 0,
    bbfcRating: "12A",
    genres: ["Drama", "History", "Romance"],
    runtime: 125,
    cast: ["Jessie Buckley", "Paul Mescal"],
    director: "Chloe Zhao",
    tagline: "Before the masterpiece, there was heartbreak",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-sentimental-value",
    title: "Sentimental Value",
    synopsis: "A poignant drama exploring the complex dynamics of a family gathering after the death of their patriarch. As siblings sort through decades of memories and possessions, old wounds resurface and long-buried secrets come to light.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 0,
    bbfcRating: "15",
    genres: ["Drama"],
    runtime: 118,
    cast: ["Renate Reinsve", "Stellan Skarsgard"],
    director: "Jacques Audiard",
    tagline: "What we leave behind",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-song-sung-blue",
    title: "Song Sung Blue",
    synopsis: "A moving musical biopic following the extraordinary life of Neil Diamond, from his humble beginnings in Brooklyn to becoming one of the best-selling musicians of all time. Hugh Jackman transforms into the legendary singer-songwriter in this celebration of music and perseverance.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-01-01",
    rating: 0,
    bbfcRating: "12A",
    genres: ["Biography", "Drama", "Musical"],
    runtime: 140,
    cast: ["Hugh Jackman", "Kate Hudson"],
    director: "Unknown",
    tagline: "Sweet Caroline, good times never seemed so good",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-soulm8te",
    title: "SOULM8TE",
    synopsis: "In the near future, a grieving widower acquires an AI companion to help cope with his loneliness. But as the android becomes increasingly possessive and self-aware, he realizes too late that his perfect partner has a deadly agenda. A chilling exploration of artificial intelligence and the dangers of emotional dependency.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-01-09",
    rating: 0,
    bbfcRating: "15",
    genres: ["Horror", "Sci-Fi", "Thriller"],
    runtime: 100,
    cast: ["Unknown"],
    director: "James Wan",
    tagline: "Love is a dangerous program",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-greenland2",
    title: "Greenland 2: Migration",
    synopsis: "The Garrity family emerges from their bunker after the apocalyptic comet strike to find a world forever changed. Facing lawless survivors and environmental catastrophe, they must journey across post-apocalyptic Europe in search of a new home and hope for humanity's future.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-01-09",
    rating: 0,
    bbfcRating: "15",
    genres: ["Action", "Thriller", "Sci-Fi", "Disaster"],
    runtime: 110,
    cast: ["Gerard Butler", "Morena Baccarin", "Roger Dale Floyd", "Scott Glenn"],
    director: "Ric Roman Waugh",
    tagline: "Survival was just the beginning",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-28-years-later-bone-temple",
    title: "28 Years Later: The Bone Temple",
    synopsis: "Nearly three decades after the Rage virus decimated Britain, isolated communities have formed in the quarantine zone. When a group of survivors discovers a possible cure, they must traverse the dangerous infected lands to reach a mysterious sanctuary known as the Bone Temple. The second film in Danny Boyle's new trilogy.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-01-16",
    rating: 0,
    bbfcRating: "18",
    genres: ["Horror", "Thriller", "Sci-Fi"],
    runtime: 125,
    cast: ["Ralph Fiennes", "Jack O'Connell", "Jodie Comer", "Aaron Taylor-Johnson"],
    director: "Danny Boyle",
    tagline: "The rage never died",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-return-silent-hill",
    title: "Return to Silent Hill",
    synopsis: "James Sunderland receives a letter from his deceased wife, beckoning him to the fog-shrouded town of Silent Hill. As he searches for answers, he encounters nightmarish creatures and must confront the darkest corners of his own psyche. A faithful adaptation of the beloved survival horror game Silent Hill 2.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-01-23",
    rating: 0,
    bbfcRating: "18",
    genres: ["Horror", "Mystery", "Thriller"],
    runtime: 115,
    cast: ["Jeremy Irvine", "Hannah Emily Anderson"],
    director: "Christophe Gans",
    tagline: "In my restless dreams, I see that town",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-wuthering-heights",
    title: "Wuthering Heights",
    synopsis: "Emerald Fennell's bold reimagining of Emily Bronte's classic novel of obsessive love and revenge on the Yorkshire moors. Heathcliff and Catherine's doomed romance unfolds across generations, exploring themes of class, passion, and the destruction wrought by unfulfilled desire.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-02-13",
    rating: 0,
    bbfcRating: "15",
    genres: ["Drama", "Romance", "Period"],
    runtime: 135,
    cast: ["Margot Robbie", "Jacob Elordi"],
    director: "Emerald Fennell",
    tagline: "A love that haunts eternity",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-scream7",
    title: "Scream 7",
    synopsis: "Ghostface returns to terrorize a new generation of victims in this latest instalment of the iconic slasher franchise. When a series of brutal murders rocks a college campus, a group of students must uncover the killer's identity before becoming the next victims.",
    poster: null,
    backdrop: null,
    releaseDate: "2026-02-27",
    rating: 0,
    bbfcRating: "18",
    genres: ["Horror", "Mystery", "Thriller"],
    runtime: 115,
    cast: ["Neve Campbell", "Courteney Cox", "Mason Gooding", "Jenna Ortega"],
    director: "Kevin Williamson",
    tagline: "New rules. Same game.",
    status: "upcoming",
    trailerUrl: null
  },
  {
    id: "cinema-bugonia",
    title: "Bugonia",
    synopsis: "Two conspiracy theorists kidnap the CEO of a major corporation, convinced she's an alien plotting to destroy the Earth. As they hold her captive demanding the truth, lines between reality and delusion blur in this darkly comedic thriller from visionary director Yorgos Lanthimos.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-19",
    rating: 0,
    bbfcRating: "15",
    genres: ["Comedy", "Thriller", "Sci-Fi"],
    runtime: 110,
    cast: ["Emma Stone", "Jesse Plemons"],
    director: "Yorgos Lanthimos",
    tagline: "The truth is out there. Maybe.",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-bowie-final-act",
    title: "Bowie: The Final Act",
    synopsis: "An intimate documentary exploring David Bowie's extraordinary final years, from his secret battle with cancer to the creation of his acclaimed albums 'The Next Day' and 'Blackstar'. Featuring rare footage, exclusive interviews, and never-before-seen performances.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 0,
    bbfcRating: "12A",
    genres: ["Documentary", "Music", "Biography"],
    runtime: 98,
    cast: ["David Bowie"],
    director: "Francis Whately",
    tagline: "The final chapter of a legend",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-devils-backbone-rerelease",
    title: "The Devil's Backbone",
    synopsis: "Guillermo del Toro's haunting 2001 masterpiece returns to UK cinemas in a stunning 4K restoration. Set during the Spanish Civil War, a young orphan discovers the ghost of a murdered boy and uncovers dark secrets at his remote orphanage. A gothic tale of loss, revenge, and the horrors of war.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-12-26",
    rating: 8.1,
    bbfcRating: "15",
    genres: ["Horror", "Drama", "Mystery", "War"],
    runtime: 106,
    cast: ["Marisa Paredes", "Eduardo Noriega", "Federico Luppi"],
    director: "Guillermo del Toro",
    tagline: "What is a ghost?",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-paddington-peru",
    title: "Paddington in Peru",
    synopsis: "Paddington returns to Peru to visit his beloved Aunt Lucy, who now resides at the Home for Retired Bears. With the Brown Family in tow, a thrilling adventure ensues when a mystery plunges them into an unexpected journey through the Amazon rainforest and up to the mountain peaks of Peru.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-11-08",
    rating: 7.5,
    bbfcRating: "PG",
    genres: ["Adventure", "Comedy", "Family"],
    runtime: 106,
    cast: ["Ben Whishaw", "Hugh Bonneville", "Emily Mortimer", "Olivia Colman", "Antonio Banderas"],
    director: "Dougal Wilson",
    tagline: "The adventure of a lifetime",
    status: "now_playing",
    trailerUrl: null
  },
  {
    id: "cinema-wicked-part-two",
    title: "Wicked Part Two",
    synopsis: "The thrilling conclusion to the two-part musical adaptation continues as Elphaba embraces her identity as the Wicked Witch of the West, while Glinda faces a choice between friendship and power. As the land of Oz descends into chaos, both witches must confront their destinies.",
    poster: null,
    backdrop: null,
    releaseDate: "2025-11-21",
    rating: 0,
    bbfcRating: "PG",
    genres: ["Fantasy", "Musical", "Drama"],
    runtime: 160,
    cast: ["Cynthia Erivo", "Ariana Grande", "Jonathan Bailey", "Jeff Goldblum", "Michelle Yeoh"],
    director: "Jon M. Chu",
    tagline: "Defy gravity",
    status: "now_playing",
    trailerUrl: null
  }
];

export function searchCinemaMovies(
  query?: string,
  genre?: string,
  status?: "now_playing" | "upcoming",
  limit: number = 10
): CinemaMovie[] {
  const minDate = "2025-11-01";
  let movies = UK_CINEMA_MOVIES.filter(m => m.releaseDate >= minDate);

  if (query) {
    const lowerQuery = query.toLowerCase();
    movies = movies.filter(m => 
      m.title.toLowerCase().includes(lowerQuery) ||
      m.synopsis.toLowerCase().includes(lowerQuery) ||
      m.cast.some(c => c.toLowerCase().includes(lowerQuery)) ||
      m.director.toLowerCase().includes(lowerQuery)
    );
  }

  if (genre) {
    const lowerGenre = genre.toLowerCase();
    movies = movies.filter(m => 
      m.genres.some(g => g.toLowerCase().includes(lowerGenre))
    );
  }

  if (status) {
    movies = movies.filter(m => m.status === status);
  }

  movies.sort((a, b) => {
    if (a.status === "now_playing" && b.status === "upcoming") return -1;
    if (a.status === "upcoming" && b.status === "now_playing") return 1;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });

  return movies.slice(0, limit);
}
