import fs from 'fs';
import path from 'path';

interface LocationData {
  town: string;
  region: string;
  country: string;
}

const townToRegions: Map<string, Set<string>> = new Map();
const regionToCounty: Map<string, string> = new Map();
let loaded = false;

const WEST_MIDLANDS_REGIONS = [
  'Birmingham', 'Coventry', 'Dudley', 'Sandwell', 'Solihull', 
  'Walsall', 'Wolverhampton', 'West Midlands'
];

const GREATER_MANCHESTER_REGIONS = [
  'Bolton', 'Bury', 'Manchester', 'Oldham', 'Rochdale',
  'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan'
];

const GREATER_LONDON_REGIONS = [
  'Barking and Dagenham', 'Barnet', 'Bexley', 'Brent', 'Bromley',
  'Camden', 'City of London', 'Croydon', 'Ealing', 'Enfield',
  'Greenwich', 'Hackney', 'Hammersmith and Fulham', 'Haringey',
  'Harrow', 'Havering', 'Hillingdon', 'Hounslow', 'Islington',
  'Kensington and Chelsea', 'Kingston upon Thames', 'Lambeth',
  'Lewisham', 'Merton', 'Newham', 'Redbridge', 'Richmond upon Thames',
  'Southwark', 'Sutton', 'Tower Hamlets', 'Waltham Forest',
  'Wandsworth', 'Westminster', 'London'
];

const YORKSHIRE_REGIONS = [
  'Barnsley', 'Bradford', 'Calderdale', 'Doncaster', 'East Riding of Yorkshire',
  'Kingston upon Hull', 'Kirklees', 'Leeds', 'North Yorkshire', 'Rotherham',
  'Sheffield', 'Wakefield', 'York', 'South Yorkshire', 'West Yorkshire'
];

function loadLocations() {
  if (loaded) return;
  
  try {
    const csvPath = path.join(process.cwd(), 'server/data/uk-postcodes.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').slice(1);
    
    for (const line of lines) {
      const match = line.match(/"([^"]*)","\d+","\d+","[^"]*","[^"]*","([^"]*)","([^"]*)","[^"]*","([^"]*)"/);
      if (match) {
        const [, , town, region, country] = match;
        if (town && region) {
          const townLower = town.toLowerCase();
          if (!townToRegions.has(townLower)) {
            townToRegions.set(townLower, new Set());
          }
          townToRegions.get(townLower)!.add(region);
          
          if (country) {
            regionToCounty.set(region.toLowerCase(), country);
          }
        }
      }
    }
    
    loaded = true;
    console.log(`Loaded ${townToRegions.size} UK town/region mappings`);
  } catch (err) {
    console.error('Failed to load UK locations:', err);
  }
}

export function expandLocation(location: string): string[] {
  loadLocations();
  
  const locLower = location.toLowerCase().trim();
  const results = new Set<string>();
  
  results.add(location);
  
  const directRegions = townToRegions.get(locLower);
  if (directRegions) {
    directRegions.forEach(r => results.add(r));
  }
  
  if (WEST_MIDLANDS_REGIONS.some(r => r.toLowerCase() === locLower)) {
    results.add('West Midlands');
    results.add('Midlands');
    WEST_MIDLANDS_REGIONS.forEach(r => results.add(r));
  }
  
  if (GREATER_MANCHESTER_REGIONS.some(r => r.toLowerCase() === locLower)) {
    results.add('Greater Manchester');
    results.add('North West');
    GREATER_MANCHESTER_REGIONS.forEach(r => results.add(r));
  }
  
  if (GREATER_LONDON_REGIONS.some(r => r.toLowerCase() === locLower)) {
    results.add('Greater London');
    results.add('London');
    results.add('South East');
  }
  
  if (YORKSHIRE_REGIONS.some(r => r.toLowerCase() === locLower)) {
    results.add('Yorkshire');
    results.add('Yorkshire and the Humber');
    YORKSHIRE_REGIONS.forEach(r => results.add(r));
  }
  
  const manualExpansions: Record<string, string[]> = {
    'birmingham': ['Birmingham', 'West Midlands', 'Midlands', 'Solihull', 'Dudley', 'Walsall', 'Wolverhampton', 'Sandwell'],
    'manchester': ['Manchester', 'Greater Manchester', 'North West', 'Salford', 'Trafford', 'Stockport'],
    'london': ['London', 'Greater London', 'South East', 'Central London'],
    'leeds': ['Leeds', 'West Yorkshire', 'Yorkshire'],
    'liverpool': ['Liverpool', 'Merseyside', 'North West'],
    'sheffield': ['Sheffield', 'South Yorkshire', 'Yorkshire'],
    'bristol': ['Bristol', 'South West', 'South Gloucestershire'],
    'newcastle': ['Newcastle', 'Newcastle upon Tyne', 'Tyne and Wear', 'North East'],
    'nottingham': ['Nottingham', 'Nottinghamshire', 'East Midlands'],
    'leicester': ['Leicester', 'Leicestershire', 'East Midlands'],
    'cardiff': ['Cardiff', 'South Wales', 'Wales'],
    'edinburgh': ['Edinburgh', 'City of Edinburgh', 'Lothian', 'Scotland'],
    'glasgow': ['Glasgow', 'City of Glasgow', 'Strathclyde', 'Scotland'],
    'brighton': ['Brighton', 'Brighton and Hove', 'East Sussex', 'South East'],
    'oxford': ['Oxford', 'Oxfordshire', 'South East'],
    'cambridge': ['Cambridge', 'Cambridgeshire', 'East Anglia'],
    'york': ['York', 'North Yorkshire', 'Yorkshire'],
    'bath': ['Bath', 'Bath and North East Somerset', 'Somerset', 'South West'],
    'exeter': ['Exeter', 'Devon', 'South West'],
    'coventry': ['Coventry', 'West Midlands', 'Midlands'],
    'wolverhampton': ['Wolverhampton', 'West Midlands', 'Midlands'],
    'dudley': ['Dudley', 'West Midlands', 'Midlands'],
    'solihull': ['Solihull', 'West Midlands', 'Midlands', 'Birmingham']
  };
  
  if (manualExpansions[locLower]) {
    manualExpansions[locLower].forEach(r => results.add(r));
  }
  
  return Array.from(results);
}

export function getRegionForTown(town: string): string | null {
  loadLocations();
  const regions = townToRegions.get(town.toLowerCase());
  return regions ? Array.from(regions)[0] : null;
}
