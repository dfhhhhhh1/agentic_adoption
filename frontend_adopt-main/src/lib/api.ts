import type { Pet, MatchRequest, MatchResult, Shelter, Stats } from './types';

const API_BASE = 'http://localhost:8000';

export const api = {
  async getPets(species?: string): Promise<Pet[]> {
    const url = species
      ? `${API_BASE}/pets?species=${species}`
      : `${API_BASE}/pets`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch pets');
    const data = await response.json();
    
    // Extract pets and resolve image URLs
    const pets = Array.isArray(data.pets) ? data.pets : [];
    return pets.map(pet => ({
      ...pet,
      image_urls: (pet.image_urls || []).map(url => 
        url.startsWith('http') ? url : `${API_BASE}${url}`
      ),
      image_path: pet.image_path && !pet.image_path.startsWith('http')
        ? `${API_BASE}${pet.image_path}`
        : pet.image_path,
    }));
  },

  async getPet(id: string): Promise<Pet> {
    const response = await fetch(`${API_BASE}/pets/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pet');
    const pet = await response.json();
    
    // Resolve image URLs
    return {
      ...pet,
      image_urls: (pet.image_urls || []).map(url => 
        url.startsWith('http') ? url : `${API_BASE}${url}`
      ),
      image_path: pet.image_path && !pet.image_path.startsWith('http')
        ? `${API_BASE}${pet.image_path}`
        : pet.image_path,
    };
  },

  async matchPets(request: MatchRequest): Promise<MatchResult[]> {
    const response = await fetch(`${API_BASE}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to match pets');
    const data = await response.json();
    
    // Extract results and resolve image URLs in nested pets
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map(result => ({
      ...result,
      pet: {
        ...result.pet,
        image_urls: (result.pet.image_urls || []).map(url => 
          url.startsWith('http') ? url : `${API_BASE}${url}`
        ),
        image_path: result.pet.image_path && !result.pet.image_path.startsWith('http')
          ? `${API_BASE}${result.pet.image_path}`
          : result.pet.image_path,
      },
    }));
  },

  async getShelters(): Promise<Shelter[]> {
    const response = await fetch(`${API_BASE}/shelters`);
    if (!response.ok) throw new Error('Failed to fetch shelters');
    const data = await response.json();
    return Array.isArray(data.shelters) ? data.shelters : [];
  },

  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  async checkHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('API unhealthy');
    return response.json();
  },
};