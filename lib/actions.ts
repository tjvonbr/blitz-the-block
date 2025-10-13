"use server"

import db from "@/lib/prisma"
import { signUpSchema } from "@/lib/validations"

export async function createUser(formData: FormData) {
  try {
    const data = signUpSchema.parse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      password: formData.get("password"),
      businessName: formData.get("businessName"),
      industry: formData.get("industry"),
      serviceArea: formData.get("serviceArea"),
    })

    let user = await db.user.findFirst({ where: { email: data.email } })

    if (!user) {
      user = await db.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
        }
      })
    }

    const existingBusiness = await db.business.findFirst({
      where: { userId: user.id, name: data.businessName }
    })
    
    if (!existingBusiness) {
      await db.business.create({
        data: {
          userId: user.id,
          name: data.businessName,
          industry: data.industry,
          serviceArea: data.serviceArea,
        }
      })
    }

    return { success: true, user }
  } catch (error) {
    console.error("Error creating user:", error)
    return { error: "Failed to create user" }
  }
} 