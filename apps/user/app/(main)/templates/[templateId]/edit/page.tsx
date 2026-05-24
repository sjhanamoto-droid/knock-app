import { getTemplate } from "@/lib/actions/templates";
import { EditTemplateClient } from "./edit-template-client";

export default async function EditTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);
  return <EditTemplateClient initialTemplate={template} templateId={templateId} />;
}
