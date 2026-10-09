import {
  BedDouble,
  Camera,
  Car,
  Package,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  MapPin,
  FileText,
  Shirt,
  Droplets,
  Plug,
  Pill,
  Backpack,
} from 'lucide-react'

// Place / itinerary categories. README enum: food, sight, stay, activity, other.
// `transit` is added for airports, stations and transfers in the itinerary.
export const PLACE_CATEGORIES = {
  sight: { label: 'Sight', icon: Camera, badge: 'bg-ocean-50 text-ocean-700 ring-ocean-200', dot: 'bg-ocean-500', hex: '#238898' },
  food: { label: 'Food', icon: UtensilsCrossed, badge: 'bg-coral-50 text-coral-700 ring-coral-200', dot: 'bg-coral-500', hex: '#f15f2e' },
  stay: { label: 'Stay', icon: BedDouble, badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500', hex: '#7c3aed' },
  activity: { label: 'Activity', icon: Sparkles, badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', hex: '#d97706' },
  transit: { label: 'Transit', icon: TrainFront, badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', hex: '#0284c7' },
  other: { label: 'Other', icon: MapPin, badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-500', hex: '#64748b' },
}

export const PLACE_CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES)

// Expense categories power the category-wise budget breakdown.
export const EXPENSE_CATEGORIES = {
  stay: { label: 'Stay', icon: BedDouble, bar: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700' },
  transit: { label: 'Transport', icon: Car, bar: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700' },
  food: { label: 'Food & drinks', icon: UtensilsCrossed, bar: 'bg-coral-500', soft: 'bg-coral-50 text-coral-700' },
  activity: { label: 'Activities', icon: Ticket, bar: 'bg-amber-500', soft: 'bg-amber-50 text-amber-800' },
  shopping: { label: 'Shopping', icon: ShoppingBag, bar: 'bg-pink-500', soft: 'bg-pink-50 text-pink-700' },
  other: { label: 'Other', icon: Package, bar: 'bg-slate-500', soft: 'bg-slate-100 text-slate-700' },
}

export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES)

export const SPLIT_TYPES = {
  EQUAL: { label: 'Equally', hint: 'Everyone selected pays the same' },
  EXACT: { label: 'Exact amounts', hint: 'Type each person’s share' },
  PERCENT: { label: 'Percentages', hint: 'Shares must total 100%' },
}

export const PACKING_CATEGORIES = {
  documents: { label: 'Documents', icon: FileText },
  clothing: { label: 'Clothing', icon: Shirt },
  toiletries: { label: 'Toiletries', icon: Droplets },
  electronics: { label: 'Electronics', icon: Plug },
  health: { label: 'Health', icon: Pill },
  gear: { label: 'Gear & misc', icon: Backpack },
}

export const PACKING_CATEGORY_KEYS = Object.keys(PACKING_CATEGORIES)

export const GROUP_TYPES = [
  { value: 'friends', label: 'Friends' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
  { value: 'solo', label: 'Solo' },
  { value: 'work', label: 'Work offsite' },
]
