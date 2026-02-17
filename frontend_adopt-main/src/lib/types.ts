export interface Pet {
  // Core identity
  id?: string;
  name: string;
  species: string;
  breed: string;
  
  // Age & demographics
  age_text?: string;
  age_months?: number;
  sex?: string;
  size?: string;
  color?: string;
  weight_lbs?: number;
  
  // Personality & behavior
  personality_description?: string;
  energy_level?: string;
  special_needs?: string;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  good_with_children?: boolean;
  house_trained?: boolean;
  
  // Logistics
  adoption_fee?: number;
  is_neutered?: boolean;
  shelter_name?: string;
  shelter_location?: string;
  shelter_contact?: string;
  
  // Media & URLs
  image_urls?: string[];
  image_path?: string;
  listing_url?: string;
  
  // Source tracking
  external_id?: string;
  intake_date?: string;
}

export interface MatchResult {
  pet: Pet;
  score: number;
  reasoning: string;
  match_percentage: number;
}

export interface MatchRequest {
  query: string;
  max_results?: number;
}

export interface Shelter {
  id: string;
  name: string;
  website_url?: string;
  website?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  pet_count?: number;
}

export interface Stats {
  total_pets: number;
  total_shelters: number;
  pets_by_species: Record<string, number>;
  pets_by_status: Record<string, number>;
}

export interface QuizAnswers {
  living_situation: string;
  home_size: string;
  yard: string;
  experience: string;
  activity_level: string;
  time_commitment: string;
  other_pets: string;
  children: string;
}