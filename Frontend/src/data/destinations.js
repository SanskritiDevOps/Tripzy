// Destination catalogue used by the hero search and "Trending" section.
// `gradient` gives every card a distinct sky without relying on remote images.

export const DESTINATIONS = [
  {
    id: 'jaipur', name: 'Jaipur', region: 'Rajasthan, India', lat: 26.9124, lng: 75.7873,
    tagline: 'Pink-city palaces, forts and bazaars', bestTime: 'Oct – Mar', avgDailyMinor: 450000,
    tags: ['Heritage', 'Food', 'Shopping'], trending: true,
    gradient: 'from-coral-400 via-coral-300 to-sand-200', emoji: '🏰',
  },
  {
    id: 'kyoto', name: 'Kyoto', region: 'Kansai, Japan', lat: 35.0116, lng: 135.7681,
    tagline: 'Temples, maple leaves and tea houses', bestTime: 'Nov, Apr', avgDailyMinor: 1200000,
    tags: ['Culture', 'Nature', 'Food'], trending: true,
    gradient: 'from-rose-400 via-orange-300 to-amber-200', emoji: '⛩️',
  },
  {
    id: 'goa', name: 'Goa', region: 'India', lat: 15.4909, lng: 73.8278,
    tagline: 'Beaches, shacks and sunset cruises', bestTime: 'Nov – Feb', avgDailyMinor: 400000,
    tags: ['Beach', 'Nightlife'], trending: true,
    gradient: 'from-ocean-500 via-ocean-300 to-sand-200', emoji: '🏖️',
  },
  {
    id: 'leh', name: 'Leh–Ladakh', region: 'Ladakh, India', lat: 34.1526, lng: 77.5771,
    tagline: 'High passes, monasteries and starry skies', bestTime: 'Jun – Sep', avgDailyMinor: 500000,
    tags: ['Adventure', 'Road trip'], trending: true,
    gradient: 'from-sky-600 via-sky-400 to-slate-200', emoji: '🏔️',
  },
  {
    id: 'bali', name: 'Bali', region: 'Indonesia', lat: -8.4095, lng: 115.1889,
    tagline: 'Rice terraces, surf and temple trails', bestTime: 'Apr – Oct', avgDailyMinor: 700000,
    tags: ['Beach', 'Wellness'], trending: true,
    gradient: 'from-emerald-500 via-teal-300 to-sand-200', emoji: '🌴',
  },
  {
    id: 'lisbon', name: 'Lisbon', region: 'Portugal', lat: 38.7223, lng: -9.1393,
    tagline: 'Tiled streets, trams and pastéis de nata', bestTime: 'Mar – Jun', avgDailyMinor: 1100000,
    tags: ['City', 'Food'], trending: true,
    gradient: 'from-amber-400 via-yellow-200 to-ocean-200', emoji: '🚋',
  },
  {
    id: 'udaipur', name: 'Udaipur', region: 'Rajasthan, India', lat: 24.5854, lng: 73.7125,
    tagline: 'Lakeside palaces and rooftop dinners', bestTime: 'Sep – Mar', avgDailyMinor: 500000,
    tags: ['Romantic', 'Heritage'],
    gradient: 'from-indigo-400 via-sky-300 to-sand-200', emoji: '🛶',
  },
  {
    id: 'hampi', name: 'Hampi', region: 'Karnataka, India', lat: 15.335, lng: 76.46,
    tagline: 'Boulder fields and ruined empires', bestTime: 'Oct – Feb', avgDailyMinor: 250000,
    tags: ['Heritage', 'Backpacking'],
    gradient: 'from-orange-500 via-amber-300 to-sand-200', emoji: '🪨',
  },
  {
    id: 'munnar', name: 'Munnar', region: 'Kerala, India', lat: 10.0889, lng: 77.0595,
    tagline: 'Misty tea estates and waterfalls', bestTime: 'Sep – May', avgDailyMinor: 350000,
    tags: ['Nature', 'Family'],
    gradient: 'from-green-600 via-emerald-300 to-sand-100', emoji: '🍃',
  },
  {
    id: 'istanbul', name: 'Istanbul', region: 'Türkiye', lat: 41.0082, lng: 28.9784,
    tagline: 'Bazaars, mosques and Bosphorus ferries', bestTime: 'Apr – May, Sep – Nov', avgDailyMinor: 900000,
    tags: ['City', 'History'],
    gradient: 'from-red-500 via-coral-300 to-sand-200', emoji: '🕌',
  },
  {
    id: 'singapore', name: 'Singapore', region: 'Singapore', lat: 1.3521, lng: 103.8198,
    tagline: 'Hawker food and garden skylines', bestTime: 'Feb – Apr', avgDailyMinor: 1300000,
    tags: ['City', 'Family'],
    gradient: 'from-fuchsia-500 via-pink-300 to-sand-200', emoji: '🌆',
  },
  {
    id: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand, India', lat: 30.0869, lng: 78.2676,
    tagline: 'Rafting, yoga and Ganga aarti', bestTime: 'Sep – Nov, Feb – May', avgDailyMinor: 250000,
    tags: ['Adventure', 'Wellness'],
    gradient: 'from-teal-600 via-ocean-300 to-sand-100', emoji: '🛕',
  },
]

export function findDestination(name) {
  if (!name) return null
  const needle = name.toLowerCase()
  return DESTINATIONS.find((d) => needle.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(needle)) ?? null
}
