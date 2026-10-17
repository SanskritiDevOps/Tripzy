// Built-in place suggestions for the example destinations, shown instantly while
// typing. Everything else comes from the OpenStreetMap search (GET /api/geo/search).

export const POI_CATALOG = {
  jaipur: [
    { name: 'Amber Fort', address: 'Devisinghpura, Amer, Jaipur', lat: 26.9855, lng: 75.8513, category: 'sight', durationMinutes: 180 },
    { name: 'Hawa Mahal', address: 'Badi Choupad, J.D.A. Market, Jaipur', lat: 26.9239, lng: 75.8267, category: 'sight', durationMinutes: 60 },
    { name: 'City Palace', address: 'Tulsi Marg, Gangori Bazaar, Jaipur', lat: 26.9258, lng: 75.8237, category: 'sight', durationMinutes: 120 },
    { name: 'Jantar Mantar', address: 'Gangori Bazaar, J.D.A. Market, Jaipur', lat: 26.9248, lng: 75.8246, category: 'sight', durationMinutes: 60 },
    { name: 'Nahargarh Fort', address: 'Krishna Nagar, Brahampuri, Jaipur', lat: 26.9373, lng: 75.8155, category: 'sight', durationMinutes: 120 },
    { name: 'Jal Mahal', address: 'Amer Road, Jaipur', lat: 26.9535, lng: 75.8463, category: 'sight', durationMinutes: 45 },
    { name: 'Albert Hall Museum', address: 'Ram Niwas Garden, Kailash Puri, Jaipur', lat: 26.9116, lng: 75.8195, category: 'sight', durationMinutes: 90 },
    { name: 'Galtaji Temple', address: 'Galta Ji, Jaipur', lat: 26.9172, lng: 75.8571, category: 'sight', durationMinutes: 90 },
    { name: 'Birla Mandir', address: 'Jawahar Lal Nehru Marg, Tilak Nagar, Jaipur', lat: 26.8921, lng: 75.8155, category: 'sight', durationMinutes: 45 },
    { name: 'Patrika Gate', address: 'Jawahar Circle, Malviya Nagar, Jaipur', lat: 26.8417, lng: 75.8031, category: 'sight', durationMinutes: 45 },
    { name: 'Panna Meena ka Kund', address: 'Amer, Jaipur', lat: 26.9866, lng: 75.8562, category: 'sight', durationMinutes: 30 },
    { name: 'Laxmi Mishthan Bhandar', address: 'Johari Bazaar, Jaipur', lat: 26.9229, lng: 75.8259, category: 'food', durationMinutes: 60 },
    { name: 'Rawat Mishthan Bhandar', address: 'Station Road, Sindhi Camp, Jaipur', lat: 26.918, lng: 75.795, category: 'food', durationMinutes: 45 },
    { name: 'Bar Palladio', address: 'Narain Niwas Palace, Kanota Bagh, Jaipur', lat: 26.9124, lng: 75.8125, category: 'food', durationMinutes: 90 },
    { name: 'Tapri Central', address: 'C-Scheme, Ashok Nagar, Jaipur', lat: 26.903, lng: 75.806, category: 'food', durationMinutes: 60 },
    { name: 'Suvarna Mahal', address: 'Rambagh Palace, Bhawani Singh Road, Jaipur', lat: 26.8981, lng: 75.8077, category: 'food', durationMinutes: 120 },
    { name: 'Johari Bazaar', address: 'Johari Bazaar Road, Jaipur', lat: 26.922, lng: 75.827, category: 'activity', durationMinutes: 90 },
    { name: 'Chokhi Dhani', address: 'Tonk Road, Sitapura, Jaipur', lat: 26.7676, lng: 75.8357, category: 'activity', durationMinutes: 180 },
    { name: 'Hot-air balloon ride, Amer', address: 'Amer Fort Road, Jaipur', lat: 26.98, lng: 75.845, category: 'activity', durationMinutes: 150 },
    { name: 'Samode Haveli', address: 'Gangapole, Jaipur', lat: 26.933, lng: 75.832, category: 'stay', durationMinutes: 30 },
    { name: 'Jaipur International Airport', address: 'Airport Road, Sanganer, Jaipur', lat: 26.8242, lng: 75.8122, category: 'transit', durationMinutes: 60 },
    { name: 'Jaipur Junction', address: 'Station Road, Gopalbari, Jaipur', lat: 26.9196, lng: 75.7878, category: 'transit', durationMinutes: 45 },
  ],
  kyoto: [
    { name: 'Fushimi Inari Taisha', address: '68 Fukakusa Yabunouchicho, Fushimi Ward', lat: 34.9671, lng: 135.7727, category: 'sight', durationMinutes: 150 },
    { name: 'Kinkaku-ji', address: '1 Kinkakujicho, Kita Ward', lat: 35.0394, lng: 135.7292, category: 'sight', durationMinutes: 75 },
    { name: 'Arashiyama Bamboo Grove', address: 'Sagaogurayama Tabuchiyamacho, Ukyo Ward', lat: 35.017, lng: 135.6713, category: 'sight', durationMinutes: 90 },
    { name: 'Kiyomizu-dera', address: '1-294 Kiyomizu, Higashiyama Ward', lat: 34.9949, lng: 135.785, category: 'sight', durationMinutes: 90 },
    { name: 'Ginkaku-ji', address: '2 Ginkakujicho, Sakyo Ward', lat: 35.027, lng: 135.7982, category: 'sight', durationMinutes: 60 },
    { name: 'Philosopher’s Path', address: 'Sakyo Ward', lat: 35.0213, lng: 135.7943, category: 'activity', durationMinutes: 60 },
    { name: 'Gion District', address: 'Gionmachi, Higashiyama Ward', lat: 35.0037, lng: 135.7788, category: 'activity', durationMinutes: 90 },
    { name: 'Nishiki Market', address: 'Nakagyo Ward', lat: 35.005, lng: 135.7649, category: 'food', durationMinutes: 75 },
    { name: 'Ippudo Nishikikoji', address: 'Higashinotoin, Nakagyo Ward', lat: 35.0049, lng: 135.7608, category: 'food', durationMinutes: 45 },
    { name: 'Kyoto Station', address: 'Higashishiokojicho, Shimogyo Ward', lat: 34.9858, lng: 135.7588, category: 'transit', durationMinutes: 30 },
    { name: 'Hotel The Celestine Kyoto Gion', address: '572 Komatsucho, Higashiyama Ward', lat: 34.9984, lng: 135.776, category: 'stay', durationMinutes: 30 },
  ],
  goa: [
    { name: 'Baga Beach', address: 'Baga, North Goa', lat: 15.5553, lng: 73.7517, category: 'sight', durationMinutes: 180 },
    { name: 'Fort Aguada', address: 'Candolim, North Goa', lat: 15.4925, lng: 73.7737, category: 'sight', durationMinutes: 60 },
    { name: 'Basilica of Bom Jesus', address: 'Old Goa', lat: 15.5009, lng: 73.9116, category: 'sight', durationMinutes: 60 },
    { name: 'Fontainhas', address: 'Panaji', lat: 15.4977, lng: 73.8336, category: 'activity', durationMinutes: 90 },
    { name: 'Thalassa', address: 'Siolim, North Goa', lat: 15.6031, lng: 73.7399, category: 'food', durationMinutes: 120 },
    { name: 'Gunpowder', address: 'Assagao, North Goa', lat: 15.5937, lng: 73.7705, category: 'food', durationMinutes: 90 },
    { name: 'Anjuna Flea Market', address: 'Anjuna, North Goa', lat: 15.5735, lng: 73.7407, category: 'activity', durationMinutes: 120 },
    { name: 'Dudhsagar Falls', address: 'Sonaulim, Goa', lat: 15.3144, lng: 74.3143, category: 'activity', durationMinutes: 300 },
    { name: 'Manohar International Airport', address: 'Mopa, North Goa', lat: 15.7302, lng: 73.8636, category: 'transit', durationMinutes: 60 },
  ],
}

/** Matches the built-in suggestions on name and address. */
export function searchPlaces(destinationId, query) {
  const needle = query.trim().toLowerCase()
  const pool = POI_CATALOG[destinationId] ?? Object.values(POI_CATALOG).flat()
  if (!needle) return pool.slice(0, 8)
  return pool.filter((p) => p.name.toLowerCase().includes(needle) || p.address.toLowerCase().includes(needle)).slice(0, 8)
}
