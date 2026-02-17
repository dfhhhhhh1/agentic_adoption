export interface Pet {
  // Core identity
  id?: string;
  name: string;
  species: string;
  breed: string;
  
  // Age & demographics
  age_text?: string;        // ← Changed from age_years
  age_months?: number;
  sex?: string;
  size?: string;
  color?: string;
  weight_lbs?: number;      // ← New field
  
  // Personality & behavior
  personality_description?: string;  // ← Changed from description
  energy_level?: string;            // ← New field
  special_needs?: string;           // ← Changed from string[] to string
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  good_with_children?: boolean;     // ← Changed from good_with_kids
  house_trained?: boolean;          // ← New field
  
  // Logistics
  adoption_fee?: number;
  is_neutered?: boolean;            // ← New field
  shelter_name?: string;
  shelter_location?: string;        // ← New field
  shelter_contact?: string;         // ← New field
  
  // Media & URLs
  image_urls?: string[];            // ← Changed from image_url (singular)
  image_path?: string;              // ← New field
  listing_url?: string;             // ← New field
  
  // Source tracking
  external_id?: string;             // ← New field
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
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
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
