import { demoCollections, demoStories } from './demoCatalog';
import type { Collection, Story } from '../types/editorial';

export interface CatalogRepository {
  getCollections(): Promise<Collection[]>;
  getCollection(slug: string): Promise<Collection | undefined>;
  getStories(): Promise<Story[]>;
  getStory(slug: string): Promise<Story | undefined>;
}

export const localCatalogRepository: CatalogRepository = {
  async getCollections() { return demoCollections; },
  async getCollection(slug) { return demoCollections.find((collection) => collection.slug === slug); },
  async getStories() { return demoStories; },
  async getStory(slug) { return demoStories.find((story) => story.slug === slug); },
};
