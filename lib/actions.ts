"use server"

import db from "@/lib/prisma"
import { signUpSchema } from "@/lib/validations"

export async function createUser(formData: FormData) {
  try {
    const data = signUpSchema.parse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
    })

    const existingUser = await db.user.findFirst({
      where: { email: data.email }
    })

    if (existingUser) {
      return { error: "A user with this email already exists!  Please sign in instead." }
    }

    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      }
    })

    return { success: true, user }
  } catch (error) {
    console.error("Error creating user:", error)
    return { error: "Failed to create user" }
  }
} 