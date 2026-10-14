import { z } from "zod";
import { statusIds, typeIds } from "@/config/scenario";

export const createResourceSchema = z.object({
  type: z.enum(typeIds),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: z.enum(statusIds).default("available"),
  skills: z.string().trim().max(300).default(""),
  // http(s) only: z.url() alone would also accept javascript: URLs
  link: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\//i)
    .nullish(),
  contact: z.string().trim().max(200).nullish(),
});

export const updateResourceSchema = z.object({
  status: z.enum(statusIds).optional(),
  confirm: z.boolean().optional(), // "still here" vote
});
