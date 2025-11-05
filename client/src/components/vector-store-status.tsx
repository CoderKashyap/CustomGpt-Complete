import { useQuery } from "@tanstack/react-query";
import type { VectorStore } from "@shared/schema";

export function VectorStoreStatus() {
  const { data: vectorStore, isLoading } = useQuery<VectorStore | null>({
    queryKey: ["/api/vector-store"],
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!vectorStore) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Vector Store Status</h3>
          <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
            Not Created
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload your first PDF to initialize the vector store.
        </p>
      </div>
    );
  }

  const timeSince = new Date(vectorStore.updatedAt).toLocaleString();

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6" data-testid="vector-store-status">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Vector Store Status</h3>
        <span 
          className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-medium"
          data-testid="status-badge"
        >
          {vectorStore.status === "active" ? "Active" : vectorStore.status}
        </span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Store ID:</span>
          <code 
            className="bg-muted px-2 py-1 rounded font-mono text-xs"
            data-testid="text-store-id"
          >
            {vectorStore.openaiVectorStoreId}
          </code>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Documents Indexed:</span>
          <span className="font-semibold" data-testid="text-document-count">
            {vectorStore.fileCount} / 3
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Updated:</span>
          <span className="text-muted-foreground" data-testid="text-last-updated">
            {timeSince}
          </span>
        </div>
      </div>
    </div>
  );
}
