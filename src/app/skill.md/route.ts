import { skillMd } from "@/lib/skill";

export function GET() {
  return new Response(skillMd(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
