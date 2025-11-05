import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UploadedFile } from "@shared/schema";
import { FileText, Download, Trash2, Upload, CloudUpload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";

export function UploadSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: files = [], isLoading } = useQuery<UploadedFile[]>({
    queryKey: ["/api/files"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", `Role ${files.length + 1}-${files.length + 3} Analysis Framework`);
      
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vector-store"] });
      toast({
        title: "Success",
        description: "PDF uploaded and indexed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vector-store"] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const file = selectedFiles[0];
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    
    if (files.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "Maximum 3 files allowed",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
    return Math.floor(seconds / 86400) + " days ago";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Knowledge Base Documents</h3>
        <span className="text-sm text-muted-foreground">Unlimited PDFs</span>
      </div>
      
      {isLoading ? (
        <div className="space-y-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
              <div className="h-12 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {files.map((file) => (
            <div 
              key={file.id} 
              className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
              data-testid={`file-card-${file.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="text-destructive text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate" data-testid="text-filename">
                      {file.originalName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {file.description || "Knowledge base document"}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{formatTimeSince(file.uploadedAt)}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Indexing Progress</span>
                        <span className="font-medium text-secondary">100%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-secondary h-1.5 rounded-full" style={{ width: "100%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button 
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Download"
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Remove"
                    onClick={() => deleteMutation.mutate(file.id)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div 
        className={`upload-zone rounded-xl p-8 text-center cursor-pointer ${isDragOver ? "dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="upload-zone"
      >
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CloudUpload className="w-8 h-8 text-primary" />
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">Upload Additional Documents</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {uploadMutation.isPending 
              ? "Uploading and indexing..." 
              : "Drag and drop PDF files here or click to browse"}
          </p>
          <button 
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
            disabled={uploadMutation.isPending || files.length >= 3}
            data-testid="button-choose-files"
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Choose Files
          </button>
          <p className="text-xs text-muted-foreground mt-3">Maximum file size: 10MB per file</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          data-testid="input-file"
        />
      </div>
    </div>
  );
}
