export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_years?: number;
  age_months?: number;
  sex?: string;
  size?: string;
  color?: string;
  description?: string;
  personality?: string[];
  special_needs?: string[];
  good_with_kids?: boolean;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  adoption_fee?: number;
  image_url?: string;
  shelter_id?: string;
  shelter_name?: string;
  status?: string;
  intake_date?: string;
  available_date?: string;
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
