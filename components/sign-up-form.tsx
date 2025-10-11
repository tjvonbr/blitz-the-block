"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Form } from "./ui/form";
import { toast } from "sonner";
import { createUser } from "@/lib/actions"
import { signIn } from "next-auth/react"
import { signUpSchema } from "@/lib/validations";

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>;

type FormData = z.infer<typeof signUpSchema>;

export function SignUpForm({ className, ...props }: UserAuthFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
  });

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isGitHubLoading, setIsGitHubLoading] = React.useState<boolean>(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  async function onSubmit(data: FormData) {
    setIsLoading(true);

    try {
      // Create FormData for server action
      const formData = new FormData();
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("email", data.email);

      const result = await createUser(formData);

      if (result.error) {
        throw new Error(result.error);
      }

      const signInResult = await signIn("resend", {
        email: data.email,
        redirect: false,
        callbackUrl: searchParams?.get("from") || "/properties",
      });

      setIsLoading(false);

      if (!signInResult) {
        return toast.error("Something went wrong.", {
          description: "Your sign in request failed. Please try again.",
        });
      }

      // Redirect to verify email page
      router.push("/verify-email");
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      return toast.error("Something went wrong.", {
        description: error instanceof Error ? error.message : "Your sign up request failed. Please try again.",
      });
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="" htmlFor="firstName">
                    First name
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    autoCapitalize="none"
                    autoComplete="firstName"
                    autoCorrect="off"
                    disabled={isLoading || isGitHubLoading}
                    {...form.register("firstName")}
                  />
                  {form.formState.errors?.firstName && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label className="" htmlFor="lastName">
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    autoCapitalize="none"
                    autoComplete="lastName"
                    autoCorrect="off"
                    disabled={isLoading || isGitHubLoading}
                    {...form.register("lastName")}
                  />
                  {form.formState.errors?.lastName && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading || isGitHubLoading}
                  {...form.register("email")}
                />
                {form.formState.errors?.email && (
                  <p className="px-1 text-xs text-red-600">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>
            <button className={cn(buttonVariants(), "hover:cursor-pointer")} disabled={isLoading}>
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sign up
            </button>
          </div>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "hover:cursor-pointer")}
          onClick={() => {
            setIsGitHubLoading(true);
          }}
          disabled={isLoading || isGitHubLoading}
        >
          {isGitHubLoading ? (
            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            "Google"
          )}
        </button>
      </Form>
    </div>
  );
}