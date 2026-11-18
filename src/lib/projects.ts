import { getCollection } from "astro:content"
export async function getProjects() {
    const all = await getCollection("projects")
    return all.sort((a, b) => a.data.sortOrder - b.data.sortOrder)
}
