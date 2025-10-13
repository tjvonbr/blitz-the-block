"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import authClient from "@/lib/auth-client";
import { signUpSchema, signUpStepOneSchema } from "@/lib/validations";
import { useRouter } from "next/navigation";

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>;

type FormData = z.infer<typeof signUpSchema>;

export function SignUpForm({ className, ...props }: UserAuthFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
  });

  const [step, setStep] = React.useState<number>(1);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const hasInitializedStepTwo = React.useRef<boolean>(false);
  const router = useRouter();

  React.useEffect(() => {
    if (step === 2 && !hasInitializedStepTwo.current) {
      hasInitializedStepTwo.current = true;
      // Clear any unintended browser autofill carry-over
      form.resetField("businessName");
      form.resetField("industry");
      form.resetField("serviceArea");
    }
  }, [step, form]);

  async function handleNext() {
    const currentValues = form.getValues();
    const result = signUpStepOneSchema.safeParse({
      firstName: currentValues.firstName,
      lastName: currentValues.lastName,
      email: currentValues.email,
      password: currentValues.password,
    });
    if (result.success) {
      setStep(2);
      return;
    }
    // reflect zod errors into RHF
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        form.setError(field as keyof FormData, { type: "zod", message: issue.message });
      }
    }
  }

  async function onSubmit(data: FormData) {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("email", data.email.toLowerCase().trim());
      formData.append("password", data.password);
      formData.append("businessName", data.businessName);
      formData.append("industry", data.industry);
      formData.append("serviceArea", data.serviceArea);

      const result = await createUser(formData);

      if (result.error) {
        throw new Error(result.error);
      }

      const { data: signUpData, error } = await authClient.signUp.email({
        email: data.email.toLowerCase().trim(),
        password: data.password,
        name: `${data.firstName} ${data.lastName}`,
        callbackURL: "/"
      });

      console.log(signUpData);

      setIsLoading(false);

      if (error) {
        console.log(error);
        return toast.error("Something went wrong.", {
          description: "Your sign in request failed. Please try again.",
        });
      }

      router.replace("/")
    } catch (error) {
      console.error(error);
      console.log(error);
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
            {step === 1 ? (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="firstName">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      autoCapitalize="none"
                      autoComplete="given-name"
                      autoCorrect="off"
                      disabled={isLoading}
                      {...form.register("firstName")}
                    />
                    {form.formState.errors?.firstName && (
                      <p className="px-1 text-xs text-red-600">
                        {form.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="lastName">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      autoCapitalize="none"
                      autoComplete="family-name"
                      autoCorrect="off"
                      disabled={isLoading}
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
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...form.register("email")}
                  />
                  {form.formState.errors?.email && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...form.register("password")}
                  />
                  {form.formState.errors?.password && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <button type="button" className={cn(buttonVariants(), "hover:cursor-pointer")} disabled={isLoading} onClick={handleNext}>
                  Next
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="organization"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...form.register("businessName")}
                  />
                  {form.formState.errors?.businessName && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.businessName.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="off"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...form.register("industry")}
                  />
                  {form.formState.errors?.industry && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.industry.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="serviceArea">Service area</Label>
                  <Input
                    id="serviceArea"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="off"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...form.register("serviceArea")}
                  />
                  {form.formState.errors?.serviceArea && (
                    <p className="px-1 text-xs text-red-600">
                      {form.formState.errors.serviceArea.message}
                    </p>
                  )}
                </div>
                <button type="button" className={cn(buttonVariants({ variant: "ghost" }), "hover:cursor-pointer")} disabled={isLoading} onClick={() => setStep(1)}>
                  Back
                </button>
                <button className={cn(buttonVariants(), "hover:cursor-pointer")} disabled={isLoading}>
                  {isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign up
                </button>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}