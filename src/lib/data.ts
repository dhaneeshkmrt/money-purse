'use client';
import type { Category, Settings } from '@/lib/types';
import {
  CircleDollarSign,
  Calendar,
  Utensils,
  Gift,
  HeartPulse,
  Plane,
  ShieldAlert,
  Home,
  Briefcase,
  User,
  Building,
  Apple,
  RefreshCw,
} from 'lucide-react';

// This data is used to seed the database on first run if it's empty.
export const categories: Omit<Category, 'id' | 'tenantId'>[] = [
  {
    name: 'Monthly',
    icon: Calendar,
    budget: 50000,
    description: 'Regular recurring household expenses, daily groceries, kitchen items, vegetables, milk, food, travel, and home utility expenses.',
    subcategories: [
      { id: 'monthly_grocery', name: 'Grocery', description: 'Supermarket items, provisions, spices, flour (kadala mavu), curd, noodles, coconut, and general grocery shopping.', microcategories: [] },
      { id: 'monthly_veg', name: 'Veg', description: 'Fresh vegetables, onion, tomato, curry leaves, garlic (poondu), lemon, greens, and quick commerce veggie orders.', microcategories: [] },
      { id: 'monthly_non_veg', name: 'Non-veg', description: 'Chicken, mutton, mutton keema, fish, seafood, and meat purchases.', microcategories: [] },
      { id: 'monthly_egg', name: 'Egg', description: 'Egg trays, bulk egg purchases (e.g. 30 eggs), and daily egg items.', microcategories: [] },
      { id: 'monthly_milk', name: 'Milk', description: 'Daily milk, packet milk, cow milk (Country Delight), milk for sweets/payasam.', microcategories: [] },
      { id: 'monthly_fruits_juice', name: 'Fruits & Juice', description: 'Fresh fruits (banana, rambutan, apples, oranges), tender coconut, fresh juices, sugarcane juice (karumbu juice), karuku.', microcategories: [] },
      { id: 'monthly_food', name: 'Food', description: 'Restaurant meals, takeaway, dining out, briyani, parota, kothu parota, tiffin, fast food.', microcategories: [] },
      { id: 'monthly_snacks_sweets', name: 'Snacks and Sweets', description: 'Sweets (laddu, boonthi, kadala mittai), savory snacks, samosa, puffs, evening snacks, shawarma.', microcategories: [] },
      { id: 'monthly_travel_petrol', name: 'travel/petrol', description: 'Auto rickshaw fares, petrol, bus/train travel, city commute, cab/taxi fares.', microcategories: [] },
      { id: 'monthly_home_maintenance', name: 'Home Maintenance', description: 'Home repair tools, grinding stone (kalvam), plumbing, cleaning supplies, and house maintenance.', microcategories: [] },
      { id: 'monthly_wfo', name: 'WFO', description: 'Work from office expenses, room rent, office commute, and remote work costs.', microcategories: [] },
      { id: 'monthly_gas', name: 'Gas', description: 'LPG gas cylinder refills and gas connection expenses.', microcategories: [] },
      { id: 'monthly_electrical', name: 'Electrical', description: 'Electrical equipment, bulbs, appliance maintenance, and repairs.', microcategories: [] },
      { id: 'monthly_others', name: 'Others', description: 'Miscellaneous monthly household items not covered by other subcategories.', microcategories: [] },
    ],
  },
  {
    name: 'Medical',
    icon: HeartPulse,
    budget: 20000,
    description: 'Health, medical, diagnostic, pharmacy, and insurance expenses for family healthcare.',
    subcategories: [
      { id: 'medical_health_insurance', name: 'Health Insurance', description: 'Health insurance policies and top-up premiums (e.g. HDFC Ergo health insurance).', microcategories: [] },
      { id: 'medical_medical_bill', name: 'Medical Bill', description: 'Pharmacy medicines, nebulizers, inhalers, cough syrups, cold capsules, nasal drops, vaporizers, doctor consultation fees.', microcategories: [] },
      { id: 'medical_term_insurance', name: 'Term Insurance', description: 'Life and term insurance policy premiums.', microcategories: [] },
      { id: 'medical_lab_test', name: 'Lab test', description: 'Blood tests, diagnostic scans, health check equipment (thermometer, BP monitor, temperature check machine).', microcategories: [] },
      { id: 'medical_hospital_bill', name: 'Hospital Bill', description: 'Hospital admission, surgery, clinic treatment, and hospital charges.', microcategories: [] },
      { id: 'medical_pregnancy', name: 'Pregnancy', description: 'Maternity, prenatal checkups, scans, and pregnancy care.', microcategories: [] },
      { id: 'medical_travel', name: 'Travel', description: 'Travel to hospitals, clinics, or medical centers.', microcategories: [] },
      { id: 'medical_food', name: 'Food', description: 'Dietary food or special nutrition during illness or hospital stay.', microcategories: [] },
      { id: 'medical_others', name: 'Others', description: 'Other medical supplies and healthcare items.', microcategories: [] },
    ],
  },
  {
    name: 'Dk',
    icon: User,
    budget: 10000,
    description: 'Personal expenses, subscriptions, recharges, grooming, and personal gifts/loans for Dk.',
    subcategories: [
      { id: 'dk_personal_grooming', name: 'Personal Grooming', description: 'Haircut, salon, grooming products, and personal styling.', microcategories: [] },
      { id: 'dk_mobile_internet', name: 'Mobile&Internet', description: 'Mobile phone recharge (Jio/Airtel), Wi-Fi bills, broadband internet.', microcategories: [] },
      { id: 'dk_gift', name: 'Gift', description: 'Temple/kovil electricity bills, treats for colleagues/friends, small gifts.', microcategories: [] },
      { id: 'dk_borrow', name: 'Borrow', description: 'Money lent/borrowed for trips, friends, or temporary borrowing.', microcategories: [] },
    ],
  },
  {
    name: 'Nisha',
    icon: User,
    budget: 10000,
    description: 'Personal expenses, grooming, certificates, and personal needs for Nisha.',
    subcategories: [
      { id: 'nisha_personal_grooming', name: 'Personal Grooming', description: 'Personal grooming, salon, document photocopies (Xerox), Aadhar fees, exam fees.', microcategories: [] },
    ],
  },
  {
    name: 'Nivi',
    icon: Apple,
    budget: 2000,
    description: 'Child expenses, baby grooming, diapers, toys, and care for Nivi.',
    subcategories: [
      { id: 'nivi_toys', name: 'Toys', description: 'Toys (minions, LED balls, toy phones, learning toys).', microcategories: [] },
      { id: 'nivi_grooming', name: 'Grooming', description: 'Baby diapers, cloth diapers, baby skincare, baby grooming.', microcategories: [] },
    ],
  },
  {
    name: 'Gift',
    icon: Gift,
    budget: 10000,
    description: 'Gifts, treats, donations, and presents for relatives, friends, and special occasions.',
    subcategories: [
      { id: 'gift_close_relatives', name: 'Close Relatives', description: 'Birthday gifts, sweets/fruits for family members/relatives (anna house, chitti, nieces/nephews).', microcategories: [] },
      { id: 'gift_relatives', name: 'Relatives', description: 'Gifts and financial contributions for extended family and family functions.', microcategories: [] },
      { id: 'gift_friends', name: 'Friends', description: 'Gifts, wedding presents, and treats for friends.', microcategories: [] },
      { id: 'gift_neighbour', name: 'Neighbour', description: 'Festival gifts and goodwill treats for neighbours.', microcategories: [] },
      { id: 'gift_donation', name: 'Donation', description: 'Charitable donations, temple contributions, and social causes.', microcategories: [] },
    ],
  },
  {
    name: 'Tour',
    icon: Plane,
    budget: 10000,
    description: 'Vacation, travel trips, outings, tourism, and holiday expenses.',
    subcategories: [
      { id: 'tour_travel', name: 'Travel', description: 'Flight tickets, train tickets, bus fares, toll charges, road trip vehicle fuel.', microcategories: [] },
      { id: 'tour_stay', name: 'Stay', description: 'Hotel bookings, resorts, homestays, lodges.', microcategories: [] },
      { id: 'tour_food', name: 'Food', description: 'Food, meals, snacks, and tiffin during travel/tours.', microcategories: [] },
      { id: 'tour_entry_fee', name: 'Entry Fee', description: 'Sightseeing entry tickets, museum passes, theme park tickets.', microcategories: [] },
      { id: 'tour_shopping', name: 'Shopping', description: 'Souvenirs and shopping during trips.', microcategories: [] },
      { id: 'tour_tips_donation', name: 'Tips+Donation', description: 'Tips for drivers/guides, temple offerings during travel.', microcategories: [] },
      { id: 'tour_outing', name: 'Outing', description: 'Local day trips, family outings, picnic activities.', microcategories: [] },
      { id: 'tour_outing_food', name: 'Outing Food', description: 'Snacks and food during local day outings.', microcategories: [] },
    ],
  },
  {
    name: 'Emergency',
    icon: ShieldAlert,
    budget: 8000,
    description: 'Unforeseen urgent expenses, emergency repairs, urgent family needs, and category budget transfers.',
    subcategories: [
      { id: 'emergency_home', name: 'Home', description: 'Urgent unexpected household repairs and emergency breakdown.', microcategories: [] },
      { id: 'emergency_medical', name: 'Medical', description: 'Emergency hospital visits and sudden health crisis expenses.', microcategories: [] },
      { id: 'emergency_tour', name: 'Tour', description: 'Unexpected emergency travel costs.', microcategories: [] },
      { id: 'emergency_gift', name: 'Gift', description: 'Emergency family assistance and urgent support.', microcategories: [] },
      { id: 'emergency_bike', name: 'Bike', description: 'Sudden vehicle breakdown, puncture, emergency repairs.', microcategories: [] },
      { id: 'emergency_category_transfer', name: 'Category Transfer', description: 'Balancing overspent categories via internal fund transfer.', microcategories: [] },
    ],
  },
  {
    name: 'Investment',
    icon: Briefcase,
    budget: 100000,
    description: 'Long-term savings, mutual funds, stock investments, fixed deposits, and child funds.',
    subcategories: [
      { id: 'investment_dk', name: 'Dk', description: 'Stock market investments, mutual funds (ithought, etc.) for Dk.', microcategories: [] },
      { id: 'investment_niviya', name: 'Niviya', description: 'Child mutual fund investments and education savings for Niviya.', microcategories: [] },
      { id: 'investment_nisha', name: 'Nisha', description: 'Mutual fund investments and long-term savings for Nisha.', microcategories: [] },
      { id: 'invesment_fd', name: 'Fixed Deposit', description: 'Bank fixed deposits and term deposits.', microcategories: [] },
      { id: 'invesment_mutual_fund', name: 'Mutual Fund', description: 'General mutual fund SIPs and investments.', microcategories: [] },
    ],
  },
  {
    name: 'Food,Snacks & Outing',
    icon: Utensils,
    budget: 5000,
    description: 'Dining out, cafes, quick snacks, and entertainment.',
    subcategories: [
      { id: 'food_snack_food', name: 'Food', description: 'Restaurant dining, food delivery, takeaway meals.', microcategories: [] },
      { id: 'food_snack_snacks', name: 'Snacks', description: 'Evening snacks, juices, tea, coffee, bakery items.', microcategories: [] },
    ],
  }
];


export const defaultSettings: Omit<Settings, 'tenantId' | 'dateInputStyle'> = { 
  currency: '₹', 
  locale: 'en-IN',
  defaultCategory: '',
  defaultSubcategory: '',
  defaultMicrocategory: '',
  defaultPaidBy: '',
  aiModel: 'gemini-2.5-flash',
};
