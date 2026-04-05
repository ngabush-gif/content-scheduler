import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

const NICHES = [
  { value: "time_freedom", label: "Time Freedom Seekers" },
  { value: "parents", label: "Solo/Busy Parents" },
  { value: "side_hustlers", label: "Side Hustlers" },
  { value: "online_business", label: "Online Business Learners" },
  { value: "cultural", label: "Cultural Reach" },
  { value: "over_50", label: "50+ Demographic" },
  { value: "scam_survivors", label: "Scam Survivors" },
];

const CATEGORIES = ["Success Story", "Daily Tip", "Problem/Solution", "Question", "Motivational", "Educational", "Announcement"];

export default function ContentTemplates() {
  const { user } = useAuth();
  const [selectedNiche, setSelectedNiche] = useState("time_freedom");
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    category: "",
    prompt: "",
    exampleContent: "",
  });

  const templates = trpc.templates.listByNiche.useQuery({ niche: selectedNiche });
  const createTemplate = trpc.templates.create.useMutation();
  const deleteTemplate = trpc.templates.delete.useMutation();

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.category || !newTemplate.prompt) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createTemplate.mutateAsync({
        ...newTemplate,
        niche: selectedNiche as any,
        isDefault: false,
      });
      toast.success("Template created successfully!");
      setNewTemplate({ name: "", description: "", category: "", prompt: "", exampleContent: "" });
      setIsCreating(false);
      templates.refetch();
    } catch (error) {
      toast.error("Failed to create template");
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteTemplate.mutateAsync({ id });
      toast.success("Template deleted");
      templates.refetch();
    } catch (error) {
      toast.error("Failed to delete template");
      console.error(error);
    }
  };

  if (!user) return null;
  const isAdmin = user.role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Content Templates</h1>
            <p className="text-muted-foreground mt-2">Pre-built templates for consistent, fast content creation</p>
          </div>
          {isAdmin && (
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>Add a new content template for your team</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Success Story Template"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Brief description of this template"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt *</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Describe the template structure and guidelines..."
                      value={newTemplate.prompt}
                      onChange={(e) => setNewTemplate({ ...newTemplate, prompt: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="example">Example Content</Label>
                    <Textarea
                      id="example"
                      placeholder="Example of a post using this template..."
                      value={newTemplate.exampleContent}
                      onChange={(e) => setNewTemplate({ ...newTemplate, exampleContent: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={createTemplate.isPending} className="w-full">
                    {createTemplate.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      "Create Template"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Niche Filter */}
        <div className="space-y-2">
          <Label htmlFor="niche-filter">Filter by Niche</Label>
          <Select value={selectedNiche} onValueChange={setSelectedNiche}>
            <SelectTrigger id="niche-filter" className="w-full md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => (
                <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        {templates.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.data && templates.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.data.map((template) => (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.category}</CardDescription>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive hover:text-destructive/80"
                        disabled={deleteTemplate.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">PROMPT</p>
                    <p className="text-sm line-clamp-3">{template.prompt}</p>
                  </div>
                  {template.exampleContent && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">EXAMPLE</p>
                      <p className="text-sm line-clamp-2">{template.exampleContent}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No templates for this niche yet</p>
              {isAdmin && <p className="text-sm text-muted-foreground mt-2">Create one to get started</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
