import { getStatusline } from "@/lib/db/queries";
import {
  createStatuslineSocialImage,
  socialImageSize,
} from "@/lib/statusline/social-image";

export const alt = "ClaudeLines status line preview";
export const size = socialImageSize;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function TwitterImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getStatusline(slug);

  if (!row || row.hidden || row.archived) {
    return new Response("Not found", { status: 404 });
  }

  return createStatuslineSocialImage(row);
}
