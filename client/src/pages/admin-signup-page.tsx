import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

const adminSignupSchema = z.object({
  adminSecret: z.string().min(1, "Admin secret is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
});

type AdminSignupFormData = z.infer<typeof adminSignupSchema>;

export default function AdminSignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AdminSignupFormData>({
    resolver: zodResolver(adminSignupSchema),
    defaultValues: {
      adminSecret: "",
      username: "",
      password: "",
      role: "admin",
    },
  });

  const handleSignup = async (data: AdminSignupFormData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/admin-signup", data);
      const user = await response.json() as User;

      toast({
        title: "Account created!",
        description: `Welcome, ${user.username} (${user.role})`,
      });

      queryClient.setQueryData(["/api/auth/me"], user);
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Could not create account",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">🔒 Secret Admin Signup</CardTitle>
          <CardDescription>
            Create admin or user accounts (This page is hidden from regular users)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
              <FormField
                control={form.control}
                name="adminSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Secret Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="password"
                        data-testid="input-admin-secret"
                        placeholder="Enter admin secret password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        data-testid="input-admin-username"
                        placeholder="Enter username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="password"
                        data-testid="input-admin-password"
                        placeholder="Enter password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin" data-testid="option-admin">Admin (Can upload PDFs)</SelectItem>
                        <SelectItem value="user" data-testid="option-user">User (Chat only)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-admin-signup"
              >
                {isLoading ? "Creating..." : "Create Account"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/auth")}
                data-testid="button-back-to-auth"
              >
                Back to Regular Login
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
