import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Bot } from "lucide-react";
import type { User, Assistant } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAssistantDialog, setShowAssistantDialog] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: assistants } = useQuery<Assistant[]>({
    queryKey: ["/api/assistants"],
  });

  const { data: userAssistants, isLoading: assistantsLoading } = useQuery<Assistant[]>({
    queryKey: ["/api/users", selectedUser?.id, "/assistants"],
    enabled: !!selectedUser,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async ({ userId, assistantId }: { userId: string; assistantId: string }) => {
      const res = await apiRequest("POST", `/api/users/${userId}/assistant-access`, { assistantId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "/assistants"] });
      toast({
        title: "Success",
        description: "Assistant access granted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async ({ userId, assistantId }: { userId: string; assistantId: string }) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}/assistant-access/${assistantId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "/assistants"] });
      toast({
        title: "Success",
        description: "Assistant access revoked",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleGrantAccess = (assistantId: string) => {
    if (selectedUser) {
      grantAccessMutation.mutate({ userId: selectedUser.id, assistantId });
    }
  };

  const handleRevokeAccess = (assistantId: string) => {
    if (selectedUser) {
      revokeAccessMutation.mutate({ userId: selectedUser.id, assistantId });
    }
  };

  const availableAssistants = assistants?.filter(
    (a) => !userAssistants?.some((ua) => ua.id === a.id)
  ) || [];

  if (usersLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-8" data-testid="admin-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, roles, and assistant access
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-users">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-users">
              {users?.filter((u) => u.role === "admin").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Assistants</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-assistants">{assistants?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Update user roles and manage assistant access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                  <TableCell className="font-medium" data-testid={`username-${user.id}`}>
                    {user.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`role-${user.id}`}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`created-${user.id}`}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        data-testid={`role-select-${user.id}`}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowAssistantDialog(true);
                        }}
                        data-testid={`manage-access-${user.id}`}
                      >
                        Manage Access
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAssistantDialog} onOpenChange={setShowAssistantDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Assistant Access - {selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              Grant or revoke access to AI assistants for this user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Current Access</h3>
              {assistantsLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : userAssistants?.length === 0 ? (
                <div className="text-sm text-muted-foreground">No assistants assigned</div>
              ) : (
                <div className="space-y-2">
                  {userAssistants?.map((assistant) => (
                    <div
                      key={assistant.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`assigned-${assistant.id}`}
                    >
                      <div>
                        <div className="font-medium">{assistant.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {assistant.description}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevokeAccess(assistant.id)}
                        data-testid={`revoke-${assistant.id}`}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Available Assistants</h3>
              {availableAssistants.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No additional assistants available
                </div>
              ) : (
                <div className="space-y-2">
                  {availableAssistants.map((assistant) => (
                    <div
                      key={assistant.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`available-${assistant.id}`}
                    >
                      <div>
                        <div className="font-medium">{assistant.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {assistant.description}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGrantAccess(assistant.id)}
                        data-testid={`grant-${assistant.id}`}
                      >
                        Grant Access
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssistantDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
