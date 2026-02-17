import type { Pet, MatchRequest, MatchResult, Shelter, Stats } from './types';

const API_BASE = 'http://localhost:8000';

export const api = {
  async getPets(species?: string): Promise<Pet[]> {
    const url = species
      ? `${API_BASE}/pets?species=${species}`
      : `${API_BASE}/pets`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch pets');
    return response.json();
  },

  async getPet(id: string): Promise<Pet> {
    const response = await fetch(`${API_BASE}/pets/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pet');
    return response.json();
  },

  async matchPets(request: MatchRequest): Promise<MatchResult[]> {
    const response = await fetch(`${API_BASE}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to match pets');
    return response.json();
  },

  async getShelters(): Promise<Shelter[]> {
    const response = await fetch(`${API_BASE}/shelters`);
    if (!response.ok) throw new Error('Failed to fetch shelters');
    return response.json();
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
