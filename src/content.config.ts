import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/index.mdx', base: './src/content/projects' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    client: z.string().optional(),
    year: z.number(),
    role: z.string(),
    tags: z.array(z.string()),
    summary: z.string().max(200),
    hero: image(),
    thumb: image(),
    order: z.number().default(999),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    links: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
    })).optional(),
  }),
});

export const collections = { projects };
