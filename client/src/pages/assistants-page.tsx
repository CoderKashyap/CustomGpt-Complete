import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertAssistantSchema } from "@shared/schema";
import type { Assistant, UploadedFile } from "@shared/schema";
import { Bot, Plus, Edit, Trash2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type InsertAssistant = z.infer<typeof insertAssistantSchema>;

export default function AssistantsPage() {
  const { toast } = useToast();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFilesDialog, setShowFilesDialog] = useState(false);

  const { data: assistants, isLoading } = useQuery<Assistant[]>({
    queryKey: ["/api/assistants"],
  });

  const { data: assistantFiles } = useQuery<UploadedFile[]>({
    queryKey: ["/api/assistants", selectedAssistant?.id, "files"],
    enabled: !!selectedAssistant,
  });

  const createForm = useForm<InsertAssistant>({
    resolver: zodResolver(insertAssistantSchema),
    defaultValues: {
      name: "",
      description: "",
      instructions: "",
      model: "gpt-4o",
      isActive: 1,
    },
  });

  const editForm = useForm<Partial<Assistant>>({
    defaultValues: {},
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAssistant) => {
      const res = await apiRequest("POST", "/api/assistants", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistants"] });
      setShowCreateDialog(false);
      createForm.reset();
      toast({ title: "Success", description: "Assistant created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Assistant> }) => {
      const res = await apiRequest("PUT", `/api/assistants/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistants"] });
      setShowEditDialog(false);
      toast({ title: "Success", description: "Assistant updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/assistants/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistants"] });
      toast({ title: "Success", description: "Assistant deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ assistantId, file }: { assistantId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`/api/assistants/${assistantId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload file");
      }
      
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistants", variables.assistantId, "files"] });
      toast({ title: "Success", description: "File uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async ({ assistantId, fileId }: { assistantId: string; fileId: string }) => {
      const res = await apiRequest("DELETE", `/api/assistants/${assistantId}/files/${fileId}`);
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistants", variables.assistantId, "files"] });
      toast({ title: "Success", description: "File deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = (data: InsertAssistant) => {
    createMutation.mutate(data);
  };

  const handleEdit = (assistant: Assistant) => {
    setSelectedAssistant(assistant);
    editForm.reset(assistant);
    setShowEditDialog(true);
  };

  const handleUpdate = (data: Partial<Assistant>) => {
    if (selectedAssistant) {
      updateMutation.mutate({ id: selectedAssistant.id, data });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this assistant?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedAssistant) {
      uploadFileMutation.mutate({ assistantId: selectedAssistant.id, file });
      // Reset the input so the same file can be uploaded again
      e.target.value = "";
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-8" data-testid="assistants-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Assistants</h1>
          <p className="text-muted-foreground">
            Create and manage custom AI assistants with specialized knowledge
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="create-assistant">
          <Plus className="mr-2 h-4 w-4" />
          Create Assistant
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {assistants?.map((assistant) => (
          <Card key={assistant.id} data-testid={`assistant-card-${assistant.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Bot className="h-8 w-8 text-primary" />
                <Badge variant={assistant.isActive ? "default" : "secondary"}>
                  {assistant.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardTitle className="mt-4">{assistant.name}</CardTitle>
              <CardDescription>{assistant.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <strong>Model:</strong> {assistant.model}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(assistant)}
                    data-testid={`edit-${assistant.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAssistant(assistant);
                      setShowFilesDialog(true);
                    }}
                    data-testid={`files-${assistant.id}`}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Files
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(assistant.id)}
                    data-testid={`delete-${assistant.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Assistant</DialogTitle>
            <DialogDescription>
              Create a custom AI assistant with specialized knowledge and instructions
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Technical Support Assistant" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Provides technical support and troubleshooting guidance"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="You are a helpful assistant. Use the provided knowledge base to answer questions and provide guidance..."
                        rows={6}
                        {...field}
                        data-testid="input-instructions"
                      />
                    </FormControl>
                    <FormDescription>
                      System prompt that defines the assistant's behavior
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-model">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gpt-5">GPT-5</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-create">
                  {createMutation.isPending ? "Creating..." : "Create Assistant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Assistant</DialogTitle>
            <DialogDescription>Update assistant settings and instructions</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} value={field.value || ""} data-testid="edit-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Make this assistant available to users
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 1}
                        onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                        data-testid="edit-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update">
                  {updateMutation.isPending ? "Updating..." : "Update Assistant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Files - {selectedAssistant?.name}</DialogTitle>
            <DialogDescription>
              Attach or remove files from this assistant's knowledge base
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Upload New File</h3>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploadFileMutation.isPending}
                  data-testid="file-upload-input"
                />
                {uploadFileMutation.isPending && (
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Upload PDF files to add knowledge to this assistant
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Attached Files</h3>
              {assistantFiles?.length === 0 ? (
                <div className="text-sm text-muted-foreground">No files attached yet</div>
              ) : (
                <div className="space-y-2">
                  {assistantFiles?.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`attached-file-${file.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{file.originalName}</div>
                          <div className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          selectedAssistant &&
                          deleteFileMutation.mutate({
                            assistantId: selectedAssistant.id,
                            fileId: file.id,
                          })
                        }
                        disabled={deleteFileMutation.isPending}
                        data-testid={`delete-file-${file.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilesDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
