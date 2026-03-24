import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as documentsService from "../services/documents";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: documentsService.getTemplates,
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => documentsService.getTemplate(id!),
    enabled: !!id,
  });
}

export function useDocuments(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  template_id?: string;
  source?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => documentsService.getDocuments(params),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsService.getDocument(id!),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsService.createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
