import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const projects = defineCollection({
    loader: glob({ pattern: "*.json", base: "./src/content/projects" }),
    schema: z.object({
        title: z.string(),
        client: z.string().default(""),
        year: z.coerce.number(),
        discipline: z.string().default(""),
        summary: z.string().default(""),
        role: z.string().default(""),
        duration: z.string().optional().default(""),
        cover: z.string(),
        coverAlt: z.string().optional().default(""),
        imageWide: z.string().optional().default(""),
        imageWideAlt: z.string().optional().default(""),
        imageTall: z.string().optional().default(""),
        imageTallAlt: z.string().optional().default(""),
        imageClosing: z.string().optional().default(""),
        imageClosingAlt: z.string().optional().default(""),
        overview: z.string().default(""),
        outcome: z.string().optional().default(""),
        sortOrder: z.coerce.number().default(99),
        fileNo: z.string().optional().default(""),
        galerie: z.array(z.object({ image: z.string(), alt: z.string().optional().default("") })).optional().default([]),
    }),
})

const experience = defineCollection({
    loader: glob({ pattern: "*.json", base: "./src/content/experience" }),
    schema: z.object({
        role: z.string(),
        company: z.string().default(""),
        period: z.string().default(""),
        categorie: z.enum(["Expérience", "Formation"]),
        order: z.coerce.number().default(99),
    }),
})

const testimonials = defineCollection({
    loader: glob({ pattern: "*.json", base: "./src/content/testimonials" }),
    schema: z.object({
        name: z.string(),
        role: z.string().default(""),
        quote: z.string(),
        photo: z.string().optional().default(""),
        order: z.coerce.number().default(99),
    }),
})

export const collections = { projects, experience, testimonials }
