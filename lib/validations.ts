import { z } from "zod";

export const signUpSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  serviceArea: z.string().min(1),
});